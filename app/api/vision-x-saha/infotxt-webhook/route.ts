import { createHash, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { normalizePhilippineMobile } from "../../../lib/visionInfotxt";
import { saveInfotxtInbound } from "../../../lib/visionInfotxtRecords";
import { loadSmsAutomationConfig, maskSmsPhone } from "../../../lib/visionSmsAutomation";
import { isConvoActive, runSmsAgent } from "../../../lib/visionSmsAgent";
import { sendTrackedInfotxtSms } from "../../../lib/visionSmsTrackedSend";
import { completeAbandonRecovery, markRecoveryGaveUp } from "../../../lib/visionAbandonRecovery";
import { closeMarketingForPhone, findActiveMarketingEnrollment, recordMarketingEvent } from "../../../lib/visionMarketingEngine";

export const dynamic = "force-dynamic";

const PANCAKE_API = "https://pos.pages.fm/api/v1";

// Classify a customer's SMS reply to an order confirmation.
function classifyReply(sms: string) {
  const value = String(sms || "").trim().toLowerCase();
  if (/^(yes|y|oo|ok|okay|sige|confirm|confirmed|g|go|tama|opo)\b/.test(value)) return "yes";
  if (/^(no|n|hindi|di|ayaw|cancel|wag|huwag)\b/.test(value)) return "no";
  return "";
}

async function pancakeJson(url: string, init?: RequestInit) {
  const res = await fetch(url, { ...init, cache: "no-store" });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body?.error) throw new Error(body?.error?.message || body?.message || `Pancake returned ${res.status}.`);
  return body;
}

async function lookupMobileOrders(apiKey: string, shopId: string, phone: string) {
  const params = new URLSearchParams({ api_key: apiKey, search: phone, page_size: "20", page_number: "1" });
  const body = await pancakeJson(`${PANCAKE_API}/shops/${encodeURIComponent(shopId)}/orders?${params}`);
  return Array.isArray(body.data) ? body.data : [];
}

async function setOrderStatus(apiKey: string, shopId: string, orderId: string, status: number) {
  const form = new URLSearchParams({ "orders[0][id]": String(orderId), "orders[0][status]": String(status) });
  await fetch(`${PANCAKE_API}/shops/${encodeURIComponent(shopId)}/orders/update_multiple_orders?api_key=${encodeURIComponent(apiKey)}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
    cache: "no-store"
  });
}

// On a YES/NO reply, confirm or cancel the customer's pending order. Live only, best-effort.
function codValue(order: any) {
  const raw = Number(order?.cod || order?.total_price_after_sub_discount || order?.total_price || 0);
  return Math.round(raw > 10000 ? raw / 100 : raw);
}

function statusTagalog(order: any): string {
  const s = Number(order?.status);
  const name = String(order?.status_name || "").toLowerCase();
  if (s === 0 || name === "new") return "bagong order, hindi pa confirmed";
  if (s === 1 || name.includes("confirm")) return "confirmed na at inihahanda";
  if (s === 8 || name.includes("pack")) return "inihahanda na para i-ship";
  if (s === 9 || name.includes("waiting")) return "nakahanda na para sa courier";
  if (s === 2 || name.includes("ship")) return "naka-ship na";
  if (s === 3 || name.includes("deliver")) return "na-deliver na";
  if (s === 6 || name.includes("cancel")) return "na-cancel na";
  if (name.includes("return")) return "nasa return process";
  return name || "nasa proseso";
}

// Auto-reply to a customer: fast rules for confirm/cancel/status/price, AI sales agent for the rest. Live only.
async function handleCustomerMessage(mobile: string, sms: string, order: any, pendingOrder: any, openOrder: any, transitOrder: any, abandonedOrder: any, inboundId: string) {
  try {
    const auto = await loadSmsAutomationConfig();
    if (auto.mode !== "live") return;
    const apiKey = process.env.VISION_X_SAHA_PANCAKE_API_KEY;
    const shopId = process.env.VISION_X_SAHA_PANCAKE_SHOP_ID;
    if (!apiKey || !shopId) return;

    const active = await isConvoActive(mobile);
    const reply = classifyReply(sms);
    const lower = sms.trim().toLowerCase();
    const fallbackOrderId = `lead-${createHash("sha256").update(mobile).digest("hex").slice(0, 12)}`;
    const sendReply = (message: string, event: string, eventLabel: string, source: "customer_reply" | "ai_reply", selectedOrder = order) => sendTrackedInfotxtSms({
      orderId: String(selectedOrder?.id || selectedOrder?.order_id || fallbackOrderId),
      tracking: String(selectedOrder?.partner?.extend_code || ""),
      event,
      eventLabel,
      recipient: "customer",
      phone: mobile,
      message,
      source,
      eventAt: `${inboundId}:${event}`,
      templateVersion: auto.version
    });

    // Fast rules only for existing customers not mid-sales-conversation (keeps common replies free).
    if (order && !active) {
      // Abandoned-order recovery takes priority: YES applies the offered discount and saves it.
      if (reply && abandonedOrder) {
        const aid = String(abandonedOrder.id || abandonedOrder.order_id);
        if (reply === "yes") {
          const res = await completeAbandonRecovery(apiKey, shopId, abandonedOrder);
          const line = res.pct > 0 ? `${res.pct}% off applied, bagong COD P${res.newCodPeso}.` : "";
          await sendReply(`Salamat! Na-save na ang order mo #${aid}. ${line} Ihahanda na namin ito.`, "recovery_confirmed", "Recovery confirmed", "customer_reply", abandonedOrder);
        } else {
          await markRecoveryGaveUp(aid);
          await sendReply(`Sige, salamat pa rin! Nandito lang kami kung magbago ang isip mo para sa Lakatan mo.`, "recovery_declined", "Recovery declined", "customer_reply", abandonedOrder);
        }
        return;
      }
      // Confirm / cancel a pending order.
      if (reply && pendingOrder) {
        const pendingId = String(pendingOrder.id || pendingOrder.order_id);
        if (reply === "yes") {
          await setOrderStatus(apiKey, shopId, pendingId, 1);
          await sendReply(`Salamat! Confirmed na ang order mo #${pendingId}. Ihahanda na namin ito.`, "reply_confirmed", "Confirmation reply", "customer_reply", pendingOrder);
        } else {
          await setOrderStatus(apiKey, shopId, pendingId, 6);
          await sendReply(`Na-cancel na ang order mo #${pendingId}. Salamat sa pag-abiso.`, "reply_cancelled", "Cancellation reply", "customer_reply", pendingOrder);
        }
        return;
      }
      const orderId = String(order.id || order.order_id);
      const tracking = String(order?.partner?.extend_code || "");
      if (/saan|nasaan|tracking|order ko|kelan|kailan|when|deliver|dating|arrive|track|status|update/.test(lower)) {
        const line = tracking ? `Tracking: ${tracking} (J&T).` : "Ihahanda pa namin ito.";
        await sendReply(`Order #${orderId} mo: ${statusTagalog(order)}. ${line} Salamat!`, "reply_status", "Order status reply", "customer_reply");
        return;
      }
      if (/magkano|how much|price|presyo|bayad|cod|total/.test(lower)) {
        await sendReply(`Order #${orderId} mo: COD P${codValue(order)}${order?.total_quantity ? `, ${order.total_quantity} pcs` : ""}. Ihanda lang ang bayad sa pagdating. Salamat!`, "reply_price", "Price reply", "customer_reply");
        return;
      }
    }

    // Reorders, upsell/downsell, active conversations, and anything else -> AI sales agent.
    const text = await runSmsAgent(mobile, sms, order, apiKey, shopId, openOrder, transitOrder);
    if (text) await sendReply(text, "ai_reply", "Mel AI reply", "ai_reply");
  } catch (error) {
    console.error("VISION X SAHA customer reply failed", error instanceof Error ? error.message : "Unknown error");
  }
}

const PRIVATE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  "X-Robots-Tag": "noindex, nofollow, noarchive"
};

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: PRIVATE_HEADERS });
}

function secureEqual(left: string, right: string) {
  const leftHash = createHash("sha256").update(left).digest();
  const rightHash = createHash("sha256").update(right).digest();
  return timingSafeEqual(leftHash, rightHash);
}

function clean(value: FormDataEntryValue | null, max: number) {
  return typeof value === "string" ? value.replace(/\0/g, "").trim().slice(0, max) : "";
}

export async function POST(request: NextRequest) {
  const secret = process.env.VISION_X_SAHA_INFOTXT_WEBHOOK_SECRET?.trim() || "";
  if (!secret) return json({ error: "The InfoTXT inbound webhook is not configured." }, 503);
  const supplied = request.nextUrl.searchParams.get("key") || request.headers.get("x-vision-saha-webhook-secret") || "";
  if (!supplied || !secureEqual(supplied, secret)) return json({ error: "Unauthorized webhook." }, 401);
  if (Number(request.headers.get("content-length") || 0) > 16 * 1024) return json({ error: "Webhook payload is too large." }, 413);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return json({ error: "InfoTXT must send form-encoded webhook data." }, 400);
  }

  const providerMessageId = clean(form.get("ID") || form.get("id"), 100);
  const mobile = normalizePhilippineMobile(clean(form.get("Mobile") || form.get("mobile"), 20));
  const sms = clean(form.get("SMS") || form.get("sms"), 1000);
  const sentAt = clean(form.get("Sent") || form.get("sent"), 80);
  const receivedAt = clean(form.get("Received") || form.get("received"), 80);
  const sim = clean(form.get("SIM") || form.get("sim"), 30);
  if (!providerMessageId || !mobile || !sms) return json({ error: "ID, Mobile, and SMS are required." }, 400);

  try {
    // Identify whether this sender is a VISION X SAHA customer (has an order).
    const apiKey = process.env.VISION_X_SAHA_PANCAKE_API_KEY;
    const shopId = process.env.VISION_X_SAHA_PANCAKE_SHOP_ID;
    let isCustomer = false;
    let orderId = "";
    let customerName = "";
    let customerOrder: any = null;
    let pendingOrder: any = null;
    let openOrder: any = null;
    let transitOrder: any = null;
    let abandonedOrder: any = null;
    if (apiKey && shopId) {
      try {
        const orders = await lookupMobileOrders(apiKey, shopId, mobile);
        if (orders.length) {
          customerOrder = orders[0];
          isCustomer = true;
          orderId = String(customerOrder.id || customerOrder.order_id || "");
          customerName = String(customerOrder.bill_full_name || customerOrder.full_name || "");
          pendingOrder = orders.find((order: any) => [0, 1].includes(Number(order.status)) && !order.is_removed) || null;
          openOrder = orders.find((order: any) => [0, 1, 8].includes(Number(order.status)) && !order.is_removed) || null;
          transitOrder = orders.find((order: any) => [2, 9].includes(Number(order.status)) && !order.is_removed) || null;
          abandonedOrder = orders.find((order: any) => order.is_abandoned_order && !order.is_removed && Number(order.status) === 0) || null;
        }
      } catch (lookupError) {
        console.error("VISION X SAHA inbound customer lookup failed", lookupError instanceof Error ? lookupError.message : "Unknown error");
      }
    }

    const result = await saveInfotxtInbound({
      providerMessageId,
      mobile,
      mobileMasked: maskSmsPhone(mobile),
      sms,
      sentAt,
      receivedAt,
      sim,
      isCustomer,
      orderId,
      customerName
    });
    // A reply to a marketing message means the sender is a known CRM customer even
    // if they are not in the current Pancake POS - always engage them.
    const enrollment = await findActiveMarketingEnrollment(mobile);
    // Engage ONLY people who are in our system: an existing Pancake POS customer, or
    // someone we messaged through a marketing campaign. Unknown numbers (wrong SIM
    // recipients, other businesses' customers, spam) are stored but never auto-replied,
    // so Mel never talks to people who are not ours.
    const engage = isCustomer ? Boolean(customerOrder) : Boolean(enrollment);
    if (result.created && engage) {
      if (enrollment) {
        await closeMarketingForPhone(mobile, "replied", "Customer replied to the marketing conversation");
        await recordMarketingEvent({
          customerId: enrollment.customerId,
          phoneMasked: maskSmsPhone(mobile),
          enrollmentId: enrollment.id,
          sequenceId: enrollment.sequenceId,
          stepId: "customer_reply",
          type: "replied",
          detail: "Customer replied and scheduled marketing messages were stopped.",
          amount: 0
        });
      }
      await handleCustomerMessage(mobile, sms, customerOrder, pendingOrder, openOrder, transitOrder, abandonedOrder, providerMessageId);
    }
    return json({ accepted: true, duplicate: !result.created, isCustomer });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Inbound SMS could not be stored." }, 502);
  }
}

import { NextRequest, NextResponse } from "next/server";
import { get, put } from "@vercel/blob";
import { loadMarketingConfig } from "../../../lib/visionMarketingEngine";
import { refreshInfotxtOutboundRecords } from "../../../lib/visionInfotxtRecords";
import { normalizePhilippineMobile } from "../../../lib/visionInfotxt";
import { loadSmsAutomationConfig, recordSmsWebhookHeartbeat } from "../../../lib/visionSmsAutomation";
import { sendTrackedInfotxtSms } from "../../../lib/visionSmsTrackedSend";
import { latestVisionCourierText, loadVisionPancakeOrders, visionArray, visionOrderStage, visionOrderValue, visionTrackingNumber } from "../../../lib/visionPancakeOrders";
import { runRecoveryStep } from "../../../lib/visionAbandonRecovery";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function authorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET || "";
  return Boolean(secret) && request.headers.get("authorization") === `Bearer ${secret}`;
}

function orderId(order: any) {
  return String(order?.id || order?.order_id || "").trim();
}

function orderCreatedMs(order: any) {
  const value = String(order?.inserted_at || order?.created_at || order?.updated_at || "");
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : NaN;
}

function orderQuantity(order: any) {
  return visionArray(order?.items).reduce((total, item: any) => total + Math.max(0, Number(item?.quantity || 0)), 0);
}

function orderLabel(order: any) {
  const names = visionArray(order?.items).map((item: any) => String(item?.product_name || item?.name || item?.variation_info?.name || "").trim()).filter(Boolean);
  return names.join(", ") || "Lakatan Saha";
}

const MK_TRIGGER_FLAG = "vision-x-saha/marketing/cron-trigger.json";

function manilaHourParts() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hour12: false }).formatToParts(new Date());
  const o = Object.fromEntries(parts.map(p => [p.type, p.value]));
  return { date: `${o.year}-${o.month}-${o.day}`, hour: Number(o.hour) };
}

// The dedicated Vercel marketing cron does not fire reliably (same plan/auth, but Vercel
// will not schedule that path). So the reliable every-10-min sms-monitor cron drives the
// two daily marketing batches: once in the 08:00 PHT hour and once in the 18:00 PHT hour,
// deduped via a per-window flag so each batch fires exactly once per day.
async function maybeTriggerMarketing(base: string): Promise<{ triggered: boolean; reason: string }> {
  try {
    const { date, hour } = manilaHourParts();
    if (hour !== 8 && hour !== 18) return { triggered: false, reason: "not a batch hour" };
    const windowKey = `${date}-${hour === 8 ? "am" : "pm"}`;
    let last = "";
    try {
      const g = await get(MK_TRIGGER_FLAG, { access: "private", useCache: false });
      if (g && g.statusCode === 200 && g.stream) last = String(JSON.parse(await new Response(g.stream).text())?.windowKey || "");
    } catch {}
    if (last === windowKey) return { triggered: false, reason: "already triggered this window" };
    const config = await loadMarketingConfig();
    if (config.activationLocked || config.mode === "off") return { triggered: false, reason: "marketing off or locked" };
    // Claim the window BEFORE sending so a repeat run cannot double-trigger.
    await put(MK_TRIGGER_FLAG, JSON.stringify({ windowKey, at: new Date().toISOString() }), { access: "private", contentType: "application/json", addRandomSuffix: false, allowOverwrite: true, cacheControlMaxAge: 0 });
    const secret = process.env.CRON_SECRET || "";
    await fetch(new URL("/api/vision-x-saha/marketing-run", base), {
      method: "POST",
      headers: { authorization: `Bearer ${secret}` },
      cache: "no-store"
    }).catch(() => {});
    return { triggered: true, reason: windowKey };
  } catch {
    return { triggered: false, reason: "error" };
  }
}

async function sendMissingOrderConfirmation(order: any, version: number) {
  const id = orderId(order);
  const phone = normalizePhilippineMobile(order?.bill_phone_number || order?.phone_number);
  if (!id || !phone) return { kind: "missing_contact" as const };
  const fullName = String(order?.bill_full_name || order?.full_name || order?.customer?.name || "Customer").trim();
  const firstName = fullName.split(/\s+/)[0] || "Customer";
  const quantity = orderQuantity(order);
  const product = orderLabel(order);
  const cod = Math.round(visionOrderValue(order));
  const result = await sendTrackedInfotxtSms({
    orderId: id,
    event: "order_confirmation",
    eventLabel: "Order confirmation",
    recipient: "customer",
    phone,
    message: `${firstName}, i-confirm ang Lakatan parcel order #${id}: ${product}${quantity ? `, ${quantity} pcs` : ""}, COD P${cod}. Reply YES kung tama o NO kung gusto i-cancel. Salamat!`,
    source: "order_confirmation",
    eventAt: `order-${id}`,
    templateVersion: version
  });
  return result.duplicate ? { kind: "duplicate" as const } : result.accepted ? { kind: "accepted" as const } : { kind: "failed" as const };
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const webhookSecret = process.env.VISION_X_SAHA_PANCAKE_WEBHOOK_SECRET || "";
  const shopId = process.env.VISION_X_SAHA_PANCAKE_SHOP_ID || "";
  if (!webhookSecret || !shopId) return NextResponse.json({ error: "SMS monitoring is not configured." }, { status: 503 });

  try {
    const [orderData, automation] = await Promise.all([loadVisionPancakeOrders(5), loadSmsAutomationConfig()]);
    const { businessOrders } = orderData;
    const now = Date.now();
    const configuredLiveSince = Date.parse(automation.updatedAt || "");
    const liveSince = Number.isFinite(configuredLiveSince) ? configuredLiveSince : now - 2 * 60 * 60 * 1000;
    const openOrders = businessOrders.filter(order => !["delivered", "returned", "cancelled"].includes(visionOrderStage(order, latestVisionCourierText(order))));
    const newOrderCandidates = automation.mode === "live"
      ? openOrders.filter(order => {
        if (order.is_abandoned_order) return false; // abandoned go to recovery, not confirmation
        const createdAt = orderCreatedMs(order);
        return Number.isFinite(createdAt) && createdAt >= liveSince && createdAt <= now;
      }).slice(0, 100)
      : [];
    let confirmationAccepted = 0;
    let confirmationDuplicates = 0;
    let confirmationFailed = 0;
    let confirmationMissingContact = 0;
    for (const order of newOrderCandidates) {
      try {
        const outcome = await sendMissingOrderConfirmation(order, automation.version);
        if (outcome.kind === "accepted") confirmationAccepted += 1;
        else if (outcome.kind === "duplicate") confirmationDuplicates += 1;
        else if (outcome.kind === "missing_contact") confirmationMissingContact += 1;
        else confirmationFailed += 1;
      } catch {
        confirmationFailed += 1;
      }
    }

    // Abandoned recovery: Mel runs the 7-day escalating-discount sequence (live only).
    let recoverySent = 0;
    let recoverySkipped = 0;
    if (automation.mode === "live") {
      const windowMs = 8 * 24 * 60 * 60 * 1000; // 7-day sequence + a day of slack
      const abandoned = businessOrders.filter(order => {
        // Only TRULY abandoned carts (status 0, new). The is_abandoned flag can
        // linger on orders that later shipped — never text those.
        if (!order.is_abandoned_order || order.is_removed || Number(order.status) !== 0) return false;
        const createdAt = orderCreatedMs(order);
        return Number.isFinite(createdAt) && (now - createdAt) <= windowMs;
      }).slice(0, 100);
      for (const order of abandoned) {
        try {
          const step = await runRecoveryStep(order);
          if (step.outcome === "sent") recoverySent += 1;
          else recoverySkipped += 1;
        } catch {
          recoverySkipped += 1;
        }
      }
    }

    const candidates = businessOrders.filter(order => {
      const stage = visionOrderStage(order, latestVisionCourierText(order));
      return Boolean(visionTrackingNumber(order)) && !["delivered", "returned", "cancelled"].includes(stage);
    }).slice(0, 150);

    await recordSmsWebhookHeartbeat({
      orderId: "monitor",
      shopId,
      movementCount: candidates.length,
      source: "scheduled_reconciliation"
    });

    let processed = 0;
    let failed = 0;
    const endpoint = new URL("/api/vision-x-saha/pancake-webhook", process.env.NODE_ENV === "production" ? "https://www.kradigital.site" : request.nextUrl.origin);

    for (let index = 0; index < candidates.length; index += 3) {
      const batch = candidates.slice(index, index + 3);
      const results = await Promise.all(batch.map(async order => {
        try {
          const response = await fetch(endpoint, {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "x-vision-saha-monitor": "1",
              "x-vision-saha-webhook-secret": webhookSecret
            },
            body: JSON.stringify({ order_id: String(order.id || order.order_id), shop_id: shopId }),
            cache: "no-store"
          });
          return response.ok;
        } catch {
          return false;
        }
      }));
      processed += results.filter(Boolean).length;
      failed += results.filter(result => !result).length;
      if (index + 3 < candidates.length) await new Promise(resolve => setTimeout(resolve, 400));
    }

    const statuses = await refreshInfotxtOutboundRecords(200, 0);

    // Drive the marketing batches from this reliable cron (8am + 6pm PHT, once each).
    const marketingBase = process.env.NODE_ENV === "production" ? "https://www.kradigital.site" : request.nextUrl.origin;
    const marketingTrigger = await maybeTriggerMarketing(marketingBase);

    return NextResponse.json({
      checkedAt: new Date().toISOString(),
      automationMode: automation.mode,
      marketingTrigger,
      newOrdersChecked: newOrderCandidates.length,
      confirmationAccepted,
      confirmationDuplicates,
      confirmationFailed,
      confirmationMissingContact,
      recoverySent,
      recoverySkipped,
      candidates: candidates.length,
      processed,
      failed,
      providerRecords: statuses.length
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "SMS monitoring failed." }, { status: 502 });
  }
}

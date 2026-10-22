import { createHash, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  loadSmsAutomationConfig,
  loadSmsAutomationLogs,
  maskSmsPhone,
  recordSmsWebhookHeartbeat,
  recordSmsAutomationLog,
  renderSmsTemplate,
  SmsRecipient,
  updateSmsAutomationLog
} from "../../../lib/visionSmsAutomation";
import { sendInfotxtSms } from "../../../lib/visionInfotxt";
import { recordInfotxtOutbound } from "../../../lib/visionInfotxtRecords";
import { recordOrderDeliveryEvents } from "../../../lib/visionOrderOperations";

export const dynamic = "force-dynamic";

function hhmmToMinutes(value: string) {
  const match = /^(\d{2}):(\d{2})$/.exec(value || "");
  return match ? Number(match[1]) * 60 + Number(match[2]) : 0;
}

function phtNowMinutes() {
  const pht = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Manila" }));
  return pht.getHours() * 60 + pht.getMinutes();
}

// Quiet window can wrap past midnight (e.g. 20:30 -> 07:00).
function isQuietHours(quietStart: string, quietEnd: string, nowMinutes: number) {
  const start = hhmmToMinutes(quietStart);
  const end = hhmmToMinutes(quietEnd);
  return start <= end ? (nowMinutes >= start && nowMinutes < end) : (nowMinutes >= start || nowMinutes < end);
}

function phtDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
  } catch {
    return "";
  }
}

// Parse a courier timestamp to epoch ms. Bare "YYYY-MM-DD HH:MM:SS" values from
// Pancake are Manila local time; ISO strings carry their own offset.
function parseCourierMs(value: string) {
  if (!value) return NaN;
  if (/[zZ]|[+-]\d{2}:?\d{2}$/.test(value)) return Date.parse(value);
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value);
  if (m) return Date.parse(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6] || "00"}+08:00`);
  return Date.parse(value);
}

const PANCAKE_API = "https://pos.pages.fm/api/v1";
const PRIVATE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  "X-Robots-Tag": "noindex, nofollow, noarchive"
};

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: PRIVATE_HEADERS });
}

function text(value: unknown): string {
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value).trim();
  if (!value || typeof value !== "object") return "";
  const row = value as Record<string, unknown>;
  for (const key of ["text", "description", "detail", "message", "note", "status", "title", "remark", "reason"]) {
    const nested = text(row[key]);
    if (nested) return nested;
  }
  return "";
}

function array(value: unknown): any[] {
  return Array.isArray(value) ? value : [];
}

function numberValue(value: unknown) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function secureEqual(left: string, right: string) {
  const leftHash = createHash("sha256").update(left).digest();
  const rightHash = createHash("sha256").update(right).digest();
  return timingSafeEqual(leftHash, rightHash);
}

function orderValue(order: any) {
  const raw = numberValue(order?.cod || order?.total_price_after_sub_discount || order?.total_price);
  return raw > 10000 ? raw / 100 : raw;
}

function itemName(item: any) {
  return text(item?.product_name || item?.name || item?.variation_info?.name || item?.variation_info?.product_display_id || "Product");
}

function productQuantity(order: any) {
  return array(order?.items).reduce((sum, item) => /grow na na|agri item 3|fertilizer|soil/i.test(itemName(item)) ? sum : sum + Math.max(0, numberValue(item?.quantity)), 0);
}

function trackingNumber(order: any) {
  return text(order?.partner?.extend_code || order?.partner?.tracking_number || order?.tracking_number);
}

function eventTime(update: any, order: any, index: number) {
  return text(update?.update_at || update?.updated_at || update?.event_time || update?.status_time || update?.created_at || update?.inserted_at || update?.timestamp || update?.time || update?.date || order?.updated_at || order?.inserted_at || `movement-${index}`);
}

function eventDetails(update: any) {
  const title = text(update?.status || update?.title || update?.event || update?.description || update?.message || update?.note || "Courier movement");
  const note = text(update?.note || update?.remark || update?.reason || update?.message);
  return { title, note, combined: `${title} ${note}`.trim() };
}

function classifyEvent(update: any, previouslyFailed: boolean) {
  const details = eventDetails(update);
  const value = details.combined.toLowerCase();
  if (/return registration|returning|return to sender|\brts\b|returned/.test(value)) return "return_registered";
  if (/delivery failed|failed delivery|unsuccessful|reject|refus|undeliver|unable to deliver/.test(value)) return "failed";
  if (/delivered|received by consignee|successfully delivered/.test(value)) return "delivered";
  if (/delivering|out for delivery/.test(value)) return previouslyFailed ? "redelivery" : "out_for_delivery";
  if (/pickup|picked up|collected/.test(value)) return "pickup";
  if (/arrival|arrived/.test(value)) return "arrival";
  if (/departure|departed/.test(value)) return "departure";
  return "movement";
}

async function fetchPancakeOrder(orderId: string, apiKey: string, shopId: string) {
  const params = new URLSearchParams({ api_key: apiKey });
  const response = await fetch(`${PANCAKE_API}/shops/${encodeURIComponent(shopId)}/orders/${encodeURIComponent(orderId)}?${params}`, { cache: "no-store" });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body?.error) throw new Error(body?.error?.message || body?.message || `Pancake returned ${response.status}.`);
  return body?.data || body;
}

function findOrderId(payload: any) {
  const candidates = [payload?.data?.id, payload?.data?.order_id, payload?.order?.id, payload?.order_id, payload?.id];
  return candidates.map(text).find(value => /^[A-Za-z0-9_-]{1,80}$/.test(value)) || "";
}

function findShopId(payload: any) {
  return text(payload?.shop_id || payload?.data?.shop_id || payload?.order?.shop_id);
}

function variablesFor(order: any, update: any, movementNumber: number) {
  const customerName = text(order?.bill_full_name || order?.full_name || order?.customer?.name || "Customer");
  const details = eventDetails(update);
  return {
    customer: customerName.split(/\s+/)[0] || "Customer",
    order_id: text(order?.id || order?.order_id || "N/A"),
    tracking: trackingNumber(order) || "Not assigned",
    cod: orderValue(order).toLocaleString("en-PH", { maximumFractionDigits: 2 }),
    quantity: productQuantity(order),
    address: text(order?.shipping_address || order?.bill_address || "See Pancake POS"),
    landmark: text(order?.landmark || order?.shipping_address || "See Pancake POS"),
    rider: text(order?.partner?.delivery_name || "Assigned rider"),
    movement_no: movementNumber,
    courier_status: details.title || "Courier movement",
    failure_reason: details.note || text(order?.returned_reason || order?.sub_status_name || "Courier did not provide a detailed reason")
  };
}

export async function POST(request: NextRequest) {
  const secret = process.env.VISION_X_SAHA_PANCAKE_WEBHOOK_SECRET?.trim() || "";
  const apiKey = process.env.VISION_X_SAHA_PANCAKE_API_KEY?.trim() || "";
  const shopId = process.env.VISION_X_SAHA_PANCAKE_SHOP_ID?.trim() || "";
  if (!secret || !apiKey || !shopId) return json({ error: "The Pancake webhook is not configured." }, 503);
  const suppliedSecret = request.headers.get("x-vision-saha-webhook-secret") || request.nextUrl.searchParams.get("key") || "";
  if (!suppliedSecret || !secureEqual(suppliedSecret, secret)) return json({ error: "Unauthorized webhook." }, 401);
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > 256 * 1024) return json({ error: "Webhook payload is too large." }, 413);

  let payload: any;
  try {
    payload = await request.json();
  } catch {
    return json({ error: "Invalid webhook payload." }, 400);
  }

  const payloadShopId = findShopId(payload);
  if (payloadShopId && payloadShopId !== shopId) return json({ error: "Webhook shop does not match VISION X SAHA." }, 403);
  const orderId = findOrderId(payload);
  if (!orderId) return json({ error: "Webhook did not include a valid order ID." }, 400);

  try {
    const [order, config] = await Promise.all([fetchPancakeOrder(orderId, apiKey, shopId), loadSmsAutomationConfig()]);
    const scheduledReconciliation = request.headers.get("x-vision-saha-monitor") === "1";
    const auditRiderPhone = text(order?.partner?.delivery_tel);
    // Courier evidence remains available even while outbound SMS is paused.
    // Scheduled reconciliation checks only final-mile orders to bound Blob usage.
    if (!scheduledReconciliation || auditRiderPhone) {
      try {
        await recordOrderDeliveryEvents(order);
      } catch (error) {
        console.error("VISION X SAHA delivery audit failed", error instanceof Error ? error.message : "Unknown error");
      }
    }
    if (config.mode === "paused") return json({ accepted: true, mode: "paused", created: 0, duplicates: 0, skipped: 0, sent: 0 });

    const live = config.mode === "live";
    const tracking = trackingNumber(order);
    const canonicalOrderId = text(order?.id || order?.order_id || orderId);
    const customerPhone = text(order?.bill_phone_number || order?.phone_number);
    const riderPhone = auditRiderPhone;
    const rawUpdates = array(order?.partner?.extend_update);
    const updates = (rawUpdates.length ? rawUpdates : [{ status: "Tracking created", update_at: text(order?.time_send_partner || order?.updated_at || order?.inserted_at) }])
      .map((update, index) => ({ update, originalIndex: index, time: parseCourierMs(eventTime(update, order, index)) }))
      .sort((left, right) => (Number.isFinite(left.time) ? left.time : left.originalIndex) - (Number.isFinite(right.time) ? right.time : right.originalIndex));
    await recordSmsWebhookHeartbeat({
      orderId: canonicalOrderId,
      shopId,
      movementCount: updates.length,
      source: scheduledReconciliation ? "scheduled_reconciliation" : "pancake_webhook"
    });

    let failedBefore = false;
    const classified = updates.map((row, index) => {
      const event = rawUpdates.length ? classifyEvent(row.update, failedBefore) : "tracking_created";
      if (event === "failed") failedBefore = true;
      return { ...row, event, movementNumber: index + 1 };
    });
    const terminalEvents = new Set(["delivered", "failed", "return_registered"]);
    const work: Array<{ update: any; event: string; movementNumber: number }> = [];
    classified.forEach((row, index) => {
      work.push({ update: row.update, event: row.event, movementNumber: row.movementNumber });
      if (row.event !== "out_for_delivery") return;
      const resolvedLater = classified.slice(index + 1).some(candidate => terminalEvents.has(candidate.event));
      if (!resolvedLater) {
        work.push({ update: row.update, event: "no_result_30", movementNumber: row.movementNumber });
        work.push({ update: row.update, event: "no_result_60", movementNumber: row.movementNumber });
        work.push({ update: row.update, event: "no_result_90", movementNumber: row.movementNumber });
      }
    });

    // Live-mode guards: go-live cutoff + quiet hours + per-order daily cap.
    // Only events that happened AFTER the automation was switched to live send,
    // so existing in-transit orders never get a backlog blast of past events.
    const quiet = live && isQuietHours(config.quietStart, config.quietEnd, phtNowMinutes());
    const parsedLiveSince = Date.parse(config.updatedAt || "");
    const liveSinceMs = Number.isFinite(parsedLiveSince) ? parsedLiveSince : Date.now() - 2 * 60 * 60 * 1000;
    const sentToday: Record<SmsRecipient, number> = { customer: 0, rider: 0 };
    // The scheduled monitor replays up to 150 orders every ten minutes. Loading
    // every audit record for each replay multiplied one cron run into as many as
    // 150,000 private Blob reads. Exact-event idempotency is still enforced by
    // recordSmsAutomationLog, while live Pancake webhooks retain the historical
    // scan used for daily-cap and cooldown checks.
    let existingLogs = scheduledReconciliation ? [] : await loadSmsAutomationLogs(1000);
    if (live) {
      const today = phtDate(new Date().toISOString());
      for (const row of existingLogs) {
        if (row.orderId !== canonicalOrderId) continue;
        if (!["submitting", "accepted", "queued", "dispatched", "sent"].includes(row.status)) continue;
        if (phtDate(row.createdAt) !== today) continue;
        if (row.recipient === "customer") sentToday.customer += 1;
        else if (row.recipient === "rider") sentToday.rider += 1;
      }
    }

    let created = 0;
    let duplicates = 0;
    let skipped = 0;
    let sent = 0;

    for (const item of work) {
      const update = item.update;
      const event = item.event;
      const rule = config.rules.find(candidate => candidate.id === event);
      if (!rule || !rule.enabled) continue;
      const variables = variablesFor(order, update, item.movementNumber);
      const eventAtValue = eventTime(update, order, item.movementNumber - 1);
      const eventMs = parseCourierMs(eventAtValue);
      const preLive = live && (!Number.isFinite(eventMs) || eventMs < liveSinceMs);
      const dueAtMs = Number.isFinite(eventMs) ? eventMs + rule.delayMinutes * 60_000 : Date.now();
      const waitingForDelay = live && Date.now() < dueAtMs;
      const recipients: Array<{ recipient: SmsRecipient; enabled: boolean; phone: string; template: string }> = [
        { recipient: "customer", enabled: rule.customer, phone: customerPhone, template: rule.customerTemplate },
        { recipient: "rider", enabled: rule.rider, phone: riderPhone, template: rule.riderTemplate }
      ];
      for (const target of recipients) {
        if (!target.enabled) continue;
        const rendered = renderSmsTemplate(target.template, variables);
        const dailyCap = target.recipient === "customer" ? config.customerDailyLimit : config.riderDailyLimit;

        // Decide the plan BEFORE claiming the audit record so duplicate webhooks never re-send.
        let plannedStatus: "dry_run" | "skipped" | "scheduled" | "submitting";
        let reason: string;
        if (!target.phone) {
          plannedStatus = "skipped";
          reason = `${target.recipient === "rider" ? "Rider" : "Customer"} phone is unavailable.`;
        } else if (!live) {
          plannedStatus = "dry_run";
          reason = `Dry run only; would send after ${rule.delayMinutes} minute(s).`;
        } else if (preLive) {
          plannedStatus = "skipped";
          reason = "Event occurred before automation went live; not sent.";
        } else if (waitingForDelay) {
          plannedStatus = "scheduled";
          reason = `Scheduled after the ${rule.delayMinutes} minute delay.`;
        } else if (quiet) {
          plannedStatus = "scheduled";
          reason = `Waiting for quiet hours (${config.quietStart} to ${config.quietEnd}) to end.`;
        } else if (sentToday[target.recipient] >= dailyCap) {
          plannedStatus = "skipped";
          reason = `Daily limit of ${dailyCap} reached for this order.`;
        } else if (rule.cooldownMinutes > 0 && existingLogs.some(row => row.orderId === canonicalOrderId
          && row.event === event
          && row.recipient === target.recipient
          && ["submitting", "accepted", "queued", "dispatched", "sent"].includes(row.status)
          && Date.now() - Date.parse(row.updatedAt || row.createdAt) < rule.cooldownMinutes * 60_000)) {
          plannedStatus = "skipped";
          reason = `Cooldown of ${rule.cooldownMinutes} minutes is still active.`;
        } else {
          plannedStatus = "submitting";
          reason = "Submitting to InfoTXT.";
        }

        const result = await recordSmsAutomationLog({
          orderId: canonicalOrderId,
          tracking,
          event,
          eventLabel: rule.label,
          recipient: target.recipient,
          destinationMasked: maskSmsPhone(target.phone),
          status: plannedStatus,
          message: rendered ? "Message generated; content not retained in the audit log." : "",
          reason,
          source: "courier_automation",
          templateVersion: config.version,
          eventAt: eventAtValue
        });

        if (!result.created) {
          if (result.record.status !== "scheduled" || plannedStatus !== "submitting") { duplicates += 1; continue; }
          await updateSmsAutomationLog(result.record.id, { status: "submitting", reason: "Scheduled reminder is now due and is being submitted to InfoTXT." });
        } else {
          created += 1;
          existingLogs = [result.record, ...existingLogs];
        }
        if (plannedStatus === "skipped") { skipped += 1; continue; }
        if (plannedStatus === "dry_run" || plannedStatus === "scheduled") continue;
        if (plannedStatus === "submitting") {
          sentToday[target.recipient] += 1;
          try {
            const outcome = await sendInfotxtSms(target.phone, rendered);
            if (outcome.accepted) {
              sent += 1;
              if (outcome.smsId) {
                await recordInfotxtOutbound({
                  providerSmsId: outcome.smsId,
                  source: "courier_automation",
                  auditId: result.record.id,
                  orderId: canonicalOrderId,
                  tracking,
                  eventLabel: rule.label,
                  recipient: target.recipient,
                  destinationMasked: maskSmsPhone(target.phone),
                  message: rendered,
                  submittedAt: new Date().toISOString()
                });
              }
              await updateSmsAutomationLog(result.record.id, {
                status: "accepted",
                providerSmsId: outcome.smsId,
                providerCode: outcome.providerStatus,
                providerStatus: "queued",
                acceptedAt: new Date().toISOString(),
                reason: `InfoTXT accepted the SMS${outcome.smsId ? ` (ID ${outcome.smsId})` : ""}; handset delivery is not confirmed.`
              });
            } else {
              await updateSmsAutomationLog(result.record.id, { status: "failed", providerCode: outcome.providerStatus, providerStatus: "failed", reason: outcome.error });
            }
          } catch (error) {
            await updateSmsAutomationLog(result.record.id, { status: "failed", reason: error instanceof Error ? error.message : "InfoTXT submission failed." });
          }
        }
      }
    }

    return json({ accepted: true, mode: config.mode, created, duplicates, skipped, sent });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "The courier event could not be processed." }, 502);
  }
}

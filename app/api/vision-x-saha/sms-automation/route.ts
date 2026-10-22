import { NextRequest, NextResponse } from "next/server";
import { loadSmsConfigView } from "../../../lib/visionSmsConfig";
import {
  loadSmsAutomationConfig,
  loadSmsAutomationLogs,
  loadSmsWebhookHeartbeat,
  maskSmsPhone,
  renderSmsTemplate,
  saveSmsAutomationConfig
} from "../../../lib/visionSmsAutomation";
import { loadInfotxtInboundRecords, loadInfotxtOutboundRecords, outboundView } from "../../../lib/visionInfotxtRecords";
import { latestVisionCourierText, loadVisionPancakeOrders, visionOrderStage } from "../../../lib/visionPancakeOrders";
import { loadMarketingEvents } from "../../../lib/visionMarketingEngine";

export const dynamic = "force-dynamic";

const PANCAKE_API = "https://pos.pages.fm/api/v1";
const PRIVATE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  "X-Robots-Tag": "noindex, nofollow, noarchive"
};
const COOKIE_NAME = "vision_x_saha_access";

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: PRIVATE_HEADERS });
}

function text(value: unknown) {
  return typeof value === "string" || typeof value === "number" ? String(value).trim() : "";
}

function array(value: unknown): any[] {
  return Array.isArray(value) ? value : [];
}

function numberValue(value: unknown) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function orderValue(order: any) {
  const raw = numberValue(order.cod || order.total_price_after_sub_discount || order.total_price);
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

function operatorLabel(request: NextRequest) {
  const token = request.cookies.get(COOKIE_NAME)?.value || "";
  if (token && token === process.env.VISION_X_SAHA_RUSTAN_ACCESS_TOKEN) return "rustan";
  if (token && token === process.env.VISION_X_SAHA_DASHBOARD_ACCESS_TOKEN) return "kevin";
  return "vision-x-saha";
}

function sameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!origin || !host) return true;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

function collapseLegacyManualTests(logs: any[]) {
  const grouped = new Map<string, any>();
  for (const log of logs) {
    const key = log.event === "manual_test" ? `${log.orderId}|${log.recipient}` : log.id;
    const current = grouped.get(key);
    const score = (row: any) => row.status === "failed" ? 6
      : row.providerSmsId ? 5
        : /InfoTXT accepted.*ID \d+/i.test(row.reason || "") ? 4
          : ["dispatched", "sent", "accepted"].includes(row.status) ? 3
            : row.status === "submitting" ? 2
              : 1;
    if (!current || score(log) >= score(current)) grouped.set(key, log);
  }
  return [...grouped.values()].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

function pct(part: number, total: number) {
  return total > 0 ? Math.round(part / total * 1000) / 10 : 0;
}

function phtDay(value: string) {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value));
  } catch {
    return "";
  }
}

function buildAnalytics(logs: any[], outbound: any[], inbound: any[], heartbeat: any, orders: any[], expiresAt?: string | null) {
  const now = Date.now();
  const dayMs = 86_400_000;
  const submittedStatuses = new Set(["submitting", "accepted", "queued", "dispatched", "sent", "failed"]);
  const acceptedStatuses = new Set(["accepted", "queued", "dispatched", "sent"]);
  const dispatchedStatuses = new Set(["dispatched", "sent"]);
  const lastDays = (days: number) => logs.filter(row => now - Date.parse(row.createdAt) <= days * dayMs);
  const last24 = lastDays(1);
  const submitted = logs.filter(row => submittedStatuses.has(row.status));
  const accepted = logs.filter(row => acceptedStatuses.has(row.status));
  const dispatched = logs.filter(row => dispatchedStatuses.has(row.status));
  const failed = logs.filter(row => row.status === "failed");
  const skipped = logs.filter(row => row.status === "skipped");
  const scheduled = logs.filter(row => row.status === "scheduled");
  const replies = inbound.filter(row => row.isCustomer);
  const replyOrders = new Set(replies.map(row => String(row.orderId || "")).filter(Boolean));
  const messagedCustomerOrders = new Set(accepted
    .filter(row => row.recipient === "customer")
    .map(row => String(row.orderId || ""))
    .filter(id => id && !id.startsWith("manual-") && !id.startsWith("lead-")));
  const repliedMessagedOrders = [...replyOrders].filter(orderId => messagedCustomerOrders.has(orderId)).length;
  const messagedOrders = new Set(accepted.map(row => String(row.orderId || "")).filter(id => id && !id.startsWith("manual-") && !id.startsWith("lead-")));
  const orderRows = orders.map(order => ({ id: String(order.id || order.order_id || ""), stage: visionOrderStage(order, latestVisionCourierText(order)) }));
  const withSms = orderRows.filter(row => messagedOrders.has(row.id));
  const withoutSms = orderRows.filter(row => !messagedOrders.has(row.id));
  const deliveredCount = (rows: any[]) => rows.filter(row => row.stage === "delivered").length;
  const riskCount = (rows: any[]) => rows.filter(row => ["failed_delivery", "returning", "returned"].includes(row.stage)).length;

  const byRecipient = ["customer", "rider"].map(recipient => {
    const rows = logs.filter(row => row.recipient === recipient);
    const sentRows = rows.filter(row => submittedStatuses.has(row.status));
    const acceptedRows = rows.filter(row => acceptedStatuses.has(row.status));
    const dispatchedRows = rows.filter(row => dispatchedStatuses.has(row.status));
    return { recipient, attempts: rows.length, submitted: sentRows.length, accepted: acceptedRows.length, dispatched: dispatchedRows.length, failed: rows.filter(row => row.status === "failed").length, dispatchRate: pct(dispatchedRows.length, acceptedRows.length) };
  });

  const eventMap = new Map<string, any>();
  for (const row of logs) {
    const key = `${row.eventLabel || row.event}|${row.recipient}`;
    const current = eventMap.get(key) || { event: row.eventLabel || row.event, recipient: row.recipient, attempts: 0, submitted: 0, accepted: 0, dispatched: 0, failed: 0, segments: 0 };
    current.attempts += 1;
    if (submittedStatuses.has(row.status)) current.submitted += 1;
    if (acceptedStatuses.has(row.status)) current.accepted += 1;
    if (dispatchedStatuses.has(row.status)) current.dispatched += 1;
    if (row.status === "failed") current.failed += 1;
    current.segments += Number(row.segments || 0);
    eventMap.set(key, current);
  }
  const templates = [...eventMap.values()].map(row => ({ ...row, dispatchRate: pct(row.dispatched, row.accepted) })).sort((a, b) => b.attempts - a.attempts);

  const trend = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(now - (6 - index) * dayMs);
    const day = phtDay(date.toISOString());
    const rows = logs.filter(row => phtDay(row.createdAt) === day);
    return { day, submitted: rows.filter(row => submittedStatuses.has(row.status)).length, dispatched: rows.filter(row => dispatchedStatuses.has(row.status)).length, failed: rows.filter(row => row.status === "failed").length, replies: replies.filter(row => phtDay(row.receivedAt || row.storedAt) === day).length };
  });

  const queuedAttention = outbound.filter(row => row.gatewayAttention).length;
  const expiryMs = expiresAt ? Date.parse(`${expiresAt}T23:59:59+08:00`) - now : NaN;
  const expiryDays = Number.isFinite(expiryMs) ? Math.ceil(expiryMs / dayMs) : null;
  const heartbeatAgeMinutes = heartbeat?.lastReceivedAt ? Math.floor((now - Date.parse(heartbeat.lastReceivedAt)) / 60_000) : null;
  const alerts: Array<{ tone: "bad" | "warn" | "good"; title: string; copy: string }> = [];
  if (queuedAttention) alerts.push({ tone: "bad", title: `${queuedAttention} SMS need gateway attention`, copy: "InfoTXT still reports these messages as queued after 10 minutes." });
  if (expiryDays !== null && expiryDays <= 14) alerts.push({ tone: expiryDays <= 3 ? "bad" : "warn", title: `InfoTXT credentials expire in ${Math.max(0, expiryDays)} day(s)`, copy: `Renew before ${expiresAt} to prevent sending interruptions.` });
  if (!heartbeat) alerts.push({ tone: "bad", title: "No courier receiver heartbeat", copy: "No Pancake webhook or scheduled reconciliation has reached Mel yet." });
  else if (heartbeatAgeMinutes !== null && heartbeatAgeMinutes > 15) alerts.push({ tone: "warn", title: `Courier sync is ${heartbeatAgeMinutes} minutes old`, copy: "The scheduled reconciliation should normally run every 10 minutes." });
  const recentFailures = last24.filter(row => row.status === "failed").length;
  if (recentFailures) alerts.push({ tone: "bad", title: `${recentFailures} SMS failed in the last 24 hours`, copy: "Open Private Audit to review the provider reason." });
  const missingContacts = last24.filter(row => /phone is unavailable/i.test(row.reason || "")).length;
  if (missingContacts) alerts.push({ tone: "warn", title: `${missingContacts} missing contact(s)`, copy: "These rules could not send because the customer or rider number was unavailable." });
  if (!alerts.length) alerts.push({ tone: "good", title: "No active SMS alerts", copy: "Provider, courier sync, and recent automation records look healthy." });

  const pricePerSegment = Number(process.env.INFOTXT_COST_PER_SEGMENT_PHP || 0);
  const segments = submitted.reduce((sum, row) => sum + Math.max(1, Number(row.segments || 1)), 0);
  const confirmations = replies.filter(row => /^(yes|y|oo|ok|okay|sige|confirm|confirmed|g|go|tama|opo)\b/i.test(String(row.sms || "").trim())).length;
  const cancellations = replies.filter(row => /^(no|n|hindi|di|ayaw|cancel|wag|huwag)\b/i.test(String(row.sms || "").trim())).length;
  const deliveryRequests = replies.filter(row => /deliver|delivery|rider|oras|time|schedule|resched|bukas|mamaya/i.test(String(row.sms || ""))).length;
  const aiReplies = logs.filter(row => row.source === "ai_reply" && acceptedStatuses.has(row.status)).length;

  return {
    generatedAt: new Date().toISOString(),
    recordsAnalyzed: { audit: logs.length, outbound: outbound.length, inbound: inbound.length, orders: orderRows.length },
    overview: {
      attempts: logs.length,
      submitted: submitted.length,
      accepted: accepted.length,
      dispatched: dispatched.length,
      failed: failed.length,
      skipped: skipped.length,
      scheduled: scheduled.length,
      customerReplies: replies.length,
      replyRate: pct(repliedMessagedOrders, messagedCustomerOrders.size),
      dispatchRate: pct(dispatched.length, accepted.length),
      segments,
      estimatedCost: pricePerSegment > 0 ? Math.round(segments * pricePerSegment * 100) / 100 : null
    },
    periods: { today: last24.length, sevenDays: lastDays(7).length, thirtyDays: lastDays(30).length },
    funnel: [
      { label: "Rule decisions", value: logs.length },
      { label: "Contact available", value: logs.filter(row => !/phone is unavailable/i.test(row.reason || "")).length },
      { label: "Submitted", value: submitted.length },
      { label: "Accepted", value: accepted.length },
      { label: "Dispatched", value: dispatched.length },
      { label: "Customer replied", value: replyOrders.size },
      { label: "Order delivered", value: deliveredCount(withSms) }
    ],
    byRecipient,
    templates,
    trend,
    conversations: { confirmations, cancellations, deliveryRequests, aiReplies, customerReplies: replies.length },
    outcomes: {
      withSms: { orders: withSms.length, delivered: deliveredCount(withSms), deliveryRate: pct(deliveredCount(withSms), withSms.length), risk: riskCount(withSms) },
      withoutSms: { orders: withoutSms.length, delivered: deliveredCount(withoutSms), deliveryRate: pct(deliveredCount(withoutSms), withoutSms.length), risk: riskCount(withoutSms) },
      note: "This comparison is observational. It does not prove SMS caused the delivery outcome."
    },
    freshness: {
      lastAuditAt: logs[0]?.updatedAt || logs[0]?.createdAt || "",
      lastProviderCheck: outbound.map(row => row.lastCheckedAt).filter(Boolean).sort().at(-1) || "",
      lastInboundAt: inbound.map(row => row.receivedAt || row.storedAt).filter(Boolean).sort().at(-1) || "",
      lastCourierSync: heartbeat?.lastReceivedAt || "",
      courierSyncSource: heartbeat?.source || ""
    },
    alerts
  };
}

async function fetchPancakeOrder(orderId: string) {
  const apiKey = process.env.VISION_X_SAHA_PANCAKE_API_KEY;
  const shopId = process.env.VISION_X_SAHA_PANCAKE_SHOP_ID;
  if (!apiKey || !shopId) throw new Error("Pancake POS access is not configured.");
  const params = new URLSearchParams({ api_key: apiKey });
  const response = await fetch(`${PANCAKE_API}/shops/${encodeURIComponent(shopId)}/orders/${encodeURIComponent(orderId)}?${params}`, { cache: "no-store" });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body?.error) throw new Error(body?.error?.message || body?.message || `Pancake returned ${response.status}.`);
  return body?.data || body;
}

function previewVariables(order: any) {
  const fullName = text(order?.bill_full_name || order?.full_name || order?.customer?.name || "Customer");
  return {
    customer: fullName.split(/\s+/)[0] || "Customer",
    order_id: text(order?.id || order?.order_id || "N/A"),
    tracking: trackingNumber(order) || "Not assigned",
    cod: orderValue(order).toLocaleString("en-PH", { maximumFractionDigits: 2 }),
    quantity: productQuantity(order),
    address: text(order?.shipping_address || order?.bill_address || "See Pancake POS"),
    landmark: text(order?.landmark || order?.shipping_address || "See Pancake POS"),
    rider: text(order?.partner?.delivery_name || "Assigned rider"),
    movement_no: Math.max(1, array(order?.partner?.extend_update).length),
    courier_status: text(order?.status_name || order?.status || "Courier update"),
    failure_reason: text(order?.returned_reason || order?.sub_status_name || "Courier did not provide a detailed reason")
  };
}

function parseCourierMs(value: string) {
  if (!value) return NaN;
  if (/[zZ]|[+-]\d{2}:?\d{2}$/.test(value)) return Date.parse(value);
  const match = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value);
  if (match) return Date.parse(`${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6] || "00"}+08:00`);
  return Date.parse(value);
}

function courierEventTime(update: any, order: any, index: number) {
  return text(update?.update_at || update?.updated_at || update?.event_time || update?.status_time || update?.created_at || update?.inserted_at || update?.timestamp || update?.time || update?.date || order?.updated_at || order?.inserted_at || `movement-${index}`);
}

function courierEventDetails(update: any) {
  const title = text(update?.status || update?.title || update?.event || update?.description || update?.message || update?.note || "Courier movement");
  const note = text(update?.note || update?.remark || update?.reason || update?.message);
  return { title, note, combined: `${title} ${note}`.trim() };
}

function classifyCourierEvent(update: any, previouslyFailed: boolean) {
  const value = courierEventDetails(update).combined.toLowerCase();
  if (/return registration|returning|return to sender|\brts\b|returned/.test(value)) return "return_registered";
  if (/delivery failed|failed delivery|unsuccessful|reject|refus|undeliver|unable to deliver/.test(value)) return "failed";
  if (/delivered|received by consignee|successfully delivered/.test(value)) return "delivered";
  if (/delivering|out for delivery/.test(value)) return previouslyFailed ? "redelivery" : "out_for_delivery";
  if (/pickup|picked up|collected/.test(value)) return "pickup";
  if (/arrival|arrived/.test(value)) return "arrival";
  if (/departure|departed/.test(value)) return "departure";
  return "movement";
}

function enrichSmsLogs(rawLogs: any[], outboundRecords: any[]) {
  const providerByAudit = new Map(outboundRecords.filter(row => row.auditId).map(row => [row.auditId, row]));
  const providerById = new Map(outboundRecords.map(row => [row.providerSmsId, row]));
  return collapseLegacyManualTests(rawLogs).map(log => {
    const reasonId = String(log.reason || "").match(/\(ID (\d{1,30})\)/i)?.[1] || "";
    const providerRecord: any = providerByAudit.get(log.id) || providerById.get(log.providerSmsId || reasonId);
    if (!providerRecord) return log;
    const status = providerRecord.providerStatus === "sent" ? "dispatched" : providerRecord.providerStatus === "failed" ? "failed" : "accepted";
    return {
      ...log,
      status,
      providerSmsId: providerRecord.providerSmsId,
      providerCode: providerRecord.providerCode,
      providerStatus: providerRecord.providerStatus,
      lastCheckedAt: providerRecord.lastCheckedAt,
      dispatchedAt: providerRecord.providerStatus === "sent" ? providerRecord.lastCheckedAt : log.dispatchedAt,
      reason: providerRecord.providerStatus === "sent"
        ? "InfoTXT dispatched the SMS. Handset delivery is not confirmed."
        : providerRecord.providerStatus === "failed"
          ? providerRecord.lastError || "InfoTXT marked the SMS as failed."
          : "InfoTXT accepted the SMS and it is still queued for dispatch."
    };
  });
}

function buildOrderSmsProof(order: any, config: any, logs: any[]) {
  const now = Date.now();
  const canonicalOrderId = text(order?.id || order?.order_id);
  const orderLogs = logs.filter(log => String(log.orderId) === canonicalOrderId);
  const rawUpdates = array(order?.partner?.extend_update);
  const sourceUpdates = rawUpdates.length
    ? rawUpdates
    : trackingNumber(order)
      ? [{ status: "Tracking created", update_at: text(order?.time_send_partner || order?.updated_at || order?.inserted_at) }]
      : [];
  const updates = sourceUpdates.map((update, originalIndex) => ({
    update,
    originalIndex,
    eventAt: courierEventTime(update, order, originalIndex),
    time: parseCourierMs(courierEventTime(update, order, originalIndex))
  })).sort((left, right) => (Number.isFinite(left.time) ? left.time : left.originalIndex) - (Number.isFinite(right.time) ? right.time : right.originalIndex));

  let failedBefore = false;
  const classified = updates.map((row, index) => {
    const event = rawUpdates.length ? classifyCourierEvent(row.update, failedBefore) : "tracking_created";
    if (event === "failed") failedBefore = true;
    return { ...row, event, movementNumber: index + 1 };
  });
  const terminalEvents = new Set(["delivered", "failed", "return_registered"]);
  const work: Array<any> = [];
  classified.forEach((row, index) => {
    work.push(row);
    if (row.event !== "out_for_delivery") return;
    const resolvedLater = classified.slice(index + 1).some(candidate => terminalEvents.has(candidate.event));
    if (!resolvedLater) {
      ["no_result_30", "no_result_60", "no_result_90"].forEach(event => work.push({ ...row, event }));
    }
  });

  const matchedLogIds = new Set<string>();
  const messages = work.flatMap(item => {
    const rule = config.rules.find((candidate: any) => candidate.id === item.event);
    if (!rule || !rule.enabled) return [];
    const eventMs = parseCourierMs(item.eventAt);
    const dueAtMs = Number.isFinite(eventMs) ? eventMs + Number(rule.delayMinutes || 0) * 60_000 : NaN;
    const dueAt = Number.isFinite(dueAtMs) ? new Date(dueAtMs).toISOString() : "";
    return ([
      { recipient: "customer", enabled: rule.customer },
      { recipient: "rider", enabled: rule.rider }
    ] as Array<{ recipient: "customer" | "rider"; enabled: boolean }>).filter(target => target.enabled).map(target => {
      const candidates = orderLogs.filter(log => log.source === "courier_automation"
        && log.event === item.event
        && log.recipient === target.recipient
        && (String(log.eventAt || "") === String(item.eventAt || "")
          || (Number.isFinite(parseCourierMs(String(log.eventAt || ""))) && Number.isFinite(eventMs) && Math.abs(parseCourierMs(String(log.eventAt || "")) - eventMs) < 1000)));
      const audit = candidates.sort((a, b) => String(b.updatedAt || b.createdAt).localeCompare(String(a.updatedAt || a.createdAt)))[0];
      if (audit?.id) matchedLogIds.add(audit.id);
      const waiting = Number.isFinite(dueAtMs) && now < dueAtMs;
      const status = audit?.status || (waiting ? "not_due" : config.mode === "paused" ? "paused" : "not_recorded");
      return {
        id: `${item.event}|${item.eventAt}|${target.recipient}`,
        event: item.event,
        eventLabel: rule.label,
        courierStatus: courierEventDetails(item.update).title,
        movementNumber: item.movementNumber,
        eventAt: item.eventAt,
        dueAt,
        recipient: target.recipient,
        status,
        destinationMasked: audit?.destinationMasked || (target.recipient === "rider" ? "Rider number unavailable at this scan" : "Customer number protected"),
        providerSmsId: audit?.providerSmsId || "",
        providerCode: audit?.providerCode || "",
        providerStatus: audit?.providerStatus || "",
        createdAt: audit?.createdAt || "",
        updatedAt: audit?.updatedAt || "",
        acceptedAt: audit?.acceptedAt || "",
        dispatchedAt: audit?.dispatchedAt || "",
        lastCheckedAt: audit?.lastCheckedAt || "",
        reason: audit?.reason || (waiting
          ? `Waiting until the ${rule.delayMinutes} minute delay is complete.`
          : config.mode === "paused"
            ? "Automation is paused, so this update was not submitted."
            : "No matching SMS audit record was found for this courier update."),
        due: !Number.isFinite(dueAtMs) || dueAtMs <= now
      };
    });
  });

  const dueMessages = messages.filter(message => message.due);
  const dispatched = dueMessages.filter(message => ["dispatched", "sent"].includes(message.status)).length;
  const accepted = dueMessages.filter(message => ["accepted", "queued"].includes(message.status)).length;
  const failed = dueMessages.filter(message => message.status === "failed").length;
  const skipped = dueMessages.filter(message => message.status === "skipped").length;
  const notRecorded = dueMessages.filter(message => ["not_recorded", "paused"].includes(message.status)).length;
  const scheduled = messages.filter(message => ["scheduled", "not_due"].includes(message.status)).length;
  const otherActivity = orderLogs.filter(log => !matchedLogIds.has(log.id)).slice(0, 30).map(log => ({
    id: log.id,
    event: log.event,
    eventLabel: log.eventLabel || log.event,
    recipient: log.recipient,
    status: log.status,
    destinationMasked: log.destinationMasked,
    providerSmsId: log.providerSmsId || "",
    providerStatus: log.providerStatus || "",
    createdAt: log.createdAt,
    updatedAt: log.updatedAt || "",
    lastCheckedAt: log.lastCheckedAt || "",
    reason: log.reason,
    source: log.source || "automation"
  }));
  const activityTimes = [...messages, ...otherActivity].flatMap(row => [row.lastCheckedAt, row.updatedAt, row.createdAt]).filter(Boolean).sort();

  return {
    orderId: canonicalOrderId,
    generatedAt: new Date().toISOString(),
    mode: config.mode,
    summary: {
      movements: classified.length,
      expected: messages.length,
      due: dueMessages.length,
      dispatched,
      accepted,
      scheduled,
      failed,
      skipped,
      notRecorded,
      coverage: dueMessages.length ? Math.round(dispatched / dueMessages.length * 1000) / 10 : 100,
      lastActivityAt: activityTimes.at(-1) || ""
    },
    messages: messages.sort((a, b) => {
      const left = parseCourierMs(a.eventAt);
      const right = parseCourierMs(b.eventAt);
      return (Number.isFinite(right) ? right : 0) - (Number.isFinite(left) ? left : 0) || a.recipient.localeCompare(b.recipient);
    }),
    otherActivity
  };
}

export async function GET(request: NextRequest) {
  const requestedOrderId = request.nextUrl.searchParams.get("orderId")?.trim() || "";
  if (requestedOrderId) {
    if (!/^[A-Za-z0-9_-]{1,80}$/.test(requestedOrderId)) return json({ error: "Select a valid Pancake order." }, 400);
    try {
      const [config, rawLogs, outboundRecords, order] = await Promise.all([
        loadSmsAutomationConfig(),
        loadSmsAutomationLogs(1000),
        loadInfotxtOutboundRecords(1000),
        fetchPancakeOrder(requestedOrderId)
      ]);
      const logs = enrichSmsLogs(rawLogs, outboundRecords);
      return json({ proof: buildOrderSmsProof(order, config, logs) });
    } catch (error) {
      return json({ error: error instanceof Error ? error.message : "The order SMS proof could not be loaded." }, 502);
    }
  }
  const [config, rawLogs, provider, outboundRecords, inbound, heartbeat, orderData, marketingEvents] = await Promise.all([
    loadSmsAutomationConfig(),
    loadSmsAutomationLogs(1000),
    loadSmsConfigView(),
    loadInfotxtOutboundRecords(1000),
    loadInfotxtInboundRecords(1000),
    loadSmsWebhookHeartbeat(),
    loadVisionPancakeOrders(5).catch(() => ({ businessOrders: [] as any[] })),
    loadMarketingEvents(5000).catch(() => [] as any[])
  ]);
  const logs = enrichSmsLogs(rawLogs, outboundRecords);
  const outbound = outboundRecords.map(outboundView);
  // Orders and revenue Mel drove through SMS (marketing-attributed order events).
  const smsOrderedEvents = (marketingEvents as any[]).filter(event => event.type === "ordered");
  const smsBusiness = {
    orders: smsOrderedEvents.length,
    revenue: Math.round(smsOrderedEvents.reduce((sum, event) => sum + Math.max(0, Number(event.amount || 0)), 0))
  };
  const analytics = { ...buildAnalytics(logs, outbound, inbound, heartbeat, orderData.businessOrders, provider.expiresAt), business: smsBusiness };
  const stats = {
    activeRules: config.rules.filter(rule => rule.enabled).length,
    customerRules: config.rules.filter(rule => rule.enabled && rule.customer).length,
    riderRules: config.rules.filter(rule => rule.enabled && rule.rider).length,
    dryRuns: logs.filter(row => row.status === "dry_run").length,
    skipped: logs.filter(row => row.status === "skipped").length,
    totalAttempts: logs.length,
    accepted: logs.filter(row => ["accepted", "queued", "dispatched", "sent"].includes(row.status)).length,
    dispatched: logs.filter(row => ["dispatched", "sent"].includes(row.status)).length,
    failed: logs.filter(row => row.status === "failed").length,
    scheduled: logs.filter(row => row.status === "scheduled").length
  };
  return json({
    config,
    logs,
    stats,
    analytics,
    provider: {
      name: "INFOTXT",
      configured: provider.configured,
      source: provider.source,
      simSlot: provider.simSlot,
      expiresAt: provider.expiresAt
    },
    webhook: {
      configured: Boolean(process.env.VISION_X_SAHA_PANCAKE_WEBHOOK_SECRET?.trim()),
      endpoint: "https://www.kradigital.site/api/vision-x-saha/pancake-webhook",
      setupUrl: process.env.VISION_X_SAHA_PANCAKE_WEBHOOK_SECRET?.trim()
        ? `${request.nextUrl.origin}/api/vision-x-saha/pancake-webhook?key=${encodeURIComponent(process.env.VISION_X_SAHA_PANCAKE_WEBHOOK_SECRET.trim())}`
        : ""
    },
    outboundReady: provider.configured,
    liveReady: provider.configured && Boolean(process.env.VISION_X_SAHA_PANCAKE_WEBHOOK_SECRET?.trim()),
    liveBlocker: provider.configured && Boolean(process.env.VISION_X_SAHA_PANCAKE_WEBHOOK_SECRET?.trim())
      ? ""
      : "Live sending needs the InfoTXT provider configured and the Pancake webhook secret set."
  });
}

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return json({ error: "Request origin is not allowed." }, 403);
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > 128 * 1024) return json({ error: "Request is too large." }, 413);

  let body: any;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid request." }, 400);
  }

  if (body?.action === "save_config") {
    try {
      const config = await saveSmsAutomationConfig(body?.config, operatorLabel(request));
      const message = config.mode === "paused"
        ? "Automations paused."
        : config.mode === "live"
          ? "LIVE automation enabled. Courier SMS will send automatically to customers and riders."
          : "Dry-run automation settings saved. No SMS was sent.";
      return json({ saved: true, config, message });
    } catch (error) {
      return json({ error: error instanceof Error ? error.message : "The automation settings could not be saved." }, 502);
    }
  }

  if (body?.action === "simulate") {
    const orderId = text(body?.orderId);
    const eventId = text(body?.event);
    if (!/^[A-Za-z0-9_-]{1,80}$/.test(orderId)) return json({ error: "Select a valid Pancake order." }, 400);
    if (!/^[a-z0-9_]{1,40}$/.test(eventId)) return json({ error: "Select a valid courier event." }, 400);
    try {
      const [order, config] = await Promise.all([fetchPancakeOrder(orderId), loadSmsAutomationConfig()]);
      const rule = config.rules.find(candidate => candidate.id === eventId);
      if (!rule) return json({ error: "That automation rule does not exist." }, 404);
      const variables = previewVariables(order);
      const customerPhone = text(order?.bill_phone_number || order?.phone_number);
      const riderPhone = text(order?.partner?.delivery_tel);
      return json({
        order: { id: variables.order_id, tracking: variables.tracking },
        event: { id: rule.id, label: rule.label, enabled: rule.enabled },
        previews: [
          {
            recipient: "customer",
            enabled: rule.customer,
            available: Boolean(customerPhone),
            destinationMasked: maskSmsPhone(customerPhone),
            message: renderSmsTemplate(rule.customerTemplate, variables)
          },
          {
            recipient: "rider",
            enabled: rule.rider,
            available: Boolean(riderPhone),
            destinationMasked: maskSmsPhone(riderPhone),
            message: renderSmsTemplate(rule.riderTemplate, variables)
          }
        ],
        sent: false,
        notice: "Preview only. No SMS was sent."
      });
    } catch (error) {
      return json({ error: error instanceof Error ? error.message : "The order preview could not be generated." }, 502);
    }
  }

  return json({ error: "Unknown action." }, 400);
}

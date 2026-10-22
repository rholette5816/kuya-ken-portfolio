import { createHash } from "node:crypto";
import { get, list, put } from "@vercel/blob";

const CONFIG_PATH = "vision-x-saha/sms-automation/config.json";
const LOG_PREFIX = "vision-x-saha/sms-automation/logs/";
const HEARTBEAT_PATH = "vision-x-saha/sms-automation/pancake-heartbeat.json";

export type SmsAutomationMode = "paused" | "dry_run" | "live";
export type SmsRecipient = "customer" | "rider";
export type SmsAuditStatus = "dry_run" | "skipped" | "scheduled" | "submitting" | "accepted" | "queued" | "dispatched" | "sent" | "failed";
export type SmsRule = {
  id: string;
  label: string;
  description: string;
  enabled: boolean;
  customer: boolean;
  rider: boolean;
  delayMinutes: number;
  cooldownMinutes: number;
  customerTemplate: string;
  riderTemplate: string;
};

export type SmsAutomationConfig = {
  version: number;
  mode: SmsAutomationMode;
  intensity: "standard" | "kulit" | "maximum";
  customerDailyLimit: number;
  riderDailyLimit: number;
  quietStart: string;
  quietEnd: string;
  senderIdentity: string;
  rules: SmsRule[];
  updatedAt: string;
  updatedBy: string;
};

export type SmsAutomationLog = {
  id: string;
  createdAt: string;
  updatedAt?: string;
  eventAt?: string;
  orderId: string;
  tracking: string;
  event: string;
  eventLabel: string;
  recipient: SmsRecipient;
  destinationMasked: string;
  status: SmsAuditStatus;
  message: string;
  reason: string;
  source?: "manual_test" | "courier_automation" | "order_confirmation" | "customer_reply" | "ai_reply" | "rider_coordination" | "abandon_recovery" | "marketing_campaign";
  providerSmsId?: string;
  providerCode?: string;
  providerStatus?: "queued" | "sent" | "failed" | "unknown";
  acceptedAt?: string;
  dispatchedAt?: string;
  lastCheckedAt?: string;
  segments?: number;
  templateVersion?: number;
};

export type SmsWebhookHeartbeat = {
  lastReceivedAt: string;
  orderId: string;
  shopId: string;
  movementCount: number;
  source: "pancake_webhook" | "scheduled_reconciliation";
};

const defaults: SmsRule[] = [
  {
    id: "tracking_created",
    label: "Tracking created",
    description: "Order receives a courier and tracking number.",
    enabled: true,
    customer: true,
    rider: false,
    delayMinutes: 0,
    cooldownMinutes: 60,
    customerTemplate: "Hi {customer}! Confirmed na ang Lakatan order #{order_id}. J&T tracking: {tracking}. COD: P{cod}. Please keep your phone reachable para sa updates ng Lakatan parcel.",
    riderTemplate: "VISION X SAHA DISPATCH | Order #{order_id} | Tracking {tracking} | Lakatan parcel | {quantity} pcs | COD P{cod}. Paki-monitor ang shipment na ito."
  },
  {
    id: "pickup",
    label: "Parcel picked up",
    description: "Courier accepted the parcel from the sender.",
    enabled: true,
    customer: true,
    rider: false,
    delayMinutes: 0,
    cooldownMinutes: 30,
    customerTemplate: "Good news, {customer}! Na-pick up na ng J&T ang Lakatan parcel. Nagsimula na ang biyahe. Please keep your phone reachable at ihanda ang P{cod} COD.",
    riderTemplate: "Na-pick up na ang Lakatan parcel #{tracking}. Contents: live Lakatan planting material, {quantity} pcs, COD P{cod}. Paki-handle carefully at iwasang maipit o ma-expose sa sobrang init."
  },
  {
    id: "arrival",
    label: "Facility arrival",
    description: "Every unique arrival scan, without inventing a branch location.",
    enabled: true,
    customer: true,
    rider: false,
    delayMinutes: 5,
    cooldownMinutes: 20,
    customerTemplate: "Update #{movement_no}: May bagong arrival scan ang Lakatan parcel sa J&T facility. Tuloy-tuloy ang biyahe—please keep your phone reachable.",
    riderTemplate: "Lakatan parcel update #{movement_no}: May bagong facility arrival scan ang #{tracking}. Live plant shipment, {quantity} pcs, COD P{cod}. Paki-monitor ang next delivery step."
  },
  {
    id: "departure",
    label: "Facility departure",
    description: "Every unique departure scan, without inventing a destination.",
    enabled: true,
    customer: true,
    rider: false,
    delayMinutes: 5,
    cooldownMinutes: 20,
    customerTemplate: "Umaandar ulit ang Lakatan parcel, {customer}! Umalis na ito sa courier facility at papunta sa next route. Tracking: {tracking}.",
    riderTemplate: "Umalis na sa courier facility ang Lakatan parcel #{tracking}. Live planting material ang laman. Paki-monitor at ihanda para sa assigned delivery step."
  },
  {
    id: "movement",
    label: "Other courier movement",
    description: "Any unique courier scan not classified as pickup, arrival, departure, delivery, failure, return, or delivered.",
    enabled: true,
    customer: true,
    rider: false,
    delayMinutes: 5,
    cooldownMinutes: 20,
    customerTemplate: "Courier update #{movement_no}: May bagong galaw ang Lakatan parcel. Status: {courier_status}. Tracking: {tracking}. Please keep your phone reachable.",
    riderTemplate: "Courier update para sa Lakatan parcel #{tracking}: {courier_status}. Live planting material, {quantity} pcs, COD P{cod}. Paki-monitor ang next step."
  },
  {
    id: "out_for_delivery",
    label: "Out for delivery",
    description: "Final-mile dispatch and strongest preparation reminder.",
    enabled: true,
    customer: true,
    rider: true,
    delayMinutes: 0,
    cooldownMinutes: 30,
    customerTemplate: "DELIVERY TODAY: Hi {customer}, dala na ng rider ang Lakatan parcel order #{order_id}. Ihanda ang exact P{cod}, keep your phone open, at sabihan ang kasama sa bahay.",
    riderTemplate: "VISION X SAHA DISPATCH | #{tracking} | Lakatan parcel | {quantity} pcs | COD P{cod} | Customer: {customer} | Address: {address} | Landmark: {landmark}. Customer-placed at expected ang order na ito. Please call before arrival at kumpletuhin ang delivery attempt."
  },
  {
    id: "no_result_30",
    label: "No result after 30 minutes",
    description: "First final-mile follow-up when no completion scan appears.",
    enabled: true,
    customer: true,
    rider: true,
    delayMinutes: 30,
    cooldownMinutes: 30,
    customerTemplate: "Reminder lang, {customer}: Maaaring tumawag anytime ang J&T rider para sa Lakatan parcel. Please answer unknown calls at ihanda ang P{cod} para hindi ma-miss ang delivery.",
    riderTemplate: "FOLLOW-UP #{tracking}: Customer-placed at expected ng customer ang Lakatan parcel order na ito. Paki-contact ang customer at kumpletuhin ang delivery. Naka-monitor ang courier status at may merchant order records kami; please update the result truthfully para maiwasan ang unnecessary review o escalation."
  },
  {
    id: "no_result_60",
    label: "No result after 60 minutes",
    description: "Second final-mile accountability reminder.",
    enabled: true,
    customer: false,
    rider: true,
    delayMinutes: 60,
    cooldownMinutes: 30,
    customerTemplate: "Delivery follow-up: Please keep your phone open for J&T at ihanda ang exact P{cod} para sa Lakatan parcel order #{order_id}.",
    riderTemplate: "SECOND FOLLOW-UP #{tracking}: Expected ng customer ang Lakatan parcel order na ito. Paki-contact sila at kumpletuhin ang delivery. Kung unavailable talaga ang customer, ilagay ang accurate reason at delivery status para maiwasan ang unnecessary review o escalation."
  },
  {
    id: "no_result_90",
    label: "No result after 90 minutes",
    description: "Escalated final-mile status request.",
    enabled: true,
    customer: false,
    rider: true,
    delayMinutes: 90,
    cooldownMinutes: 60,
    customerTemplate: "Important delivery reminder para sa Lakatan parcel order #{order_id}: keep your phone reachable at ihanda ang P{cod} COD.",
    riderTemplate: "IMPORTANT #{tracking}: Unresolved pa rin ang customer-expected Lakatan parcel order. Paki-contact ang customer at kumpletuhin ang delivery. Naka-monitor ang courier movements at available ang merchant order records; please update the truthful result para maiwasan ang unnecessary escalation."
  },
  {
    id: "failed",
    label: "Delivery failed",
    description: "Reason-specific rescue and accountability message.",
    enabled: true,
    customer: true,
    rider: true,
    delayMinutes: 0,
    cooldownMinutes: 30,
    customerTemplate: "Hi {customer}, hindi nakumpleto ang delivery ng Lakatan parcel order #{order_id}: {failure_reason}. Please keep your phone open at i-confirm ang availability para sa next attempt.",
    riderTemplate: "Lakatan parcel #{tracking} was marked failed: {failure_reason}. Customer-placed at expected ang live plant order na ito. Paki-contact ang customer, gawin ang actual delivery attempt, at ilagay ang accurate reason at status kung hindi talaga ma-deliver."
  },
  {
    id: "redelivery",
    label: "Redelivery attempt",
    description: "Another out-for-delivery scan after a failed attempt.",
    enabled: true,
    customer: true,
    rider: true,
    delayMinutes: 0,
    cooldownMinutes: 30,
    customerTemplate: "For redelivery ang Lakatan parcel order #{order_id}. Please make sure may tatanggap, reachable ang phone, at handa ang P{cod} COD.",
    riderTemplate: "REDELIVERY #{tracking} | Lakatan parcel | COD P{cod}. Expected ng customer ang order na ito. Please call before arrival at kumpletuhin ang delivery para maiwasan ang unnecessary return at pagkasira ng halaman."
  },
  {
    id: "return_registered",
    label: "Return registered",
    description: "Parcel enters return-to-sender processing.",
    enabled: true,
    customer: true,
    rider: true,
    delayMinutes: 0,
    cooldownMinutes: 60,
    customerTemplate: "Important: Nasa return process na ang Lakatan parcel order #{order_id}. Please contact the merchant immediately kung may mistake o gusto mong ipa-redeliver.",
    riderTemplate: "RETURN REGISTERED #{tracking}: Customer-placed at expected ang Lakatan parcel order na ito. Paki-check kung possible pa ang redelivery at siguraduhing accurate ang final status bago ito tuluyang ma-return."
  },
  {
    id: "delivered",
    label: "Delivered",
    description: "Final confirmation and automatic stop for reminders.",
    enabled: true,
    customer: true,
    rider: true,
    delayMinutes: 0,
    cooldownMinutes: 60,
    customerTemplate: "Delivered na ang Lakatan parcel order #{order_id}. Maraming salamat! Pakicheck ang Lakatan parcel at enjoy sa pagtatanim.",
    riderTemplate: "Delivered na ang Lakatan parcel #{tracking}. Thank you sa successful delivery. Closed na ang rider reminders para sa order na ito."
  }
];

export function defaultSmsAutomationConfig(): SmsAutomationConfig {
  return {
    version: 3,
    mode: "paused",
    intensity: "kulit",
    customerDailyLimit: 8,
    riderDailyLimit: 6,
    quietStart: "20:30",
    quietEnd: "07:00",
    senderIdentity: "VISION X SAHA Merchant Dispatch",
    rules: defaults.map(rule => ({ ...rule })),
    updatedAt: "",
    updatedBy: "system-default"
  };
}

function cleanTemplate(value: unknown, fallback: string) {
  const result = String(value || "").trim().slice(0, 640);
  return result || fallback;
}

export function sanitizeSmsAutomationConfig(input: any, updatedBy: string): SmsAutomationConfig {
  const base = defaultSmsAutomationConfig();
  const supplied = Array.isArray(input?.rules) ? input.rules : [];
  const refreshTemplates = Number(input?.version || 0) < base.version;
  const rules = base.rules.map(defaultRule => {
    const candidate = supplied.find((rule: any) => String(rule?.id) === defaultRule.id) || {};
    const riderCanBeAssigned = !["tracking_created", "pickup", "arrival", "departure", "movement"].includes(defaultRule.id);
    return {
      ...defaultRule,
      enabled: typeof candidate.enabled === "boolean" ? candidate.enabled : defaultRule.enabled,
      customer: typeof candidate.customer === "boolean" ? candidate.customer : defaultRule.customer,
      rider: riderCanBeAssigned && (typeof candidate.rider === "boolean" ? candidate.rider : defaultRule.rider),
      delayMinutes: Math.min(1440, Math.max(0, Number(candidate.delayMinutes ?? defaultRule.delayMinutes) || 0)),
      cooldownMinutes: Math.min(1440, Math.max(0, Number(candidate.cooldownMinutes ?? defaultRule.cooldownMinutes) || 0)),
      customerTemplate: refreshTemplates ? defaultRule.customerTemplate : cleanTemplate(candidate.customerTemplate, defaultRule.customerTemplate),
      riderTemplate: refreshTemplates ? defaultRule.riderTemplate : cleanTemplate(candidate.riderTemplate, defaultRule.riderTemplate)
    };
  });
  const requestedMode = String(input?.mode || "dry_run");
  const mode: SmsAutomationMode = requestedMode === "paused" ? "paused" : requestedMode === "live" ? "live" : "dry_run";
  return {
    version: base.version,
    mode,
    intensity: ["standard", "kulit", "maximum"].includes(String(input?.intensity)) ? input.intensity : "kulit",
    customerDailyLimit: Math.min(20, Math.max(1, Number(input?.customerDailyLimit || 8))),
    riderDailyLimit: Math.min(20, Math.max(1, Number(input?.riderDailyLimit || 6))),
    quietStart: /^\d{2}:\d{2}$/.test(String(input?.quietStart)) ? String(input.quietStart) : base.quietStart,
    quietEnd: /^\d{2}:\d{2}$/.test(String(input?.quietEnd)) ? String(input.quietEnd) : base.quietEnd,
    senderIdentity: base.senderIdentity,
    rules,
    updatedAt: new Date().toISOString(),
    updatedBy
  };
}

export async function loadSmsAutomationConfig(): Promise<SmsAutomationConfig> {
  try {
    const result = await get(CONFIG_PATH, { access: "private", useCache: false });
    if (!result || result.statusCode !== 200 || !result.stream) return defaultSmsAutomationConfig();
    const parsed = JSON.parse(await new Response(result.stream).text());
    const config = sanitizeSmsAutomationConfig(parsed, String(parsed.updatedBy || "saved"));
    return {
      ...config,
      updatedAt: String(parsed.updatedAt || ""),
      updatedBy: String(parsed.updatedBy || "saved")
    };
  } catch {
    return defaultSmsAutomationConfig();
  }
}

export async function saveSmsAutomationConfig(input: unknown, updatedBy: string) {
  const config = sanitizeSmsAutomationConfig(input, updatedBy);
  await put(CONFIG_PATH, JSON.stringify(config), {
    access: "private",
    contentType: "application/json",
    addRandomSuffix: false,
    allowOverwrite: true,
    cacheControlMaxAge: 0
  });
  return config;
}

export function maskSmsPhone(value: unknown) {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.length < 7) return digits ? "****" : "Unavailable";
  return `${digits.startsWith("63") ? "+63" : digits.slice(0, 2)} ***** ${digits.slice(-4)}`;
}

export function renderSmsTemplate(template: string, variables: Record<string, unknown>) {
  return template.replace(/\{([a-z0-9_]+)\}/gi, (_match, key) => String(variables[key] ?? "N/A")).replace(/\s+/g, " ").trim();
}

export async function recordSmsAutomationLog(input: Omit<SmsAutomationLog, "id" | "createdAt"> & { eventAt?: string }) {
  const fingerprint = createHash("sha256").update([input.orderId, input.tracking, input.event, input.eventAt || "", input.recipient].join("|")).digest("hex");
  const now = new Date().toISOString();
  const record: SmsAutomationLog = {
    ...input,
    id: fingerprint,
    createdAt: now,
    updatedAt: now,
    eventAt: input.eventAt || "",
    segments: input.segments || Math.max(1, Math.ceil(String(input.message || "").length / 160))
  };
  try {
    await put(`${LOG_PREFIX}${fingerprint}.json`, JSON.stringify(record), {
      access: "private",
      contentType: "application/json",
      addRandomSuffix: false,
      allowOverwrite: false,
      cacheControlMaxAge: 0
    });
    return { created: true, record };
  } catch (error: any) {
    if (String(error?.name || error?.message || "").toLowerCase().includes("precondition") || String(error?.message || "").toLowerCase().includes("already")) {
      return { created: false, record: await loadSmsAutomationLog(fingerprint) || record };
    }
    throw error;
  }
}

export async function loadSmsAutomationLog(id: string): Promise<SmsAutomationLog | null> {
  if (!/^[a-f0-9]{64}$/.test(id)) return null;
  try {
    const item = await get(`${LOG_PREFIX}${id}.json`, { access: "private", useCache: false });
    if (!item || item.statusCode !== 200 || !item.stream) return null;
    return JSON.parse(await new Response(item.stream).text()) as SmsAutomationLog;
  } catch {
    return null;
  }
}

export async function updateSmsAutomationLog(id: string, patch: Partial<Omit<SmsAutomationLog, "id" | "createdAt">>) {
  const existing = await loadSmsAutomationLog(id);
  if (!existing) return null;
  const updated: SmsAutomationLog = { ...existing, ...patch, id: existing.id, createdAt: existing.createdAt, updatedAt: new Date().toISOString() };
  await put(`${LOG_PREFIX}${id}.json`, JSON.stringify(updated), {
    access: "private",
    contentType: "application/json",
    addRandomSuffix: false,
    allowOverwrite: true,
    cacheControlMaxAge: 0
  });
  return updated;
}

export async function recordSmsWebhookHeartbeat(input: Omit<SmsWebhookHeartbeat, "lastReceivedAt">) {
  const heartbeat: SmsWebhookHeartbeat = { ...input, lastReceivedAt: new Date().toISOString() };
  await put(HEARTBEAT_PATH, JSON.stringify(heartbeat), {
    access: "private",
    contentType: "application/json",
    addRandomSuffix: false,
    allowOverwrite: true,
    cacheControlMaxAge: 0
  });
  return heartbeat;
}

export async function loadSmsWebhookHeartbeat(): Promise<SmsWebhookHeartbeat | null> {
  try {
    const item = await get(HEARTBEAT_PATH, { access: "private", useCache: false });
    if (!item || item.statusCode !== 200 || !item.stream) return null;
    return JSON.parse(await new Response(item.stream).text()) as SmsWebhookHeartbeat;
  } catch {
    return null;
  }
}

export async function loadSmsAutomationLogs(limit = 120): Promise<SmsAutomationLog[]> {
  try {
    const result = await list({ prefix: LOG_PREFIX, limit: Math.min(1000, Math.max(1, limit)) });
    const blobs = [...result.blobs].sort((a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime());
    const rows = await Promise.all(blobs.map(async blob => {
      try {
        const item = await get(blob.pathname, { access: "private", useCache: false });
        if (!item || item.statusCode !== 200 || !item.stream) return null;
        return JSON.parse(await new Response(item.stream).text()) as SmsAutomationLog;
      } catch {
        return null;
      }
    }));
    return rows.filter((row): row is SmsAutomationLog => Boolean(row)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } catch {
    return [];
  }
}

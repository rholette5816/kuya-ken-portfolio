import { cached } from "./visionCache";

const PANCAKE_API = "https://pos.pages.fm/api/v1";
const TERMINAL_STAGES = new Set(["delivered", "returned", "cancelled"]);
const ORDERS_TTL_MS = 15000;

export type VisionRow = Record<string, any>;

export function visionArray(value: unknown): VisionRow[] {
  return Array.isArray(value) ? value.filter(item => item && typeof item === "object") : [];
}

export function visionNumber(value: unknown) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function visionOrderValue(order: VisionRow) {
  const raw = visionNumber(order.cod || order.total_price_after_sub_discount || order.total_price);
  return raw > 10000 ? raw / 100 : raw;
}

function visionItemName(item: VisionRow) {
  return String(item.product_name || item.name || item.variation_info?.name || item.variation_info?.product_display_id || "");
}

/**
 * Lakatan inventory is counted in individual pieces. The soil/fertilizer
 * upsell is not part of the Lakatan stock ledger, so it must not inflate COGS.
 */
export function visionOrderLakatanPieces(order: VisionRow) {
  return visionArray(order.items).reduce((total, item) => {
    if (/grow na na|agri item 3|fertilizer|soil/i.test(visionItemName(item))) return total;
    return total + Math.max(0, visionNumber(item.quantity));
  }, 0);
}

export function visionTrackingNumber(order: VisionRow) {
  return String(order?.partner?.extend_code || order?.partner?.tracking_number || order?.tracking_number || "").trim();
}

export function visionText(value: unknown): string {
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value).trim();
  if (!value || typeof value !== "object") return "";
  const row = value as Record<string, unknown>;
  for (const key of ["text", "description", "detail", "message", "note", "status", "title", "remark", "reason"]) {
    const nested = visionText(row[key]);
    if (nested) return nested;
  }
  return "";
}

export function visionOrderStage(order: VisionRow, latestNote = "") {
  const status = String(order.status_name || order.status || "new").toLowerCase();
  const combined = `${status} ${latestNote}`.toLowerCase();
  const tracking = visionTrackingNumber(order);
  if (/cancel|removed|deleted/.test(combined)) return "cancelled";
  if (/failed delivery|delivery failed|unsuccessful|rejected|refused/.test(combined)) return "failed_delivery";
  if (/returned|return completed/.test(combined)) return "returned";
  if (/returning|return registration|return to sender|rts/.test(combined)) return "returning";
  if (/delivered|successfully delivered/.test(combined)) return "delivered";
  if (/out for delivery|delivery today|on delivery|package is delivering/.test(combined)) return "out_for_delivery";
  if (tracking && (/picked up|pickup|in transit|departed|departure|arrived|arrival|sorting|hub|shipped/.test(combined))) return "in_transit";
  if (tracking) return "pushed_to_courier";
  if (/pack/.test(status) || Number(order.status) === 8) return "packing";
  if (/confirm/.test(status) || Number(order.status) === 1) return "confirmed";
  return "pending";
}

export function latestVisionCourierUpdate(order: VisionRow) {
  const updates = visionArray(order?.partner?.extend_update).map((update, index) => {
    const status = visionText(update?.status || update?.title || update?.event || update?.description);
    const note = visionText(update?.note || update?.remark || update?.reason || update?.message);
    const at = String(update?.update_at || update?.updated_at || update?.event_time || update?.status_time || update?.created_at || update?.inserted_at || update?.timestamp || update?.time || update?.date || "").trim();
    const parsed = Date.parse(at);
    return { text: `${status} ${note}`.trim(), at, time: Number.isFinite(parsed) ? parsed : -index };
  }).sort((a, b) => b.time - a.time);
  return updates[0] || { text: "", at: "", time: 0 };
}

export function latestVisionCourierText(order: VisionRow) {
  return latestVisionCourierUpdate(order).text;
}

export function isVisionBusinessOrder(order: VisionRow) {
  return !/test|do not ship/i.test(String(order.bill_full_name || order.full_name || order.shipping_address || order.note || ""));
}

async function pancakeJson(url: string) {
  const response = await fetch(url, { cache: "no-store" });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body?.error) throw new Error(body?.error?.message || body?.message || `Pancake returned ${response.status}.`);
  return body;
}

export async function loadVisionPancakeOrders(maxPages = 5) {
  // Shared across the /live and /orders routes and across polls (15s) so the
  // Pancake order pages are only fetched once per window instead of on every
  // request from both endpoints.
  return cached(`vision-pancake-orders:${maxPages}`, ORDERS_TTL_MS, () => loadVisionPancakeOrdersUncached(maxPages));
}

async function loadVisionPancakeOrdersUncached(maxPages = 5) {
  const apiKey = process.env.VISION_X_SAHA_PANCAKE_API_KEY || process.env.PANCAKE_API_KEY;
  const shopId = process.env.VISION_X_SAHA_PANCAKE_SHOP_ID || process.env.PANCAKE_SHOP_ID;
  if (!apiKey || !shopId) throw new Error("Pancake POS access is not configured.");

  const rawOrders: VisionRow[] = [];
  for (let page = 1; page <= maxPages; page += 1) {
    const params = new URLSearchParams({ api_key: apiKey, page_number: String(page), page_size: "100", include_removed: "0" });
    const body = await pancakeJson(`${PANCAKE_API}/shops/${encodeURIComponent(shopId)}/orders?${params}`);
    const batch = visionArray(body.data);
    rawOrders.push(...batch);
    if (batch.length < 100) break;
  }

  return {
    apiKey,
    shopId,
    rawOrders,
    businessOrders: rawOrders.filter(isVisionBusinessOrder)
  };
}

export function summarizeVisionPancakeOrders(businessOrders: VisionRow[], excludedTestOrders = 0) {
  const now = Date.now();
  const rows = businessOrders.map(order => {
    const latest = latestVisionCourierUpdate(order);
    const stage = visionOrderStage(order, latest.text);
    const createdAt = String(order.inserted_at || order.created_at || order.updated_at || "");
    const updatedAt = String(latest.at || order.updated_at || order.inserted_at || order.created_at || "");
    const ageHours = createdAt ? Math.max(0, (now - Date.parse(createdAt)) / 3600000) : 0;
    const stageAgeHours = updatedAt ? Math.max(0, (now - Date.parse(updatedAt)) / 3600000) : ageHours;
    const tracking = visionTrackingNumber(order);
    return {
      order,
      stage,
      value: visionOrderValue(order),
      tracking,
      needsAction: !TERMINAL_STAGES.has(stage) && stageAgeHours >= (tracking ? 36 : 20)
    };
  });
  const delivered = rows.filter(row => row.stage === "delivered");
  const returns = rows.filter(row => ["failed_delivery", "returning", "returned"].includes(row.stage));
  const openStages = new Set(["pending", "confirmed", "packing", "pushed_to_courier", "in_transit", "out_for_delivery"]);
  return {
    totalOrders: rows.length,
    excludedTestOrders,
    delivered: delivered.length,
    returned: returns.length,
    open: rows.filter(row => openStages.has(row.stage)).length,
    codValue: rows.reduce((sum, row) => sum + row.value, 0),
    deliveredValue: delivered.reduce((sum, row) => sum + row.value, 0),
    needsAction: rows.filter(row => row.needsAction).length,
    stages: rows.reduce<Record<string, number>>((result, row) => {
      result[row.stage] = (result[row.stage] || 0) + 1;
      return result;
    }, {})
  };
}

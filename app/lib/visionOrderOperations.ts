import { createHash } from "node:crypto";
import { get, list, put } from "@vercel/blob";

const PREFIX = "vision-x-saha/order-operations/";

export type DeliveryAttemptEvent = {
  id: string;
  orderId: string;
  tracking: string;
  attempt: number;
  type: "out_for_delivery" | "failed_delivery" | "delivered" | "returning";
  occurredAt: string;
  courierStatus: string;
  courierNote: string;
  courier: string;
  riderName: string;
  riderPhone: string;
  riderPhoneMasked: string;
  recordedAt: string;
};

function text(value: unknown) {
  return typeof value === "string" || typeof value === "number" ? String(value).trim() : "";
}

function safeSegment(value: string) {
  return value.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 80) || "unknown";
}

function hash(value: string) {
  return createHash("sha256").update(value).digest("hex").slice(0, 24);
}

function normalizePhone(value: unknown) {
  const digits = text(value).replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("0")) return `+63${digits.slice(1)}`;
  if (digits.length === 12 && digits.startsWith("63")) return `+${digits}`;
  return digits.length >= 7 && digits.length <= 15 ? digits : "";
}

function maskPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";
  return `${digits.startsWith("63") ? "+63" : digits.slice(0, 2)} ••••• ${digits.slice(-4)}`;
}

function classify(title: string, note: string): DeliveryAttemptEvent["type"] | "other" {
  const value = `${title} ${note}`.toLowerCase();
  if (/delivering|out for delivery/.test(value)) return "out_for_delivery";
  if (/delivered|received by consignee|successfully delivered/.test(value)) return "delivered";
  if (/delivery failed|failed delivery|unsuccessful|reject|refus|undeliver/.test(value)) return "failed_delivery";
  if (/return registration|returning|return to sender|\brts\b|returned/.test(value)) return "returning";
  return "other";
}

function updateRows(order: any) {
  const rows = Array.isArray(order?.partner?.extend_update) ? order.partner.extend_update : [];
  return rows.map((row: any, index: number) => {
    const status = text(row?.status || row?.title || row?.event || row?.description);
    const note = text(row?.note || row?.remark || row?.reason || row?.message);
    const at = text(row?.update_at || row?.updated_at || row?.event_time || row?.status_time || row?.created_at || row?.inserted_at || row?.timestamp || row?.time || row?.date);
    return { index, status: status || note || "Courier update", note: note.toLowerCase() === status.toLowerCase() ? "" : note, at };
  }).sort((left: any, right: any) => {
    const leftTime = Date.parse(left.at);
    const rightTime = Date.parse(right.at);
    if (Number.isFinite(leftTime) && Number.isFinite(rightTime)) return leftTime - rightTime;
    if (Number.isFinite(leftTime)) return -1;
    if (Number.isFinite(rightTime)) return 1;
    return left.index - right.index;
  });
}

function eventPath(event: DeliveryAttemptEvent) {
  return `${PREFIX}${safeSegment(event.orderId)}/delivery-events/${event.id}.json`;
}

function cursorPath(orderId: string) {
  return `${PREFIX}${safeSegment(orderId)}/delivery-events-cursor.json`;
}

async function readJson<T>(pathname: string): Promise<T | null> {
  try {
    const item = await get(pathname, { access: "private", useCache: false });
    if (!item || item.statusCode !== 200 || !item.stream) return null;
    return JSON.parse(await new Response(item.stream).text()) as T;
  } catch {
    return null;
  }
}

/** Appends immutable courier events. Deterministic IDs prevent duplicate attempts. */
export async function recordOrderDeliveryEvents(order: any) {
  const orderId = text(order?.id || order?.order_id);
  if (!orderId) return { recorded: 0 };
  const tracking = text(order?.partner?.extend_code || order?.tracking_number || order?.tracking);
  const courier = text(order?.partner?.name || order?.partner?.partner_name || order?.shipping_partner || "Courier");
  const riderName = text(order?.partner?.delivery_name);
  const riderPhone = normalizePhone(order?.partner?.delivery_tel);
  const rows = updateRows(order);
  let attempts = 0;
  let recorded = 0;
  const relevant: DeliveryAttemptEvent[] = [];

  for (const row of rows) {
    const type = classify(row.status, row.note);
    if (type === "out_for_delivery") attempts += 1;
    if (type === "other") continue;
    const attempt = type === "out_for_delivery" ? attempts : Math.max(attempts, 1);
    const occurredAt = row.at || text(order?.updated_at || order?.time_send_partner || new Date().toISOString());
    const id = hash([orderId, tracking, type, occurredAt, row.status, row.note, attempt].join("|"));
    relevant.push({
      id,
      orderId,
      tracking,
      attempt,
      type,
      occurredAt,
      courierStatus: row.status,
      courierNote: row.note,
      courier,
      riderName: type === "out_for_delivery" ? riderName : "",
      riderPhone: type === "out_for_delivery" ? riderPhone : "",
      riderPhoneMasked: type === "out_for_delivery" ? maskPhone(riderPhone) : "",
      recordedAt: new Date().toISOString()
    });
  }

  const fingerprint = hash(relevant.map(event => [event.id, event.riderName, event.riderPhone].join("|")).join("\n"));
  const previous = await readJson<{ fingerprint?: string }>(cursorPath(orderId));
  if (previous?.fingerprint === fingerprint) return { recorded: 0 };

  for (const event of relevant) {
    try {
      await put(eventPath(event), JSON.stringify(event), {
        access: "private",
        contentType: "application/json",
        addRandomSuffix: false,
        allowOverwrite: false,
        cacheControlMaxAge: 0
      });
      recorded += 1;
    } catch (error: any) {
      if (!/precondition|already|exist/i.test(String(error?.name || error?.message || ""))) throw error;
    }
  }
  await put(cursorPath(orderId), JSON.stringify({ fingerprint, checkedAt: new Date().toISOString() }), {
    access: "private",
    contentType: "application/json",
    addRandomSuffix: false,
    allowOverwrite: true,
    cacheControlMaxAge: 0
  });
  return { recorded };
}

export async function loadOrderDeliveryEvents(orderId: string, limit = 80) {
  try {
    const result = await list({ prefix: `${PREFIX}${safeSegment(orderId)}/delivery-events/`, limit: Math.min(100, Math.max(1, limit)) });
    const rows = await Promise.all(result.blobs.map(blob => readJson<DeliveryAttemptEvent>(blob.pathname)));
    return rows.filter((row): row is DeliveryAttemptEvent => Boolean(row)).sort((a, b) => {
      const left = Date.parse(a.occurredAt);
      const right = Date.parse(b.occurredAt);
      return (Number.isFinite(left) ? left : 0) - (Number.isFinite(right) ? right : 0);
    });
  } catch {
    return [];
  }
}

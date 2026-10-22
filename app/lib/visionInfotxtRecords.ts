import { createHash } from "node:crypto";
import { get, list, put } from "@vercel/blob";
import { checkInfotxtSmsStatus, InfotxtDeliveryStatus } from "./visionInfotxt";
import { updateSmsAutomationLog, type SmsAutomationLog } from "./visionSmsAutomation";

const OUTBOUND_PREFIX = "vision-x-saha/infotxt/outbound/";
const INBOUND_PREFIX = "vision-x-saha/infotxt/inbound/";
const QUEUE_ATTENTION_MS = 10 * 60 * 1000;

export type InfotxtOutboundRecord = {
  providerSmsId: string;
  source: "manual_test" | "courier_automation" | "order_confirmation" | "customer_reply" | "ai_reply" | "rider_coordination" | "abandon_recovery" | "marketing_campaign" | "legacy_log";
  auditId?: string;
  orderId: string;
  tracking: string;
  eventLabel: string;
  recipient: "customer" | "rider";
  destinationMasked: string;
  /** Stored only in the private operations record for the authenticated order conversation. */
  message?: string;
  submittedAt: string;
  lastCheckedAt: string;
  providerCode: string;
  providerStatus: InfotxtDeliveryStatus;
  terminal: boolean;
  lastError: string;
  history?: Array<{
    at: string;
    providerCode: string;
    status: InfotxtDeliveryStatus;
    error: string;
  }>;
};

export type InfotxtInboundRecord = {
  id: string;
  providerMessageId: string;
  mobile: string;
  mobileMasked: string;
  sms: string;
  sentAt: string;
  receivedAt: string;
  sim: string;
  isCustomer: boolean;
  orderId: string;
  customerName: string;
  storedAt: string;
};

function outboundPath(smsId: string) {
  return `${OUTBOUND_PREFIX}${smsId}.json`;
}

async function readJson<T>(pathname: string): Promise<T | null> {
  try {
    const result = await get(pathname, { access: "private", useCache: false });
    if (!result || result.statusCode !== 200 || !result.stream) return null;
    return JSON.parse(await new Response(result.stream).text()) as T;
  } catch {
    return null;
  }
}

export async function saveInfotxtOutboundRecord(record: InfotxtOutboundRecord) {
  if (!/^\d{1,30}$/.test(record.providerSmsId)) throw new Error("Invalid InfoTXT SMS ID.");
  await put(outboundPath(record.providerSmsId), JSON.stringify(record), {
    access: "private",
    contentType: "application/json",
    addRandomSuffix: false,
    allowOverwrite: true,
    cacheControlMaxAge: 0
  });
  return record;
}

export async function recordInfotxtOutbound(input: Omit<InfotxtOutboundRecord, "lastCheckedAt" | "providerCode" | "providerStatus" | "terminal" | "lastError">) {
  const submittedAt = input.submittedAt || new Date().toISOString();
  return saveInfotxtOutboundRecord({
    ...input,
    submittedAt,
    lastCheckedAt: "",
    providerCode: "0",
    providerStatus: "queued",
    terminal: false,
    lastError: "",
    history: [{ at: submittedAt, providerCode: "0", status: "queued", error: "" }]
  });
}

export async function loadInfotxtOutboundRecords(limit = 100): Promise<InfotxtOutboundRecord[]> {
  try {
    const result = await list({ prefix: OUTBOUND_PREFIX, limit: Math.min(1000, Math.max(1, limit)) });
    const records = await Promise.all(result.blobs.map(blob => readJson<InfotxtOutboundRecord>(blob.pathname)));
    return records.filter((record): record is InfotxtOutboundRecord => Boolean(record)).sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
  } catch {
    return [];
  }
}

export async function backfillInfotxtOutboundRecords(logs: SmsAutomationLog[]) {
  const accepted = logs.filter(log => /InfoTXT accepted the SMS(?: \(ID \d+\))?/i.test(log.reason));
  for (const log of accepted) {
    const smsId = log.reason.match(/\(ID (\d{1,30})\)/i)?.[1] || "";
    if (!smsId || await readJson<InfotxtOutboundRecord>(outboundPath(smsId))) continue;
    await recordInfotxtOutbound({
      providerSmsId: smsId,
      source: "legacy_log",
      auditId: log.id,
      orderId: log.orderId,
      tracking: log.tracking,
      eventLabel: log.eventLabel,
      recipient: log.recipient,
      destinationMasked: log.destinationMasked,
      submittedAt: log.createdAt
    });
  }
}

export async function refreshInfotxtOutboundRecords(limit = 100, minimumAgeMs = 20_000) {
  const records = await loadInfotxtOutboundRecords(limit);
  const refreshed: InfotxtOutboundRecord[] = [];
  for (const record of records) {
    if (record.terminal) {
      refreshed.push(record);
      continue;
    }
    if (record.lastCheckedAt && Date.now() - Date.parse(record.lastCheckedAt) < minimumAgeMs) {
      refreshed.push(record);
      continue;
    }
    try {
      const result = await checkInfotxtSmsStatus(record.providerSmsId);
      const previousHistory = Array.isArray(record.history) ? record.history : [];
      const changed = previousHistory.length === 0 || record.providerCode !== result.providerCode || record.providerStatus !== result.status || record.lastError !== result.error;
      const updated = await saveInfotxtOutboundRecord({
        ...record,
        lastCheckedAt: result.checkedAt,
        providerCode: result.providerCode,
        providerStatus: result.status,
        terminal: result.terminal,
        lastError: result.error,
        history: changed ? [...previousHistory, { at: result.checkedAt, providerCode: result.providerCode, status: result.status, error: result.error }].slice(-20) : previousHistory
      });
      if (record.auditId) {
        await updateSmsAutomationLog(record.auditId, {
          status: result.status === "sent" ? "dispatched" : result.status === "failed" ? "failed" : "accepted",
          providerSmsId: record.providerSmsId,
          providerCode: result.providerCode,
          providerStatus: result.status,
          lastCheckedAt: result.checkedAt,
          dispatchedAt: result.status === "sent" ? result.checkedAt : undefined,
          reason: result.status === "sent"
            ? "InfoTXT dispatched the SMS. Handset delivery is not confirmed."
            : result.status === "failed"
              ? result.error || "InfoTXT marked the SMS as failed."
              : "InfoTXT accepted the SMS and it is still queued for dispatch."
        });
      }
      refreshed.push(updated);
    } catch (error) {
      const updated = await saveInfotxtOutboundRecord({
        ...record,
        lastCheckedAt: new Date().toISOString(),
        lastError: error instanceof Error ? error.message : "Status check failed."
      });
      refreshed.push(updated);
    }
  }
  return refreshed.sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
}

export function outboundView(record: InfotxtOutboundRecord) {
  const ageMs = Math.max(0, Date.now() - Date.parse(record.submittedAt));
  return {
    ...record,
    gatewayAttention: record.providerStatus === "queued" && ageMs >= QUEUE_ATTENTION_MS,
    queuedMinutes: record.providerStatus === "queued" ? Math.floor(ageMs / 60_000) : 0,
    meaning: record.providerStatus === "sent"
      ? "InfoTXT dispatched the SMS. This is not a handset delivery receipt."
      : record.providerStatus === "failed"
        ? "InfoTXT marked the outbound SMS as failed."
        : record.providerStatus === "queued"
          ? "InfoTXT accepted the SMS but has not dispatched it yet."
          : `InfoTXT returned status code ${record.providerCode || "?"}, not yet mapped.`
  };
}

export async function saveInfotxtInbound(input: Omit<InfotxtInboundRecord, "id" | "storedAt">) {
  const id = createHash("sha256").update([input.providerMessageId, input.mobile, input.receivedAt, input.sms].join("|")).digest("hex");
  const record: InfotxtInboundRecord = { ...input, id, storedAt: new Date().toISOString() };
  try {
    await put(`${INBOUND_PREFIX}${id}.json`, JSON.stringify(record), {
      access: "private",
      contentType: "application/json",
      addRandomSuffix: false,
      allowOverwrite: false,
      cacheControlMaxAge: 0
    });
    return { created: true, record };
  } catch (error: any) {
    const duplicate = /precondition|already/i.test(String(error?.name || error?.message || ""));
    if (duplicate) return { created: false, record };
    throw error;
  }
}

export async function loadInfotxtInboundRecords(limit = 50) {
  try {
    const result = await list({ prefix: INBOUND_PREFIX, limit: Math.min(1000, Math.max(1, limit)) });
    const rows = await Promise.all(result.blobs.map(blob => readJson<InfotxtInboundRecord>(blob.pathname)));
    return rows.filter((row): row is InfotxtInboundRecord => Boolean(row)).sort((a, b) => b.storedAt.localeCompare(a.storedAt));
  } catch {
    return [];
  }
}

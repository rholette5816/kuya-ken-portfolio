import { loadSmsConfig } from "./visionSmsConfig";

const INFOTXT_SEND_URL = "https://api.myinfotxt.com/v2/send.php";
const INFOTXT_STATUS_URL = "https://api.myinfotxt.com/v2/status.php";
const REQUEST_TIMEOUT_MS = 12_000;

export type InfotxtSendResult = {
  accepted: boolean;
  providerStatus: string;
  smsId: string;
  error: string;
};

export type InfotxtDeliveryStatus = "queued" | "sent" | "failed" | "unknown";

export type InfotxtStatusResult = {
  providerCode: string;
  status: InfotxtDeliveryStatus;
  terminal: boolean;
  checkedAt: string;
  error: string;
};

export function normalizePhilippineMobile(value: unknown): string {
  const digits = String(value || "").replace(/\D/g, "");
  if (/^09\d{9}$/.test(digits)) return digits;
  if (/^639\d{9}$/.test(digits)) return `0${digits.slice(2)}`;
  return "";
}

function safeProviderText(value: unknown, fallback = "InfoTXT rejected the request.") {
  const cleaned = String(value || "").replace(/[\r\n\t]+/g, " ").replace(/\s+/g, " ").trim();
  return (cleaned || fallback).slice(0, 180);
}

export async function sendInfotxtSms(recipient: string, message: string): Promise<InfotxtSendResult> {
  const config = await loadSmsConfig();
  if (!config?.userId || !config.apiKey) throw new Error("InfoTXT credentials are incomplete.");
  if (config.expiresAt && Date.parse(`${config.expiresAt}T23:59:59+08:00`) < Date.now()) throw new Error("The InfoTXT credentials have expired.");

  const mobile = normalizePhilippineMobile(recipient);
  if (!mobile) throw new Error("Enter a valid Philippine mobile number.");
  const sms = String(message || "").replace(/\r\n/g, "\n").trim();
  if (!sms || sms.length > 459) throw new Error("The SMS must contain 1 to 459 characters.");

  const body = new URLSearchParams({
    UserID: config.userId,
    ApiKey: config.apiKey,
    Mobile: mobile,
    SMS: sms
  });
  // InfoTXT sends through a physical SIM slot; without it the message is
  // accepted but never dispatched (stuck at a non-standard status).
  if (config.simSlot) body.set("SIM", config.simSlot);

  // Retry genuine connection failures ("fetch failed") with growing backoff so a
  // brief network blip does not drop the SMS. Safe because a connection failure means
  // the request never reached InfoTXT, so a resend cannot double-send. Timeouts and
  // HTTP errors are NOT retried (the request may have been processed).
  const MAX_ATTEMPTS = 5;
  const BACKOFF_MS = [600, 1500, 3000, 5000];
  let lastError = "InfoTXT connection failed after retries.";
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(INFOTXT_SEND_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString(),
        cache: "no-store",
        signal: controller.signal
      });
      const raw = await response.text();
      let parsed: any = null;
      try {
        parsed = JSON.parse(raw);
      } catch {
        parsed = null;
      }
      if (!response.ok) {
        // The request reached InfoTXT; do not retry (it may have been processed).
        return { accepted: false, providerStatus: String(response.status), smsId: "", error: `InfoTXT returned HTTP ${response.status}.` };
      }
      const providerStatus = String(parsed?.status || "").trim();
      const accepted = providerStatus === "00";
      return {
        accepted,
        providerStatus: providerStatus || "unknown",
        smsId: String(parsed?.smsid || "").trim().slice(0, 100),
        error: accepted ? "" : safeProviderText(parsed?.error || raw)
      };
    } catch (error) {
      const isTimeout = error instanceof Error && error.name === "AbortError";
      lastError = isTimeout ? "InfoTXT did not respond in time." : (error instanceof Error ? error.message : "InfoTXT send failed.");
      // Retry ONLY a genuine connection failure (the message never left). A timeout
      // might mean InfoTXT already received it, so never retry it - avoids doubles.
      if (!isTimeout && attempt < MAX_ATTEMPTS) {
        await new Promise(resolve => setTimeout(resolve, BACKOFF_MS[attempt - 1] ?? 5000));
        continue;
      }
      return { accepted: false, providerStatus: isTimeout ? "timeout" : "network", smsId: "", error: lastError };
    } finally {
      clearTimeout(timeout);
    }
  }
  return { accepted: false, providerStatus: "network", smsId: "", error: lastError };
}

export async function checkInfotxtSmsStatus(smsId: string): Promise<InfotxtStatusResult> {
  const normalizedId = String(smsId || "").trim();
  if (!/^\d{1,30}$/.test(normalizedId)) throw new Error("Invalid InfoTXT SMS ID.");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const checkedAt = new Date().toISOString();
  try {
    const response = await fetch(INFOTXT_STATUS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ smsid: normalizedId }).toString(),
      cache: "no-store",
      signal: controller.signal
    });
    const raw = (await response.text()).trim();
    if (!response.ok) {
      return { providerCode: String(response.status), status: "unknown", terminal: false, checkedAt, error: `InfoTXT returned HTTP ${response.status}.` };
    }

    let parsed: any = null;
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = null;
    }
    const providerCode = String(parsed?.status ?? parsed?.code ?? raw).trim().replace(/^"|"$/g, "");
    // InfoTXT status.php codes. "10" = queued/accepted (confirmed live). Other
    // codes (sent / delivered / failed) are mapped as they are observed; an
    // unmapped code surfaces its raw value instead of a scary "unrecognized".
    const status: InfotxtDeliveryStatus =
      providerCode === "0" || providerCode === "10" ? "queued"
        : providerCode === "1" ? "sent"
          : providerCode === "2" ? "failed"
            : "unknown";
    return {
      providerCode,
      status,
      terminal: status === "sent" || status === "failed",
      checkedAt,
      error: status === "unknown" ? safeProviderText(parsed?.error || `InfoTXT status code ${providerCode}`, "InfoTXT returned a status code we have not mapped yet.") : ""
    };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw new Error("InfoTXT status check did not respond within 12 seconds.");
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

import { createHash } from "node:crypto";
import type { NextRequest } from "next/server";

const META_GRAPH_VERSION = "v23.0";
const DEFAULT_PIXEL_ID = "2533074450435922";
const LEGACY_PIXEL_ID = "1323008325857073";
const DEFAULT_SOURCE_URL = "https://www.securecodexpress.xyz/visionsaha";

type PurchaseInput = {
  request: NextRequest;
  eventId: string;
  sourceUrl?: string;
  fullName: string;
  phone: string;
  city?: string;
  province?: string;
  fbp?: string;
  fbc?: string;
  value: number;
  contentName: string;
  contentIds: string[];
  orderId: string;
  eventName?: "Purchase" | "UpsellAccepted";
};

function hash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function normalize(value: unknown) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function normalizePhone(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits.startsWith("0") ? `63${digits.slice(1)}` : digits;
}

function safeEventId(value: unknown, fallback: string) {
  const candidate = String(value || "").trim();
  return candidate && candidate.length <= 100 && /^[A-Za-z0-9_.:-]+$/.test(candidate) ? candidate : fallback;
}

function safeCookie(value: unknown) {
  const candidate = String(value || "").trim();
  return candidate.length <= 255 && /^[A-Za-z0-9._:-]+$/.test(candidate) ? candidate : "";
}

function safeSourceUrl(value: unknown) {
  try {
    const url = new URL(String(value || ""));
    if (url.protocol === "https:" && ["securecodexpress.xyz", "www.securecodexpress.xyz"].includes(url.hostname)) {
      return url.toString().slice(0, 1000);
    }
  } catch {
    // Use the canonical landing-page URL below.
  }
  return DEFAULT_SOURCE_URL;
}

function capiCredentials(sourceUrl: string) {
  const url = new URL(sourceUrl);
  const pathname = url.pathname.replace(/\/+$/, "") || "/";
  const isLegacyVisionPage = pathname === "/region7lakatan" && url.searchParams.get("src") === "visionxsaha";
  if (isLegacyVisionPage) {
    return {
      pixelId: process.env.VISION_X_SAHA_LEGACY_PIXEL_ID || LEGACY_PIXEL_ID,
      token: process.env.VISION_X_SAHA_LEGACY_CAPI_TOKEN,
      profile: "legacy" as const
    };
  }
  return {
    pixelId: process.env.VISION_X_SAHA_PIXEL_ID || DEFAULT_PIXEL_ID,
    token: process.env.VISION_X_SAHA_CAPI_TOKEN,
    profile: "vision" as const
  };
}

function splitName(fullName: string) {
  const parts = normalize(fullName).split(" ").filter(Boolean);
  return { firstName: parts[0] || "", lastName: parts.length > 1 ? parts[parts.length - 1] : "" };
}

export async function sendVisionSahaPurchase(input: PurchaseInput) {
  const sourceUrl = safeSourceUrl(input.sourceUrl);
  const { token, pixelId, profile } = capiCredentials(sourceUrl);
  if (!token || !pixelId) throw new Error("Meta CAPI is not configured.");

  const eventId = safeEventId(input.eventId, `visionsaha-${input.orderId}`);
  const { firstName, lastName } = splitName(input.fullName);
  const phone = normalizePhone(input.phone);
  const city = normalize(input.city);
  const province = normalize(input.province);
  const forwardedIp = input.request.headers.get("x-vxs-client-ip")
    || input.request.headers.get("x-forwarded-for")?.split(",")[0].trim()
    || "";
  const userAgent = input.request.headers.get("x-vxs-client-user-agent")
    || input.request.headers.get("user-agent")
    || "";
  const fbp = safeCookie(input.fbp);
  const fbc = safeCookie(input.fbc);

  const userData: Record<string, string | string[]> = {
    ph: [hash(phone)],
    fn: [hash(firstName)],
    country: [hash("ph")],
    external_id: [hash(input.orderId)]
  };
  if (lastName) userData.ln = [hash(lastName)];
  if (city) userData.ct = [hash(city)];
  if (province) userData.st = [hash(province)];
  if (forwardedIp && forwardedIp.length <= 64) userData.client_ip_address = forwardedIp;
  if (userAgent) userData.client_user_agent = userAgent.slice(0, 500);
  if (fbp) userData.fbp = fbp;
  if (fbc) userData.fbc = fbc;

  const response = await fetch(
    `https://graph.facebook.com/${META_GRAPH_VERSION}/${encodeURIComponent(pixelId)}/events?access_token=${encodeURIComponent(token)}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        data: [{
          event_name: input.eventName || "Purchase",
          event_time: Math.floor(Date.now() / 1000),
          event_id: eventId,
          action_source: "website",
          event_source_url: sourceUrl,
          user_data: userData,
          custom_data: {
            currency: "PHP",
            value: input.value,
            content_name: input.contentName,
            content_type: "product",
            content_ids: input.contentIds,
            order_id: input.orderId
          }
        }]
      }),
      signal: AbortSignal.timeout(8000)
    }
  );
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body?.error) {
    throw new Error(body?.error?.message || `Meta returned ${response.status}.`);
  }
  return { eventId, eventsReceived: Number(body?.events_received || 0), pixelId, profile };
}

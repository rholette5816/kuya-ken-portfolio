import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const PANCAKE_API = "https://pos.pages.fm/api/v1";

function text(value: unknown) {
  return typeof value === "string" || typeof value === "number" ? String(value).trim() : "";
}

function normalizePhone(value: unknown) {
  const raw = text(value);
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 7 || digits.length > 15) return "";
  if (digits.startsWith("63") && digits.length >= 12) return `+${digits}`;
  if (digits.startsWith("0") && digits.length === 11) return `+63${digits.slice(1)}`;
  return raw.startsWith("+") ? `+${digits}` : digits;
}

function displayPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.startsWith("63") && digits.length === 12) return `+63 ${digits.slice(2, 5)} ${digits.slice(5, 8)} ${digits.slice(8)}`;
  if (digits.length === 11 && digits.startsWith("0")) return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
  return value;
}

function privateJson(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex, nofollow, noarchive"
    }
  });
}

export async function GET(request: NextRequest) {
  const apiKey = process.env.VISION_X_SAHA_PANCAKE_API_KEY;
  const shopId = process.env.VISION_X_SAHA_PANCAKE_SHOP_ID;
  if (!apiKey || !shopId) return privateJson({ error: "Pancake POS access is not configured." }, 503);

  const orderId = text(request.nextUrl.searchParams.get("orderId"));
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(orderId)) return privateJson({ error: "A valid order ID is required." }, 400);

  try {
    const params = new URLSearchParams({ api_key: apiKey });
    const response = await fetch(`${PANCAKE_API}/shops/${encodeURIComponent(shopId)}/orders/${encodeURIComponent(orderId)}?${params}`, { cache: "no-store" });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || body?.error) return privateJson({ error: body?.error?.message || body?.message || `Pancake returned ${response.status}.` }, 502);

    const order = body?.data || body;
    const phone = normalizePhone(order?.partner?.delivery_tel);
    const rider = text(order?.partner?.delivery_name);
    if (!phone) return privateJson({ available: false, rider: rider || "Assigned rider", message: "The courier has not supplied a rider contact number for this order." });

    return privateJson({
      available: true,
      rider: rider || "Assigned rider",
      phone: displayPhone(phone),
      telHref: `tel:${phone}`
    });
  } catch (error) {
    return privateJson({ error: error instanceof Error ? error.message : "The rider contact could not be retrieved." }, 502);
  }
}


import { NextRequest, NextResponse } from "next/server";
import { sendVisionSahaPurchase } from "../../../../lib/vision-saha-meta-capi";
import { loadSmsAutomationConfig } from "../../../lib/visionSmsAutomation";
import { sendTrackedInfotxtSms } from "../../../lib/visionSmsTrackedSend";

export const dynamic = "force-dynamic";

const PANCAKE_API = "https://pos.pages.fm/api/v1";

// Bundles temporarily taken off sale on all 4 landing pages. Remove entries
// here (and the matching HTML grayed-out treatments in lakatan/) to bring them back.
const DISABLED_BUNDLES = new Set(["20pcs_2999"]);

const bundles = {
  "20pcs_2999": { label: "Buy 10 Take 10 Lakatan Saha (20 pcs)", quantity: 20, price: 2999 },
  "10pcs_1699": { label: "10 pcs Lakatan Saha", quantity: 10, price: 1699 },
  "4pcs_799": { label: "4 pcs Lakatan Saha", quantity: 4, price: 799 },
  "2pcs_499": { label: "2 pcs Lakatan Saha", quantity: 2, price: 499 }
} as const;

type BundleKey = keyof typeof bundles;
type CatalogItem = Record<string, unknown>;

const rateLimits = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(ip: string) {
  const now = Date.now();
  const current = rateLimits.get(ip);
  if (!current || now > current.resetAt) {
    rateLimits.set(ip, { count: 1, resetAt: now + 10 * 60 * 1000 });
    return false;
  }
  if (current.count >= 3) return true;
  current.count += 1;
  return false;
}

function getArray(value: unknown): CatalogItem[] {
  return Array.isArray(value) ? value.filter((item): item is CatalogItem => Boolean(item) && typeof item === "object") : [];
}

function stringId(value: unknown) {
  return typeof value === "string" || typeof value === "number" ? String(value) : "";
}

async function pancakeJson(url: string, init?: RequestInit) {
  const response = await fetch(url, { ...init, cache: "no-store" });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body?.error) {
    throw new Error(body?.error?.message || body?.message || `Pancake returned ${response.status}.`);
  }
  return body;
}

async function resolveLakatanProduct(shopId: string, apiKey: string) {
  const configuredProduct = process.env.VISION_X_SAHA_LAKATAN_PRODUCT_ID;
  const configuredVariation = process.env.VISION_X_SAHA_LAKATAN_VARIATION_ID;
  if (configuredProduct && configuredVariation) {
    return { productId: configuredProduct, variationId: configuredVariation };
  }

  const params = new URLSearchParams({
    api_key: apiKey,
    page_number: "1",
    page_size: "100"
  });
  const body = await pancakeJson(`${PANCAKE_API}/shops/${encodeURIComponent(shopId)}/products?${params}`);
  const products = getArray(body.data || body.products);
  const product = products.find(item => String(item.name || item.product_name || "").trim().toLowerCase() === "lakatan saha");
  if (!product) throw new Error("Lakatan Saha was not found in the connected Pancake shop.");

  const variations = getArray(product.variations || product.variants || product.product_variations);
  const variation = variations[0];
  const productId = stringId(product.id || product.product_id);
  const variationId = stringId(variation?.id || variation?.variation_id || product.variation_id);
  if (!productId || !variationId) {
    throw new Error("Lakatan Saha was found, but its product or variation ID was unavailable.");
  }
  return { productId, variationId };
}

function extractOrderId(body: Record<string, any>) {
  return body.id || body.order_id || body.data?.id || body.data?.order_id || body.order?.id || body.order?.order_id || null;
}

function landingPath(value: unknown) {
  try {
    const url = new URL(String(value || ""));
    if (!["securecodexpress.xyz", "www.securecodexpress.xyz"].includes(url.hostname)) return "/visionsaha";
    const path = url.pathname.replace(/\/+$/, "") || "/";
    return ["/visionsaha", "/livesaha", "/region7lakatan"].includes(path) ? path : "/visionsaha";
  } catch {
    return "/visionsaha";
  }
}

async function findActiveOrder(shopId: string, apiKey: string, phone: string) {
  const params = new URLSearchParams({ api_key: apiKey, search: phone, page_size: "20", page_number: "1" });
  const body = await pancakeJson(`${PANCAKE_API}/shops/${encodeURIComponent(shopId)}/orders?${params}`);
  const orders = Array.isArray(body.data) ? body.data : [];
  const terminalNames = new Set(["delivered", "returned", "returning", "cancelled", "canceled", "deleted", "failed"]);
  return orders.find((order: any) => {
    const numeric = Number(order.status);
    const name = String(order.status_name || "").toLowerCase();
    return !order.cancelled && !order.is_cancelled && !order.deleted && !order.is_deleted
      && !terminalNames.has(name) && ![3, 4, 5, 6, 7].includes(numeric);
  }) || null;
}

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
  if (isRateLimited(ip)) {
    return NextResponse.json({ error: "Masyadong maraming order. Subukan ulit maya-maya." }, { status: 429 });
  }

  const apiKey = process.env.VISION_X_SAHA_PANCAKE_API_KEY;
  const shopId = process.env.VISION_X_SAHA_PANCAKE_SHOP_ID;
  if (!apiKey || !shopId) {
    return NextResponse.json({ error: "VISION X SAHA Pancake access is not configured." }, { status: 503 });
  }

  const input = await request.json().catch(() => null);
  if (!input || input._trap) {
    return input?._trap
      ? NextResponse.json({ success: true, order_id: null })
      : NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const fullName = String(input.full_name || "").trim();
  const phone = String(input.phone || "").trim();
  const address = String(input.address || "").trim();
  const landmark = String(input.landmark || "").trim();
  const bundleKey = String(input.bundle || "") as BundleKey;
  const bundle = bundles[bundleKey];

  if (!fullName || !phone || !address || !bundle) {
    return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
  }
  if (DISABLED_BUNDLES.has(bundleKey)) {
    return NextResponse.json({ error: "This bundle is temporarily unavailable." }, { status: 400 });
  }
  if (fullName.length > 100 || address.length > 300 || landmark.length > 200 || !/^09\d{9}$/.test(phone)) {
    return NextResponse.json({ error: "Invalid customer details." }, { status: 400 });
  }

  try {
    const duplicate = await findActiveOrder(shopId, apiKey, phone);
    if (duplicate) {
      return NextResponse.json({
        error: "May aktibong order na gamit ang mobile number na ito.",
        duplicate: true,
        order: { id: duplicate.id || duplicate.order_id, status: duplicate.status_name || "Active" }
      }, { status: 409 });
    }
    const { productId, variationId } = await resolveLakatanProduct(shopId, apiKey);
    const sourcePage = landingPath(input.event_source_url);
    const fullAddress = [address, landmark, input.barangay, input.city, input.province].filter(Boolean).join(", ");
    const attribution = [
      input.utm_source && `UTM source: ${String(input.utm_source).slice(0, 100)}`,
      input.utm_campaign && `UTM campaign: ${String(input.utm_campaign).slice(0, 150)}`,
      input.campaign_id && `Campaign ID: ${String(input.campaign_id).slice(0, 100)}`,
      input.adset_id && `Ad set ID: ${String(input.adset_id).slice(0, 100)}`,
      input.ad_id && `Ad ID: ${String(input.ad_id).slice(0, 100)}`
    ].filter(Boolean).join(" | ");
    const payload = {
      bill_full_name: fullName,
      bill_phone_number: phone,
      shipping_address: fullAddress,
      province_id: input.province_id || null,
      district_id: input.city_id || null,
      commune_id: input.barangay_id || null,
      is_free_shipping: true,
      shipping_fee: 0,
      received_at_shop: false,
      note: [
        `COD Order via VISION X SAHA | Page: ${sourcePage} | Pack: ${bundle.label} | Landmark: ${landmark || "N/A"}`,
        attribution
      ].filter(Boolean).join(" | "),
      items: [{
        product_id: productId,
        variation_id: variationId,
        quantity: bundle.quantity,
        price: bundle.price
      }],
      total_discount: 0,
      status: 0
    };

    const body = await pancakeJson(
      `${PANCAKE_API}/shops/${encodeURIComponent(shopId)}/orders?api_key=${encodeURIComponent(apiKey)}`,
      { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) }
    );
    const orderId = extractOrderId(body);
    if (!orderId) {
      return NextResponse.json({ error: "The order reached Pancake, but its order ID was not returned. Do not submit again." }, { status: 502 });
    }

    // Order confirmation SMS (customer replies YES/NO). Only when automation is live.
    try {
      const auto = await loadSmsAutomationConfig();
      if (auto.mode === "live") {
        const first = fullName.split(/\s+/)[0] || "Customer";
        const confirmMsg = `${first}, i-confirm ang order mo #${orderId}: ${bundle.label}, COD P${bundle.price}. Reply YES kung tama o NO kung gusto i-cancel. Salamat!`;
        await sendTrackedInfotxtSms({
          orderId,
          event: "order_confirmation",
          eventLabel: "Order confirmation",
          recipient: "customer",
          phone,
          message: confirmMsg,
          source: "order_confirmation",
          eventAt: `order-${orderId}`,
          templateVersion: auto.version
        });
      }
    } catch (smsError) {
      console.error("VISION X SAHA confirmation SMS failed", smsError instanceof Error ? smsError.message : "Unknown error");
    }

    let eventId = String(input.event_id || `visionsaha-${orderId}`);
    let capiSent = false;
    try {
      const capi = await sendVisionSahaPurchase({
        request,
        eventId,
        sourceUrl: input.event_source_url,
        fullName,
        phone,
        city: input.city,
        province: input.province,
        fbp: input.fbp,
        fbc: input.fbc,
        value: bundle.price,
        contentName: bundle.label,
        contentIds: [productId],
        orderId: String(orderId)
      });
      eventId = capi.eventId;
      capiSent = capi.eventsReceived > 0;
    } catch (capiError) {
      console.error("VISION X SAHA Meta CAPI Purchase failed", capiError instanceof Error ? capiError.message : "Unknown error");
    }

    return NextResponse.json({
      success: true,
      order_id: String(orderId),
      value: bundle.price,
      bundle_label: bundle.label,
      event_id: eventId,
      capi_sent: capiSent
    });
  } catch (error) {
    console.error("VISION X SAHA order creation failed", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to create order." }, { status: 502 });
  }
}

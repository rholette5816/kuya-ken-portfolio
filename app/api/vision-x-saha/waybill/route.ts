import { NextRequest, NextResponse } from "next/server";
import {
  visionArray,
  visionNumber,
  visionOrderValue,
  visionTrackingNumber
} from "../../../lib/visionPancakeOrders";

export const dynamic = "force-dynamic";

const PANCAKE_API = "https://pos.pages.fm/api/v1";
const PRIVATE_HEADERS = {
  "Cache-Control": "private, no-store",
  "X-Robots-Tag": "noindex, nofollow, noarchive"
};

function settings() {
  const apiKey = process.env.VISION_X_SAHA_PANCAKE_API_KEY || process.env.PANCAKE_API_KEY;
  const shopId = process.env.VISION_X_SAHA_PANCAKE_SHOP_ID || process.env.PANCAKE_SHOP_ID;
  if (!apiKey || !shopId) throw new Error("Pancake POS access is not configured.");
  return { apiKey, shopId };
}

function validOrderId(value: unknown) {
  const orderId = String(value || "").trim();
  return /^\d{1,30}$/.test(orderId) ? orderId : "";
}

async function pancakeJson(url: string, init?: RequestInit) {
  const response = await fetch(url, { ...init, cache: "no-store" });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body?.error) {
    throw new Error(body?.error?.message || body?.message || `Pancake returned ${response.status}.`);
  }
  return body;
}

function text(value: unknown) {
  return typeof value === "string" || typeof value === "number" ? String(value).trim() : "";
}

function fullAddress(address: any) {
  const direct = text(address?.full_address || address?.new_full_address || address?.marketplace_address);
  if (direct) return direct;
  return [
    address?.address,
    address?.commune_name || address?.commnue_name,
    address?.district_name,
    address?.province_name,
    address?.post_code
  ].map(text).filter(Boolean).join(", ");
}

function itemName(item: any) {
  return text(
    item?.variation_info?.name
    || item?.variation_info?.product_display_id
    || item?.one_time_product?.name
    || item?.product_name
    || item?.name
  ) || "Product";
}

function normalizeOrder(order: any) {
  const address = order?.shipping_address || {};
  const warehouse = order?.warehouse_info || {};
  const partner = order?.partner || {};
  const items = visionArray(order?.items).map(item => ({
    name: itemName(item),
    sku: text(item?.variation_info?.display_id || item?.variation_info?.barcode),
    quantity: Math.max(0, visionNumber(item?.quantity)),
    note: text(item?.note_product || item?.note)
  }));

  return {
    orderId: text(order?.id || order?.order_id),
    systemId: text(order?.system_id),
    createdAt: text(order?.inserted_at || order?.created_at),
    status: text(order?.status_name || order?.status),
    recipient: {
      name: text(order?.bill_full_name || address?.full_name || order?.customer?.name) || "Customer",
      phone: text(order?.bill_phone_number || address?.phone_number),
      address: fullAddress(address)
    },
    sender: {
      name: text(warehouse?.name) || "VISION X SAHA",
      phone: text(warehouse?.phone_number),
      address: text(warehouse?.full_address || warehouse?.address)
    },
    items,
    totalQuantity: items.reduce((sum, item) => sum + item.quantity, 0),
    cod: visionOrderValue(order),
    printNote: text(order?.note_print),
    courier: text(partner?.partner_name || partner?.name || order?.shipping_partner) || "Not yet assigned",
    tracking: visionTrackingNumber(order),
    sortCode: text(partner?.sort_code),
    service: text(partner?.service_partner),
    sentToCourierAt: text(order?.time_send_partner)
  };
}

async function exactOrder(orderId: string) {
  const { apiKey, shopId } = settings();
  const params = new URLSearchParams({ api_key: apiKey });
  const body = await pancakeJson(`${PANCAKE_API}/shops/${encodeURIComponent(shopId)}/orders/${encodeURIComponent(orderId)}?${params}`);
  const order = body?.data || body?.order || body;
  if (!order || typeof order !== "object" || !text(order.id || order.order_id)) {
    throw new Error("Pancake did not return the selected order.");
  }
  return order;
}

export async function GET(request: NextRequest) {
  const orderId = validOrderId(request.nextUrl.searchParams.get("orderId"));
  if (!orderId) {
    return NextResponse.json({ error: "A valid order ID is required." }, { status: 400, headers: PRIVATE_HEADERS });
  }

  try {
    const order = await exactOrder(orderId);
    return NextResponse.json({ waybill: normalizeOrder(order) }, { headers: PRIVATE_HEADERS });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "The waybill data could not be loaded." },
      { status: 502, headers: PRIVATE_HEADERS }
    );
  }
}

export async function POST(request: NextRequest) {
  const input = await request.json().catch(() => ({}));
  const requestedIds = Array.isArray(input?.orderIds) ? input.orderIds : [input?.orderId];
  if (!requestedIds.length || requestedIds.length > 50) {
    return NextResponse.json({ error: "Select between 1 and 50 orders." }, { status: 400, headers: PRIVATE_HEADERS });
  }
  const normalizedIds = requestedIds.map(validOrderId);
  if (normalizedIds.some((orderId: string) => !orderId)) {
    return NextResponse.json({ error: "Every selected order must have a valid order ID." }, { status: 400, headers: PRIVATE_HEADERS });
  }
  const orderIds = Array.from(new Set(normalizedIds));

  try {
    const { apiKey, shopId } = settings();
    const params = new URLSearchParams({ api_key: apiKey, document_type: "SHIPPING_LABEL" });
    const body = await pancakeJson(
      `${PANCAKE_API}/shops/${encodeURIComponent(shopId)}/products/get_logistics_shipping_document?${params}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ params: orderIds.map(orderId => ({ order_id: orderId })) })
      }
    );
    const urls = (Array.isArray(body?.data) ? body.data : [])
      .map((value: unknown) => text(value))
      .filter((value: string) => {
        try { return new URL(value).protocol === "https:"; } catch { return false; }
      });
    if (!urls.length) throw new Error("Pancake did not return an official shipping-label link.");
    return NextResponse.json({ urls, orderCount: orderIds.length }, { headers: PRIVATE_HEADERS });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "The official label could not be prepared." },
      { status: 502, headers: PRIVATE_HEADERS }
    );
  }
}

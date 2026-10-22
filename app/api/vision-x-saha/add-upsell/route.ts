import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { sendVisionSahaPurchase } from "../../../../lib/vision-saha-meta-capi";

export const dynamic = "force-dynamic";

const API = "https://pos.pages.fm/api/v1";
const SUPPORT_LINK = "m.me/791854314012769";
const offers: Record<string, { quantity: number; total: number }> = {
  extra_2: { quantity: 2, total: 299 },
  extra_4: { quantity: 4, total: 499 },
  extra_6: { quantity: 6, total: 699 }
};
const UPSELL_MARKER = "VISION_SAHA_EXTRA_LAKATAN";

async function json(url: string, init?: RequestInit) {
  const response = await fetch(url, {
    ...init,
    cache: "no-store",
    signal: init?.signal || AbortSignal.timeout(12000)
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body?.message || "Pancake request failed.");
  return body.data || body;
}

function amount(order: any) {
  const value = Number(order.cod || order.total_price_after_sub_discount || order.total_price || 0);
  return value > 10000 ? value / 100 : value;
}

async function sendUpdatedConfirmation(order: any, orderId: string, total: number, quantity: number) {
  // Upsell SMS removed: customers only receive order confirmation + tracking SMS.
  void order; void orderId; void total; void quantity;
  return "skipped";
}

async function updateOrderSheet(orderId: string, quantity: number, total: number) {
  const sheetId = process.env.VISION_X_SAHA_SHEET_ID;
  if (!sheetId) throw new Error("Vision Saha Sheet is not configured.");
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON || "{}");
  const auth = new google.auth.GoogleAuth({ credentials, scopes: ["https://www.googleapis.com/auth/spreadsheets"] });
  const sheets = google.sheets({ version: "v4", auth });
  const result = await sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: "Orders!A2:O" });
  const rows = result.data.values || [];
  const index = rows.findIndex(row => String(row[1] || "") === orderId);
  if (index < 0) throw new Error("Order was not found in the Vision Saha Sheet.");
  const row = rows[index];
  while (row.length < 15) row.push("");
  row[4] = `${String(row[4] || "Lakatan Saha")} + ${quantity} extra Lakatan Saha`;
  row[5] = String(total);
  await sheets.spreadsheets.values.update({
    spreadsheetId: sheetId,
    range: `Orders!A${index + 2}:O${index + 2}`,
    valueInputOption: "RAW",
    requestBody: { values: [row] }
  });
}

export async function POST(request: NextRequest) {
  const key = process.env.VISION_X_SAHA_PANCAKE_API_KEY;
  const shop = process.env.VISION_X_SAHA_PANCAKE_SHOP_ID;
  if (!key || !shop) return NextResponse.json({ error: "Order system is not configured." }, { status: 503 });

  const input = await request.json().catch(() => null);
  if (!input?.order_id) return NextResponse.json({ error: "Invalid order." }, { status: 400 });

  try {
    const url = `${API}/shops/${encodeURIComponent(shop)}/orders/${encodeURIComponent(input.order_id)}?api_key=${encodeURIComponent(key)}`;
    const order = await json(url);

    if (input.action === "cancel_test_order") {
      if (!/^TEST\b/i.test(String(order.bill_full_name || "").trim())) {
        return NextResponse.json({ error: "Only QA test orders can use this action." }, { status: 403 });
      }
      await json(url, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: Number(input.order_id),
          status: 6,
          note: [order.note, "QA TEST COMPLETED, DO NOT FULFILL"].filter(Boolean).join(" | ")
        })
      });
      const canceled = await json(url);
      return NextResponse.json({ success: true, order_id: String(input.order_id), status: canceled.status_name || "canceled", status_code: canceled.status });
    }

    const offer = offers[input?.offer];
    if (!offer) return NextResponse.json({ error: "Invalid add-on selection." }, { status: 400 });

    const before = amount(order);
    const items = Array.isArray(order.items) ? order.items : [];
    const existingMarker = String(order.note || "").includes(UPSELL_MARKER);
    if (existingMarker) {
      return NextResponse.json({
        success: true,
        already_added: true,
        quantity: 0,
        add_on: 0,
        new_total: before,
        confirmation_sms: "already_processed",
        event_id: String(input.event_id || `visionsaha-upsell-${input.order_id}`),
        capi_sent: false
      });
    }

    const configuredProduct = process.env.VISION_X_SAHA_LAKATAN_PRODUCT_ID;
    const baseItem = items.find((item: any) => configuredProduct && String(item.product_id) === String(configuredProduct))
      || items.find((item: any) => String(item.product_name || item.name || item.variation_info?.name || "").toLowerCase().includes("lakatan"))
      || items[0];
    const productId = baseItem?.product_id || baseItem?.product?.id;
    const variationId = baseItem?.variation_id || baseItem?.variation_info?.id || baseItem?.variation?.id;
    if (!productId || !variationId) throw new Error("The Lakatan product on the original order could not be verified.");

    await json(url, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        id: Number(input.order_id),
        items: [...items, { product_id: productId, variation_id: variationId, quantity: offer.quantity, price: offer.total }],
        note: [order.note, `${UPSELL_MARKER}: ${offer.quantity} pcs for P${offer.total}`].filter(Boolean).join(" | "),
        is_free_shipping: true,
        shipping_fee: 0,
        total_discount: Number(order.total_discount || 0)
      })
    });

    const verified = await json(url);
    const computed = amount(verified);
    const expectedTotal = before + offer.total;
    if (computed + 1 < expectedTotal) throw new Error("Pancake did not confirm the updated COD total.");
    const total = computed;
    let eventId = String(input.event_id || `visionsaha-upsell-${input.order_id}`);
    const [smsResult, capiResult, sheetResult] = await Promise.allSettled([
      sendUpdatedConfirmation(order, String(input.order_id), total, offer.quantity),
      sendVisionSahaPurchase({
        request,
        eventName: "UpsellAccepted",
        eventId,
        sourceUrl: input.event_source_url,
        fullName: String(input.full_name || order.bill_full_name || order.full_name || "Customer"),
        phone: String(input.phone || order.bill_phone_number || order.phone_number || ""),
        city: input.city,
        province: input.province,
        fbp: input.fbp,
        fbc: input.fbc,
        value: offer.total,
        contentName: `Extra Lakatan Saha x${offer.quantity}`,
        contentIds: [String(productId)],
        orderId: `${input.order_id}-upsell`
      }),
      updateOrderSheet(String(input.order_id), offer.quantity, total)
    ]);

    const confirmationSms = smsResult.status === "fulfilled" ? smsResult.value : "failed";
    if (smsResult.status === "rejected") {
      console.error("VISION X SAHA upsell confirmation SMS failed", smsResult.reason instanceof Error ? smsResult.reason.message : "Unknown error");
    }
    if (sheetResult.status === "rejected") {
      console.error("VISION X SAHA upsell Sheet update failed", sheetResult.reason instanceof Error ? sheetResult.reason.message : "Unknown error");
    }

    let capiSent = false;
    if (capiResult.status === "fulfilled") {
      eventId = capiResult.value.eventId;
      capiSent = capiResult.value.eventsReceived > 0;
    } else {
      console.error("VISION X SAHA Meta CAPI upsell failed", capiResult.reason instanceof Error ? capiResult.reason.message : "Unknown error");
    }

    return NextResponse.json({ success: true, quantity: offer.quantity, add_on: offer.total, new_total: total, confirmation_sms: confirmationSms, sheet_updated: sheetResult.status === "fulfilled", event_id: eventId, capi_sent: capiSent });
  } catch (error) {
    console.error("VISION X SAHA upsell failed", error);
    return NextResponse.json({ error: "Hindi maidagdag ang add-on ngayon. Hindi nabago ang iyong order." }, { status: 502 });
  }
}

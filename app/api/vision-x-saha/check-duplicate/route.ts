import { NextRequest, NextResponse } from "next/server";
export const dynamic = "force-dynamic";
const API = "https://pos.pages.fm/api/v1";
export async function POST(req: NextRequest) {
  const key = process.env.VISION_X_SAHA_PANCAKE_API_KEY;
  const shop = process.env.VISION_X_SAHA_PANCAKE_SHOP_ID;
  const { phone } = await req.json().catch(() => ({ phone: "" }));
  if (!key || !shop) return NextResponse.json({ error: "Order system is not configured." }, { status: 503 });
  if (!/^09\d{9}$/.test(String(phone || "").trim())) return NextResponse.json({ error: "Invalid phone." }, { status: 400 });
  try {
    const q = new URLSearchParams({ api_key: key, search: String(phone).trim(), page_size: "20", page_number: "1" });
    const r = await fetch(`${API}/shops/${encodeURIComponent(shop)}/orders?${q}`, { cache: "no-store" });
    const body = await r.json();
    if (!r.ok) throw new Error("Pancake lookup failed");
    const terminal = new Set(["delivered", "returned", "returning", "cancelled", "canceled", "deleted", "failed"]);
    const active = (Array.isArray(body.data) ? body.data : []).find((o: any) => !o.cancelled && !o.is_cancelled && !o.deleted && !o.is_deleted && !terminal.has(String(o.status_name || "").toLowerCase()) && ![3,4,5,6,7].includes(Number(o.status)));
    if (!active) return NextResponse.json({ duplicate: false });
    const item = Array.isArray(active.items) ? active.items[0] : null;
    const raw = Number(active.cod || active.total_price_after_sub_discount || active.total_price || 0);
    return NextResponse.json({ duplicate: true, order: { id: active.id || active.order_id, bundle: item?.variation_info?.name || item?.product_name || "Lakatan Saha", cod: raw > 10000 ? raw / 100 : raw, status: active.status_name || "Active" } });
  } catch (error) {
    console.error("VISION X SAHA duplicate check failed", error);
    return NextResponse.json({ error: "Hindi ma-check ang existing order ngayon." }, { status: 502 });
  }
}

import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin) {
    try {
      if (new URL(origin).host !== request.nextUrl.host) return NextResponse.json({ error: "Cross-site request rejected." }, { status: 403 });
    } catch {
      return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
    }
  }
  const secret = process.env.VISION_X_SAHA_ANALYTICS_SECRET;
  if (!secret) return NextResponse.json({ error: "Inventory service is not configured." }, { status: 503 });
  const input = await request.json().catch(() => null);
  if (!input) return NextResponse.json({ error: "Invalid inventory request." }, { status: 400 });
  try {
    const response = await fetch("https://www.securecodexpress.xyz/api/vision-saha-operations", {
      method: "POST",
      headers: { authorization: `Bearer ${secret}`, "content-type": "application/json" },
      body: JSON.stringify({ action: "inventory_adjust", mode: input.mode, quantity: input.quantity, note: input.note }),
      cache: "no-store"
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) return NextResponse.json({ error: body.error || "Inventory adjustment could not be saved." }, { status: response.status });
    return NextResponse.json(body, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "Inventory service could not be reached." }, { status: 502 });
  }
}

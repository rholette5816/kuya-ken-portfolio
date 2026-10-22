import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const categories = new Set(["Packaging", "Inventory", "Equipment", "Advertising", "Courier", "Other"]);
const contributors = new Set(["Kevin", "Rustan"]);
const rateLimits = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(ip: string) {
  const now = Date.now();
  const current = rateLimits.get(ip);
  if (!current || now > current.resetAt) {
    rateLimits.set(ip, { count: 1, resetAt: now + 10 * 60 * 1000 });
    return false;
  }
  if (current.count >= 15) return true;
  current.count += 1;
  return false;
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin) {
    try {
      if (new URL(origin).host !== request.nextUrl.host) return NextResponse.json({ error: "Cross-site request rejected." }, { status: 403 });
    } catch {
      return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
    }
  }
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
  if (isRateLimited(ip)) {
    return NextResponse.json({ error: "Too many capital entries. Please wait before trying again." }, { status: 429 });
  }
  const secret = process.env.VISION_X_SAHA_ANALYTICS_SECRET;
  if (!secret) return NextResponse.json({ error: "Capital logging is not configured." }, { status: 503 });

  const input = await request.json().catch(() => null);
  const contributor = String(input?.contributor || "").trim();
  const category = String(input?.category || "").trim();
  const description = String(input?.description || "").trim();
  const quantity = String(input?.quantity || "").trim();
  const amount = Number(input?.amount);
  const proofLink = String(input?.proofLink || "").trim();
  const notes = String(input?.notes || "").trim();
  if (!contributors.has(contributor) || !categories.has(category) || !description || !quantity || !Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "Complete the contributor, category, description, quantity, and amount." }, { status: 400 });
  }
  if (description.length > 160 || quantity.length > 80 || notes.length > 500 || proofLink.length > 500 || amount > 100000000) {
    return NextResponse.json({ error: "One or more fields exceed the allowed limits." }, { status: 400 });
  }

  try {
    const response = await fetch("https://www.securecodexpress.xyz/api/vision-saha-operations", {
      method: "POST",
      headers: { authorization: `Bearer ${secret}`, "content-type": "application/json" },
      body: JSON.stringify({ contributor, category, description, quantity, amount, proofLink, notes }),
      cache: "no-store",
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) return NextResponse.json({ error: body.error || "Capital entry could not be saved." }, { status: response.status });
    return NextResponse.json(body, { status: 201, headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "Capital logging service could not be reached." }, { status: 502 });
  }
}

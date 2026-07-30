import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

const COOKIE_NAME = "rminds_confidential_access";

function unlocked(request: NextRequest) {
  const pin = process.env.RMINDS_CONFIDENTIAL_PIN;
  return Boolean(pin && request.cookies.get(COOKIE_NAME)?.value === pin);
}

export async function GET(request: NextRequest) {
  return NextResponse.json({ unlocked: unlocked(request) }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  const expected = process.env.RMINDS_CONFIDENTIAL_PIN || "";
  const body = await request.json().catch(() => ({}));
  const supplied = typeof body.code === "string" ? body.code.trim() : "";
  const valid = expected.length === supplied.length && expected.length > 0 && timingSafeEqual(Buffer.from(expected), Buffer.from(supplied));
  if (!valid) return NextResponse.json({ error: "Access denied. The code is incorrect." }, { status: 401 });

  const response = NextResponse.json({ unlocked: true });
  response.cookies.set(COOKIE_NAME, expected, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 60 * 60 * 12
  });
  return response;
}

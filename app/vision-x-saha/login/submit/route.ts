import { createHash, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

const COOKIE_NAME = "vision_x_saha_access";
const attempts = new Map<string, { count: number; resetAt: number }>();

function safeEqual(left: string, right: string) {
  const leftHash = createHash("sha256").update(left).digest();
  const rightHash = createHash("sha256").update(right).digest();
  return timingSafeEqual(leftHash, rightHash);
}

function isRateLimited(ip: string) {
  const now = Date.now();
  const current = attempts.get(ip);
  if (!current || now > current.resetAt) {
    attempts.set(ip, { count: 1, resetAt: now + 15 * 60 * 1000 });
    return false;
  }
  current.count += 1;
  return current.count > 8;
}

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
  if (isRateLimited(ip)) {
    return NextResponse.redirect(new URL("/vision-x-saha/login?error=rate", request.url), 303);
  }

  const accounts = [
    {
      username: process.env.VISION_X_SAHA_DASHBOARD_USERNAME,
      password: process.env.VISION_X_SAHA_DASHBOARD_PASSWORD,
      accessToken: process.env.VISION_X_SAHA_DASHBOARD_ACCESS_TOKEN
    },
    {
      username: process.env.VISION_X_SAHA_RUSTAN_USERNAME,
      password: process.env.VISION_X_SAHA_RUSTAN_PASSWORD,
      accessToken: process.env.VISION_X_SAHA_RUSTAN_ACCESS_TOKEN
    }
  ].filter(account => account.username && account.password && account.accessToken);
  if (!accounts.length) {
    return new NextResponse("VISION X SAHA access is not configured.", { status: 503 });
  }

  const formData = await request.formData();
  const username = String(formData.get("username") || "").slice(0, 80);
  const password = String(formData.get("password") || "").slice(0, 200);
  const account = accounts.find(candidate => safeEqual(username, candidate.username!) && safeEqual(password, candidate.password!));
  if (!account) {
    return NextResponse.redirect(new URL("/vision-x-saha/login?error=1", request.url), 303);
  }

  attempts.delete(ip);
  const response = NextResponse.redirect(new URL("/vision-x-saha", request.url), 303);
  response.cookies.set({
    name: COOKIE_NAME,
    value: account.accessToken!,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 60 * 60 * 24 * 7
  });
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}


import { NextRequest, NextResponse } from "next/server";

const OS_COOKIE_NAME = "kra_os_access";

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const username = String(formData.get("username") || "");
  const password = String(formData.get("password") || "");
  const nextPath = String(formData.get("next") || "/system/dashboard");

  const expectedUsername = process.env.KRA_OS_ACCESS_USERNAME;
  const expectedPassword = process.env.KRA_OS_ACCESS_PASSWORD;
  const accessToken = process.env.KRA_OS_ACCESS_TOKEN;

  if (!expectedUsername || !expectedPassword || !accessToken) {
    return new NextResponse("System access is not configured.", { status: 503 });
  }

  if (username !== expectedUsername || password !== expectedPassword) {
    const failUrl = new URL("/system/login", request.url);
    failUrl.searchParams.set("error", "1");
    failUrl.searchParams.set("next", nextPath);
    return NextResponse.redirect(failUrl, 303);
  }

  const safeNext = nextPath.startsWith("/system/dashboard") ? nextPath : "/system/dashboard";
  const redirectUrl = new URL(safeNext, request.url);
  const response = NextResponse.redirect(redirectUrl, 303);

  response.cookies.set({
    name: OS_COOKIE_NAME,
    value: accessToken,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7
  });

  return response;
}

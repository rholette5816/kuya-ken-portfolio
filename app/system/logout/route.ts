import { NextRequest, NextResponse } from "next/server";

const OS_COOKIE_NAME = "kra_os_access";

export async function POST(request: NextRequest) {
  const redirectUrl = new URL("/system/login", request.url);
  const response = NextResponse.redirect(redirectUrl, 303);

  response.cookies.set({
    name: OS_COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0
  });

  return response;
}

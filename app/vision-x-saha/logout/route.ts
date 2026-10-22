import { NextRequest, NextResponse } from "next/server";

const COOKIE_NAME = "vision_x_saha_access";

function clearSession(request: NextRequest) {
  const response = NextResponse.redirect(new URL("/vision-x-saha/login", request.url), 303);
  response.cookies.set({
    name: COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 0
  });
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export async function GET(request: NextRequest) {
  return clearSession(request);
}

export async function POST(request: NextRequest) {
  return clearSession(request);
}


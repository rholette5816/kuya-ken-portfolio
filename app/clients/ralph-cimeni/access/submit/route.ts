import { NextRequest, NextResponse } from "next/server";

const COOKIE_NAME = "kra_ralph_client_access";

export async function POST(request: NextRequest) {
  const token = process.env.RALPH_CLIENT_ACCESS_TOKEN;
  if (!token) return new NextResponse("Client access is not configured.", { status: 503 });

  const form = await request.formData();
  const accessCode = String(form.get("accessCode") || "");
  if (accessCode !== token) {
    return NextResponse.redirect(new URL("/clients/ralph-cimeni/access?error=1", request.url), 303);
  }

  const response = NextResponse.redirect(new URL("/clients/ralph-cimeni#agreement", request.url), 303);
  response.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 60 * 60 * 12
  });
  return response;
}

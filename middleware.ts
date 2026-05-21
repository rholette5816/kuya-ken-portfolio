import { NextRequest, NextResponse } from "next/server";

const PRIMARY_HOST = "www.kradigital.site";
const OS_COOKIE_NAME = "kra_os_access";
const OS_LOGIN_PATH = "/system/login";
const OS_LOGIN_SUBMIT_PATH = "/system/login/submit";

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function normalizeResumePath(pathname: string): string | null {
  const decoded = safeDecode(pathname);
  const compact = decoded.replace(/\u00A0/g, " ");
  const cleaned = compact.replace(/(&nbsp;?)+$/i, "").trim();

  if (cleaned === "/resume" || cleaned === "/resume/") {
    return "/resume";
  }

  return null;
}

export function middleware(request: NextRequest) {
  const { nextUrl, headers } = request;
  const host = headers.get("host") ?? "";
  const normalizedResumePath = normalizeResumePath(nextUrl.pathname);
  const pathname = nextUrl.pathname;
  const osToken = process.env.KRA_OS_ACCESS_TOKEN;

  const isProtectedOSRoute = pathname.startsWith("/system/dashboard");
  const isOSLoginRequest = pathname === OS_LOGIN_PATH;

  if (normalizedResumePath && normalizedResumePath !== nextUrl.pathname) {
    const url = new URL(normalizedResumePath + nextUrl.search, `${nextUrl.protocol}//${host}`);
    return NextResponse.redirect(url, 308);
  }

  if (isProtectedOSRoute) {
    if (!osToken) {
      return new NextResponse("System access is not configured. Set KRA_OS_ACCESS_TOKEN.", {
        status: 503
      });
    }

    const cookieValue = request.cookies.get(OS_COOKIE_NAME)?.value;
    if (cookieValue !== osToken) {
      const loginUrl = new URL(OS_LOGIN_PATH, `${nextUrl.protocol}//${host}`);
      loginUrl.searchParams.set("next", pathname + nextUrl.search);
      return NextResponse.redirect(loginUrl, 307);
    }
  }

  if (isOSLoginRequest && osToken) {
    const cookieValue = request.cookies.get(OS_COOKIE_NAME)?.value;
    if (cookieValue === osToken && request.method === "GET") {
      const destination = nextUrl.searchParams.get("next") || "/system/dashboard";
      const url = new URL(destination, `${nextUrl.protocol}//${host}`);
      return NextResponse.redirect(url, 307);
    }
  }

  // Force canonical domain in production for any Vercel-hosted URL.
  if (host.endsWith(".vercel.app") && process.env.NODE_ENV === "production") {
    const url = new URL(nextUrl.pathname + nextUrl.search, `https://${PRIMARY_HOST}`);
    return NextResponse.redirect(url, 308);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
};

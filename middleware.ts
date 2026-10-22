import { NextRequest, NextResponse } from "next/server";

const PRIMARY_HOST = "www.kradigital.site";
const OS_COOKIE_NAME = "kra_os_access";
const OS_LOGIN_PATH = "/system/login";
const OS_LOGIN_SUBMIT_PATH = "/system/login/submit";
const VXS_COOKIE_NAME = "vision_x_saha_access";
const VXS_LOGIN_PATH = "/vision-x-saha/login";
const CONFIDENTIAL_COOKIE = "rminds_confidential_access";
const RMINDS_SECTIONS = new Set(["audit", "evidence", "plan", "agreement", "billing", "onboarding", "live", "inputs", "budget", "spend", "analyze", "pages", "report", "approve", "log"]);

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
  const vxsTokens = [
    process.env.VISION_X_SAHA_DASHBOARD_ACCESS_TOKEN,
    process.env.VISION_X_SAHA_RUSTAN_ACCESS_TOKEN
  ].filter((token): token is string => Boolean(token));
  const confidentialPin = process.env.RMINDS_CONFIDENTIAL_PIN;
  const isAuthorizedSmsMonitor = pathname === "/api/vision-x-saha/sms-monitor"
    && Boolean(process.env.CRON_SECRET)
    && headers.get("authorization") === `Bearer ${process.env.CRON_SECRET}`;

  const rmindsSection = pathname.match(/^\/rminds\/([^/]+)\/?$/)?.[1];
  if (rmindsSection && RMINDS_SECTIONS.has(rmindsSection)) {
    const url = nextUrl.clone();
    url.pathname = "/rminds";
    url.searchParams.set("section", rmindsSection);
    return NextResponse.rewrite(url);
  }

  if (pathname === "/client-dashboards/ralph-cimeni/agreement.html" && (!confidentialPin || request.cookies.get(CONFIDENTIAL_COOKIE)?.value !== confidentialPin)) {
    return new NextResponse("Access denied.", { status: 401, headers: { "Cache-Control": "no-store" } });
  }

  const isProtectedCommandApi = pathname === "/api/vision-x-saha/live"
    || pathname === "/api/vision-x-saha/orders"
    || pathname === "/api/vision-x-saha/waybill"
    || pathname === "/api/vision-x-saha/rider-contact"
    || pathname === "/api/vision-x-saha/order-activity"
    || pathname === "/api/vision-x-saha/courier-complaints"
    || pathname === "/api/vision-x-saha/inventory"
    || pathname === "/api/vision-x-saha/post-library"
    || pathname === "/api/vision-x-saha/rename-ranked-ads"
    || pathname === "/api/vision-x-saha/sms-connection"
    || pathname === "/api/vision-x-saha/sms-send-test"
    || pathname === "/api/vision-x-saha/sms-status"
    || pathname === "/api/vision-x-saha/sms-automation"
    || pathname === "/api/vision-x-saha/capital"
    || pathname === "/api/vision-x-saha/settlements";
  const isVisionLoginRoute = pathname === VXS_LOGIN_PATH || pathname === "/vision-x-saha/login/submit";
  const isVisionLogoutRoute = pathname === "/vision-x-saha/logout";
  const isProtectedVisionRoute = (pathname === "/vision-x-saha" || pathname.startsWith("/vision-x-saha/"))
    && !isVisionLoginRoute
    && !isVisionLogoutRoute;
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

  if (isProtectedVisionRoute || isProtectedCommandApi) {
    if (!vxsTokens.length) {
      const message = "VISION X SAHA access is not configured.";
      return isProtectedCommandApi
        ? NextResponse.json({ error: message }, { status: 503, headers: { "Cache-Control": "private, no-store" } })
        : new NextResponse(message, { status: 503 });
    }

    if (!vxsTokens.includes(request.cookies.get(VXS_COOKIE_NAME)?.value || "")) {
      if (isProtectedCommandApi) {
        return NextResponse.json({ error: "Unauthorized." }, {
          status: 401,
          headers: { "Cache-Control": "private, no-store" }
        });
      }
      return NextResponse.redirect(new URL(VXS_LOGIN_PATH, `${nextUrl.protocol}//${host}`), 307);
    }
  }

  if (pathname === VXS_LOGIN_PATH && vxsTokens.includes(request.cookies.get(VXS_COOKIE_NAME)?.value || "") && request.method === "GET") {
    return NextResponse.redirect(new URL("/vision-x-saha", `${nextUrl.protocol}//${host}`), 307);
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
  if (host.endsWith(".vercel.app") && process.env.NODE_ENV === "production" && !isAuthorizedSmsMonitor) {
    const url = new URL(nextUrl.pathname + nextUrl.search, `https://${PRIMARY_HOST}`);
    return NextResponse.redirect(url, 308);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
};

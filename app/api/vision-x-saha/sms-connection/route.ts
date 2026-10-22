import { NextRequest, NextResponse } from "next/server";
import { loadSmsConfigView, saveSmsConfig } from "../../../lib/visionSmsConfig";

export const dynamic = "force-dynamic";

const PRIVATE_HEADERS = { "Cache-Control": "private, no-store, max-age=0" };
const API_KEY_PATTERN = /^\S{8,256}$/;
const USER_ID_PATTERN = /^\d{1,20}$/;
const SIM_SLOT_PATTERN = /^\d{1,3}$/;
const SIM_MOBILE_PATTERN = /^(?:\+?63|0)9\d{9}$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const COOKIE_NAME = "vision_x_saha_access";

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: PRIVATE_HEADERS });
}

// Which signed-in operator made the change, for the audit stamp. Middleware has
// already enforced that the cookie is one of the valid access tokens.
function operatorLabel(request: NextRequest): string {
  const token = request.cookies.get(COOKIE_NAME)?.value || "";
  if (token && token === process.env.VISION_X_SAHA_RUSTAN_ACCESS_TOKEN) return "rustan";
  if (token && token === process.env.VISION_X_SAHA_DASHBOARD_ACCESS_TOKEN) return "kevin";
  return "vision-x-saha";
}

export async function GET() {
  const view = await loadSmsConfigView();
  return json({
    provider: "INFOTXT",
    configured: view.configured,
    source: view.source,
    maskedUserId: view.maskedUserId,
    maskedKey: view.maskedKey,
    simSlot: view.simSlot,
    maskedSimMobile: view.maskedSimMobile,
    expiresAt: view.expiresAt,
    updatedAt: view.updatedAt,
    updatedBy: view.updatedBy,
    trackingEnabled: process.env.SMS_TRACKING_ENABLED !== "false"
  });
}

export async function POST(request: NextRequest) {
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > 16 * 1024) return json({ error: "Request is too large." }, 413);
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (origin && host) {
    try {
      if (new URL(origin).host !== host) return json({ error: "Request origin is not allowed." }, 403);
    } catch {
      return json({ error: "Request origin is not valid." }, 403);
    }
  }

  let body: { userId?: unknown; apiKey?: unknown; simSlot?: unknown; simMobile?: unknown; expiresAt?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid request." }, 400);
  }

  const userId = typeof body.userId === "string" ? body.userId.trim() : "";
  const apiKey = typeof body.apiKey === "string" ? body.apiKey.trim() : "";
  const simSlot = typeof body.simSlot === "string" ? body.simSlot.trim() : "";
  const simMobile = typeof body.simMobile === "string" ? body.simMobile.trim().replace(/[\s()-]/g, "") : "";
  const expiresAt = typeof body.expiresAt === "string" ? body.expiresAt.trim() : "";
  if (!USER_ID_PATTERN.test(userId)) return json({ error: "Enter the numeric INFOTXT User ID." }, 400);
  if (!API_KEY_PATTERN.test(apiKey)) return json({ error: "Enter a valid INFOTXT API key." }, 400);
  if (!SIM_SLOT_PATTERN.test(simSlot)) return json({ error: "Enter the INFOTXT SIM slot number." }, 400);
  if (!SIM_MOBILE_PATTERN.test(simMobile)) return json({ error: "Enter the Philippine SIM mobile number assigned by INFOTXT." }, 400);
  if (!DATE_PATTERN.test(expiresAt) || Number.isNaN(Date.parse(`${expiresAt}T00:00:00+08:00`))) return json({ error: "Enter the credential expiry date." }, 400);

  try {
    const saved = await saveSmsConfig({ userId, apiKey, simSlot, simMobile, expiresAt }, operatorLabel(request));
    return json({
      valid: true,
      saved: true,
      provider: "INFOTXT",
      maskedUserId: `${"*".repeat(Math.max(1, userId.length - 2))}${userId.slice(-2)}`,
      simSlot: saved.simSlot,
      maskedKey: `${"*".repeat(Math.min(8, Math.max(0, apiKey.length - 4)))}${apiKey.slice(-4)}`,
      expiresAt: saved.expiresAt,
      updatedAt: saved.updatedAt,
      message: "INFOTXT account credentials saved privately. No test SMS was sent and live automation remains locked."
    });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "The credentials could not be saved." }, 502);
  }
}

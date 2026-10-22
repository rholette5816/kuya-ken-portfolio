import { NextRequest, NextResponse } from "next/server";
import { sendInfotxtSms, normalizePhilippineMobile } from "../../../lib/visionInfotxt";
import { maskSmsPhone, recordSmsAutomationLog, updateSmsAutomationLog } from "../../../lib/visionSmsAutomation";
import { recordInfotxtOutbound } from "../../../lib/visionInfotxtRecords";

export const dynamic = "force-dynamic";

const PRIVATE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  "X-Robots-Tag": "noindex, nofollow, noarchive"
};
const COOKIE_NAME = "vision_x_saha_access";
const TEST_PREFIX = "VISION X SAHA TEST: ";
const attempts = new Map<string, number[]>();

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: PRIVATE_HEADERS });
}

function sameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!origin || !host) return true;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

function operatorLabel(request: NextRequest) {
  const token = request.cookies.get(COOKIE_NAME)?.value || "";
  if (token && token === process.env.VISION_X_SAHA_RUSTAN_ACCESS_TOKEN) return "rustan";
  if (token && token === process.env.VISION_X_SAHA_DASHBOARD_ACCESS_TOKEN) return "kevin";
  return "vision-x-saha";
}

function rateLimited(request: NextRequest) {
  const key = `${request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown"}:${operatorLabel(request)}`;
  const cutoff = Date.now() - 10 * 60 * 1000;
  const recent = (attempts.get(key) || []).filter(timestamp => timestamp > cutoff);
  if (recent.length >= 5 || (recent.length && Date.now() - recent[recent.length - 1] < 20_000)) return true;
  recent.push(Date.now());
  attempts.set(key, recent);
  return false;
}

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return json({ error: "Request origin is not allowed." }, 403);
  if (Number(request.headers.get("content-length") || 0) > 8 * 1024) return json({ error: "Request is too large." }, 413);

  let body: any;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid request." }, 400);
  }

  const requestId = String(body?.requestId || "").trim();
  const recipient = normalizePhilippineMobile(body?.recipient);
  const suppliedMessage = String(body?.message || "").trim();
  const confirmed = body?.confirmed === true;
  if (!/^[0-9a-f-]{36}$/i.test(requestId)) return json({ error: "Invalid test request ID." }, 400);
  if (!recipient) return json({ error: "Enter a valid Philippine mobile number." }, 400);
  if (!confirmed) return json({ error: "Confirm that you control or have permission to message the test number." }, 400);
  if (!suppliedMessage || suppliedMessage.length > 420) return json({ error: "Enter a test message of 1 to 420 characters." }, 400);
  if (rateLimited(request)) return json({ error: "Please wait before sending another test. Maximum: five tests per 10 minutes." }, 429);

  const message = `${TEST_PREFIX}${suppliedMessage}`;
  const destinationMasked = maskSmsPhone(recipient);
  const common = {
    orderId: `manual-${requestId}`,
    tracking: "",
    event: "manual_test",
    eventLabel: "Manual InfoTXT test",
    recipient: "customer" as const,
    destinationMasked,
    message
  };

  const reserved = await recordSmsAutomationLog({
    ...common,
    status: "submitting",
    reason: `Outbound test requested by ${operatorLabel(request)}.`,
    source: "manual_test",
    templateVersion: 1,
    eventAt: requestId
  });
  if (!reserved.created) return json({ error: "This test request was already processed." }, 409);

  try {
    const result = await sendInfotxtSms(recipient, message);
    let trackingWarning = "";
    if (result.accepted && result.smsId) {
      try {
        await recordInfotxtOutbound({
          providerSmsId: result.smsId,
          source: "manual_test",
          auditId: reserved.record.id,
          orderId: common.orderId,
          tracking: common.tracking,
          eventLabel: common.eventLabel,
          recipient: common.recipient,
          destinationMasked,
          message,
          submittedAt: new Date().toISOString()
        });
      } catch {
        trackingWarning = " Status tracking could not be saved; do not resend until the provider ID is checked manually.";
      }
    }
    await updateSmsAutomationLog(reserved.record.id, {
      status: result.accepted ? "accepted" : "failed",
      reason: result.accepted
        ? `InfoTXT accepted the SMS${result.smsId ? ` (ID ${result.smsId})` : ""}; delivery is not yet confirmed.`
        : result.error,
      providerSmsId: result.smsId,
      providerCode: result.providerStatus,
      providerStatus: result.accepted ? "queued" : "failed",
      acceptedAt: result.accepted ? new Date().toISOString() : ""
    });
    if (!result.accepted) return json({ accepted: false, providerStatus: result.providerStatus, destinationMasked, error: result.error }, 502);
    return json({
      accepted: true,
      providerStatus: result.providerStatus,
      smsId: result.smsId,
      destinationMasked,
      message: `InfoTXT accepted the outbound test SMS. This confirms submission, not handset delivery.${trackingWarning}`
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "The outbound SMS could not be submitted.";
    await updateSmsAutomationLog(reserved.record.id, { status: "failed", reason });
    return json({ accepted: false, destinationMasked, error: reason }, 502);
  }
}

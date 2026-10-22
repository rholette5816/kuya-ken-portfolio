import { NextRequest, NextResponse } from "next/server";
import { crmSelectAll } from "../../../lib/secureCodCrm";
import {
  crmRowToMarketingFacts,
  loadMarketingConfig,
  loadMarketingEnrollments,
  loadMarketingEvents,
  marketingAnalytics,
  marketingSummary,
  renderMarketingMessage,
  saveMarketingConfig
} from "../../../lib/visionMarketingEngine";
import { classifyMarketingCustomer, sortMarketingDecisions } from "../../../lib/visionMarketingSegmentation";

export const dynamic = "force-dynamic";

const PRIVATE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  "X-Robots-Tag": "noindex, nofollow, noarchive"
};

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: PRIVATE_HEADERS });
}

function authorized(request: NextRequest) {
  const token = request.cookies.get("vision_x_saha_access")?.value || "";
  return [process.env.VISION_X_SAHA_DASHBOARD_ACCESS_TOKEN, process.env.VISION_X_SAHA_RUSTAN_ACCESS_TOKEN].filter(Boolean).includes(token);
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
  const token = request.cookies.get("vision_x_saha_access")?.value || "";
  if (token && token === process.env.VISION_X_SAHA_RUSTAN_ACCESS_TOKEN) return "rustan";
  if (token && token === process.env.VISION_X_SAHA_DASHBOARD_ACCESS_TOKEN) return "kevin";
  return "vision-x-saha";
}

function maskPhone(value: unknown) {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.length < 7) return "Unavailable";
  return `${digits.slice(0, 4)} ***** ${digits.slice(-3)}`;
}

async function buildDashboard() {
  const [customers, config, enrollments, events] = await Promise.all([
    crmSelectAll("crm_customer_overview"),
    loadMarketingConfig(),
    loadMarketingEnrollments(),
    loadMarketingEvents()
  ]);
  const facts = customers.map(crmRowToMarketingFacts);
  const decisions = sortMarketingDecisions(facts.map(customer => classifyMarketingCustomer(customer)));
  const customerMap = new Map(facts.map(customer => [customer.customerId, customer]));
  const sequenceMap = new Map(config.sequences.map(sequence => [sequence.id, sequence]));
  // Keep up to 200 rows per segment (the dashboard display cap) so every segment has rows to show.
  // A flat top-N slice would starve lower-priority segments like dormant and active_order of any rows.
  const PER_SEGMENT_CAP = 200;
  const segmentCounts = new Map<string, number>();
  const audience = [];
  for (const decision of decisions) {
    const shown = segmentCounts.get(decision.segment) || 0;
    if (shown >= PER_SEGMENT_CAP) continue;
    segmentCounts.set(decision.segment, shown + 1);
    const customer = customerMap.get(decision.customerId)!;
    const sequence = decision.recommendedSequenceId ? sequenceMap.get(decision.recommendedSequenceId) : null;
    audience.push({
      customerId: decision.customerId,
      name: customer.name,
      phoneMasked: maskPhone(customer.phone),
      segment: decision.segment,
      eligible: decision.eligible,
      priorityScore: decision.priorityScore,
      reason: decision.reason,
      nextEligibleDate: decision.nextEligibleDate,
      sequenceId: decision.recommendedSequenceId,
      preview: sequence?.steps[0] ? renderMarketingMessage(sequence.steps[0].template, customer) : ""
    });
  }

  const activeEnrollments = enrollments.filter(row => ["active", "waiting", "replied", "bulk_handoff"].includes(row.status));
  const analytics = marketingAnalytics(events, config.sequences, config.smsUnitCostPhp);

  return {
    generatedAt: new Date().toISOString(),
    config,
    summary: marketingSummary(decisions),
    audience,
    enrollments: activeEnrollments.slice(0, 200).map(row => ({ ...row, phone: maskPhone(row.phone) })),
    analytics,
    events: events.slice(0, 100),
    readiness: {
      customerSource: true,
      segmentation: true,
      infoTxt: Boolean(process.env.INFOTXT_API_KEY && process.env.INFOTXT_USER_ID),
      mel: Boolean(process.env.OPENAI_API_KEY),
      pancake: Boolean(process.env.VISION_X_SAHA_PANCAKE_API_KEY && process.env.VISION_X_SAHA_PANCAKE_SHOP_ID),
      activationLocked: config.activationLocked
    }
  };
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) return json({ error: "Unauthorized." }, 401);
  try {
    return json(await buildDashboard());
  } catch (error) {
    console.error("VISION X SAHA marketing dashboard failed", error instanceof Error ? error.message : "Unknown error");
    return json({ error: error instanceof Error ? error.message : "The marketing dashboard could not be loaded." }, 502);
  }
}

export async function POST(request: NextRequest) {
  if (!authorized(request)) return json({ error: "Unauthorized." }, 401);
  if (!sameOrigin(request)) return json({ error: "Request origin is not allowed." }, 403);
  if (Number(request.headers.get("content-length") || 0) > 128 * 1024) return json({ error: "Request is too large." }, 413);
  let body: any;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid request." }, 400);
  }
  if (body?.action !== "save_settings") return json({ error: "Unknown action." }, 400);
  try {
    const config = await saveMarketingConfig(body.config, operatorLabel(request));
    return json({
      saved: true,
      config,
      message: config.activationLocked
        ? "Settings saved. Activation remains locked and no customer was enrolled or messaged."
        : "Marketing settings saved."
    });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Marketing settings could not be saved." }, 502);
  }
}

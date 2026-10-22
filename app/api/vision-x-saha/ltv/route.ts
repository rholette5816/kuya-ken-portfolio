import { NextRequest, NextResponse } from "next/server";
import { crmSelectAll } from "../../../lib/secureCodCrm";
import { crmRowToMarketingFacts, loadMarketingConfig, loadMarketingEvents } from "../../../lib/visionMarketingEngine";
import { loadReferralEvents } from "../../../lib/visionReferral";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const PRIVATE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  "X-Robots-Tag": "noindex, nofollow, noarchive"
};

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: PRIVATE_HEADERS });
}

function isDashboardAuthed(req: NextRequest) {
  const tokens = [process.env.VISION_X_SAHA_DASHBOARD_ACCESS_TOKEN, process.env.VISION_X_SAHA_RUSTAN_ACCESS_TOKEN].filter((t): t is string => Boolean(t));
  const cookie = req.cookies.get("vision_x_saha_access")?.value || "";
  return tokens.length > 0 && tokens.includes(cookie);
}

function round(n: number, dp = 0) {
  const f = Math.pow(10, dp);
  return Math.round((Number.isFinite(n) ? n : 0) * f) / f;
}

export async function GET(req: NextRequest) {
  if (!isDashboardAuthed(req)) return json({ error: "Unauthorized." }, 401);
  try {
    const [config, events, referralEvents, rows] = await Promise.all([
      loadMarketingConfig(),
      loadMarketingEvents(5000),
      loadReferralEvents(1000),
      crmSelectAll("crm_customer_overview")
    ]);

    // SMS marketing performance
    const sent = events.filter(e => e.type === "sent").length;
    const orderedEvents = events.filter(e => e.type === "ordered");
    const smsRevenue = orderedEvents.reduce((sum, e) => sum + Math.max(0, Number(e.amount || 0)), 0);
    const smsOrders = orderedEvents.length;
    const smsCost = round(sent * Number(config.smsUnitCostPhp || 0), 2);
    const revenuePerSms = sent > 0 ? round(smsRevenue / sent, 2) : 0;
    const roas = smsCost > 0 ? round(smsRevenue / smsCost, 2) : 0;
    const replies = events.filter(e => e.type === "replied").length;
    const replyRate = sent > 0 ? round((replies / sent) * 100, 1) : 0;
    const orderConvRate = sent > 0 ? round((smsOrders / sent) * 100, 1) : 0;

    // Customer base LTV (from the CRM overview)
    const facts = rows.map(crmRowToMarketingFacts);
    const buyers = facts.filter(f => f.deliveredCount >= 1);
    const repeatBuyers = facts.filter(f => f.deliveredCount >= 2);
    const totalLtv = buyers.reduce((sum, f) => sum + Math.max(0, Number(f.lifetimeValue || 0)), 0);
    const deliveredOrders = buyers.reduce((sum, f) => sum + Math.max(0, Number(f.deliveredCount || 0)), 0);
    const avgLtv = buyers.length > 0 ? round(totalLtv / buyers.length, 0) : 0;
    const aov = deliveredOrders > 0 ? round(totalLtv / deliveredOrders, 0) : 0;
    const ordersPerBuyer = buyers.length > 0 ? round(deliveredOrders / buyers.length, 2) : 0;
    const repeatRate = buyers.length > 0 ? round((repeatBuyers.length / buyers.length) * 100, 1) : 0;

    // Referral program
    const referred = referralEvents.filter(e => e.type === "referred").length;
    const redeemedEvents = referralEvents.filter(e => e.type === "redeemed");
    const creditRedeemed = redeemedEvents.reduce((sum, e) => sum + Math.max(0, Number(e.amountPhp || 0)), 0);

    return json({
      generatedAt: new Date().toISOString(),
      sms: { sent, orders: smsOrders, revenue: round(smsRevenue, 0), cost: smsCost, revenuePerSms, roas, replies, replyRate, orderConvRate },
      customers: { total: facts.length, buyers: buyers.length, repeatBuyers: repeatBuyers.length, repeatRate, avgLtv, aov, ordersPerBuyer, totalLtv: round(totalLtv, 0) },
      referral: { referred, redeemed: redeemedEvents.length, creditRedeemedPhp: round(creditRedeemed, 0) }
    });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "LTV report failed." }, 502);
  }
}

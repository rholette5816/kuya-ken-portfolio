import { NextRequest, NextResponse } from "next/server";
import { crmSelect, crmSelectAll } from "../../../lib/secureCodCrm";
import { crmRowToMarketingFacts } from "../../../lib/visionMarketingEngine";
import { classifyMarketingCustomer } from "../../../lib/visionMarketingSegmentation";

export const dynamic = "force-dynamic";

function authorized(request: NextRequest) {
  const token = request.cookies.get("vision_x_saha_access")?.value || "";
  return [
    process.env.VISION_X_SAHA_DASHBOARD_ACCESS_TOKEN,
    process.env.VISION_X_SAHA_RUSTAN_ACCESS_TOKEN
  ].filter(Boolean).includes(token);
}

function encode(value: unknown) {
  return encodeURIComponent(String(value ?? ""));
}

function number(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function matchesStatus(customer: any, status: string) {
  if (status === "all") return true;
  if (status === "delivered") return number(customer.delivered_count) > 0;
  if (status === "failed_delivery") return number(customer.failed_count) > 0;
  if (status === "returned") return number(customer.returned_count) > 0;
  if (status === "active") return ["new", "confirmed", "packed", "shipped", "out_for_delivery"].includes(customer.last_status);
  if (status === "cancelled") return customer.last_status === "cancelled" || number(customer.cancelled_count) > 0;
  if (status === "no_orders") return number(customer.order_count) === 0;
  return customer.last_status === status;
}

function shape(customer: any, users: Map<string, string>) {
  const marketing = classifyMarketingCustomer(crmRowToMarketingFacts(customer));
  return {
    id: customer.id,
    fullName: customer.full_name || "Unnamed customer",
    firstName: customer.first_name || null,
    lastName: customer.last_name || null,
    phone: customer.phone_e164 || null,
    email: customer.email || null,
    city: customer.city || null,
    province: customer.province || null,
    countryCode: customer.country_code || "PH",
    tags: Array.isArray(customer.tags) ? customer.tags : [],
    shops: Array.isArray(customer.shops) ? customer.shops.filter(Boolean) : [],
    preferredChannel: customer.preferred_channel || null,
    smsMarketingConsent: Boolean(customer.sms_marketing_consent),
    callMarketingConsent: Boolean(customer.call_marketing_consent),
    doNotContact: Boolean(customer.do_not_contact),
    assignedUserId: customer.assigned_user_id || null,
    assignedTo: users.get(customer.assigned_user_id) || null,
    orderCount: number(customer.order_count),
    deliveredCount: number(customer.delivered_count),
    failedCount: number(customer.failed_count),
    returnedCount: number(customer.returned_count),
    cancelledCount: number(customer.cancelled_count),
    lifetimeValue: number(customer.lifetime_value),
    lastStatus: customer.last_status || "no_orders",
    lastOrderAt: customer.last_order_at || null,
    lastInteractionAt: customer.last_interaction_at || null,
    nextFollowupAt: customer.next_followup_at || null,
    firstSeenAt: customer.first_seen_at || null,
    lastSeenAt: customer.last_seen_at || null,
    riskLevel: customer.risk_level || "low",
    marketingSegment: marketing.segment,
    marketingEligible: marketing.eligible,
    marketingPriority: marketing.priorityScore,
    marketingReason: marketing.reason,
    marketingNextEligibleAt: marketing.nextEligibleDate,
    marketingSequence: marketing.recommendedSequenceId
  };
}

async function users() {
  const rows = await crmSelect("crm_users", "select=id,display_name,username&active=is.true&order=display_name.asc");
  return new Map<string, string>(rows.map((user: any) => [String(user.id), String(user.display_name || user.username)]));
}

async function profile(id: string, directory: Map<string, string>) {
  const customers = await crmSelect("crm_customer_overview", `select=*&id=eq.${encode(id)}&limit=1`);
  if (!customers.length) return null;
  const [baseRows, addresses, orders, interactions, followups] = await Promise.all([
    crmSelect("crm_customers", `select=internal_note,do_not_contact_reason,source_first_seen&id=eq.${encode(id)}&limit=1`),
    crmSelect("crm_addresses", `select=id,address_line,barangay,city,province,postal_code,country_code,landmark,is_primary,source,updated_at&customer_id=eq.${encode(id)}&order=is_primary.desc,updated_at.desc`),
    crmSelect("crm_orders", `select=id,source_system,source_file,external_order_id,tracking_number,shop_label,product_summary,quantity,amount,payment_method,normalized_status,raw_status,failure_reason,ordered_at,delivered_at,last_status_at,otp_verified,landing_src,utm_source,utm_medium,utm_campaign,utm_content,landing_url,agent_id,created_at&customer_id=eq.${encode(id)}&order=ordered_at.desc.nullslast,created_at.desc&limit=500`),
    crmSelect("crm_interactions", `select=id,user_id,channel,direction,purpose,outcome,content,provider_status,duration_seconds,occurred_at,created_at&customer_id=eq.${encode(id)}&order=occurred_at.desc&limit=500`),
    crmSelect("crm_followups", `select=id,assigned_user_id,title,notes,due_at,priority,status,completed_at,created_at&customer_id=eq.${encode(id)}&order=due_at.desc&limit=300`)
  ]);
  const orderIds = orders.map((order: any) => order.id);
  const events = orderIds.length
    ? await crmSelect("crm_order_events", `select=id,order_id,normalized_status,raw_status,note,source,occurred_at&order_id=in.(${orderIds.map(encode).join(",")})&order=occurred_at.desc&limit=2000`)
    : [];
  const base = baseRows[0] || {};
  return {
    customer: {
      ...shape(customers[0], directory),
      internalNote: base.internal_note || null,
      doNotContactReason: base.do_not_contact_reason || null,
      sourceFirstSeen: base.source_first_seen || null
    },
    addresses,
    orders: orders.map((order: any) => ({
      ...order,
      amount: number(order.amount),
      quantity: number(order.quantity),
      agentName: directory.get(order.agent_id) || null
    })),
    events,
    interactions: interactions.map((item: any) => ({ ...item, userName: directory.get(item.user_id) || null })),
    followups: followups.map((item: any) => ({ ...item, assignedTo: directory.get(item.assigned_user_id) || null }))
  };
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401, headers: { "Cache-Control": "private, no-store" } });
  }
  try {
    const directory = await users();
    const id = request.nextUrl.searchParams.get("id")?.trim() || "";
    if (id) {
      const result = await profile(id, directory);
      if (!result) return NextResponse.json({ error: "Customer not found." }, { status: 404 });
      return NextResponse.json(result, { headers: { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow, noarchive" } });
    }

    const query = (request.nextUrl.searchParams.get("q") || "").trim().toLowerCase();
    const status = (request.nextUrl.searchParams.get("status") || "all").trim();
    const marketing = (request.nextUrl.searchParams.get("marketing") || "all").trim();
    const shop = (request.nextUrl.searchParams.get("shop") || "all").trim();
    const page = Math.max(1, Number.parseInt(request.nextUrl.searchParams.get("page") || "1", 10) || 1);
    const requestedPageSize = Number.parseInt(request.nextUrl.searchParams.get("perPage") || "200", 10) || 200;
    const perPage = [200, 500, 1000].includes(requestedPageSize) ? requestedPageSize : 200;
    const rows = await crmSelectAll("crm_customer_overview");
    const shops = [...new Set<string>(rows.flatMap((customer: any) => Array.isArray(customer.shops) ? customer.shops : []).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b));
    const filtered = rows.filter((customer: any) => {
      if (!matchesStatus(customer, status)) return false;
      if (marketing !== "all" && classifyMarketingCustomer(crmRowToMarketingFacts(customer)).segment !== marketing) return false;
      if (shop !== "all" && !(Array.isArray(customer.shops) && customer.shops.includes(shop))) return false;
      if (!query) return true;
      const haystack = [customer.full_name, customer.phone_e164, customer.email, customer.city, customer.province, customer.order_search, ...(customer.tags || []), ...(customer.shops || [])].join(" ").toLowerCase();
      return haystack.includes(query);
    });
    filtered.sort((a: any, b: any) => new Date(b.last_seen_at || b.last_order_at || 0).getTime() - new Date(a.last_seen_at || a.last_order_at || 0).getTime());
    const start = (page - 1) * perPage;
    return NextResponse.json({
      source: "Secure COD Express CRM",
      syncedAt: new Date().toISOString(),
      data: filtered.slice(start, start + perPage).map((customer: any) => shape(customer, directory)),
      total: filtered.length,
      page,
      perPage,
      totalPages: Math.max(1, Math.ceil(filtered.length / perPage)),
      shops,
      summary: {
        customers: rows.length,
        delivered: rows.filter((customer: any) => number(customer.delivered_count) > 0).length,
        active: rows.filter((customer: any) => matchesStatus(customer, "active")).length,
        deliveryIssues: rows.filter((customer: any) => number(customer.failed_count) + number(customer.returned_count) > 0).length,
        lifetimeValue: rows.reduce((sum: number, customer: any) => sum + number(customer.lifetime_value), 0)
      }
    }, { headers: { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow, noarchive" } });
  } catch (error) {
    console.error("VISION X SAHA CRM customer sync failed", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: error instanceof Error ? error.message : "The CRM customer list could not be loaded." }, { status: 502 });
  }
}

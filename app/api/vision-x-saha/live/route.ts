import { NextRequest, NextResponse } from "next/server";
import { cached } from "../../../lib/visionCache";
import {
  latestVisionCourierUpdate,
  loadVisionPancakeOrders,
  visionOrderLakatanPieces,
  summarizeVisionPancakeOrders,
  visionArray,
  visionOrderStage,
  visionOrderValue,
  visionTrackingNumber
} from "../../../lib/visionPancakeOrders";

export const dynamic = "force-dynamic";

const META_API_VERSION = "v23.0";
const META_ACCOUNT_ID = "act_1438592618166795";
const PANCAKE_BASE_URL = "https://pos.pages.fm/api/v1";
const LANDING_PAGE_URL = "https://www.securecodexpress.xyz/visionsaha";
const LIVE_SAHA_URL = "https://www.securecodexpress.xyz/livesaha";
const LEGACY_VISION_URL = "https://www.securecodexpress.xyz/region7lakatan?src=visionxsaha";
const AGREEMENT_EFFECTIVE_DATE = "2026-09-14";
const BILLING_CYCLE_DAYS = 15;

type ProviderResult<T> = { connected: true; data: T } | { connected: false; error: string };
type Row = Record<string, any>;
type ReportingPeriod = "today" | "7d" | "mtd" | "billing" | "initial_settlement" | "current_settlement";

function env(...names: string[]) {
  for (const name of names) {
    const value = process.env[name];
    if (value) return value;
  }
  return "";
}

async function jsonRequest(url: string, provider: string) {
  const response = await fetch(url, { cache: "no-store" });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.error) {
    throw new Error(body.error?.message || body.message || `${provider} returned ${response.status}.`);
  }
  return body;
}

async function pagedMetaRequest(url: string) {
  const rows: Row[] = [];
  let nextUrl = url;
  let pages = 0;
  while (nextUrl && pages < 20) {
    const body = await jsonRequest(nextUrl, "Meta Ads");
    rows.push(...list(body.data));
    nextUrl = String(body.paging?.next || "");
    pages += 1;
  }
  return rows;
}

function list(value: unknown): Row[] {
  return Array.isArray(value) ? value.filter(item => item && typeof item === "object") : [];
}

function accountDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const value = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

function reportingWindow(period: ReportingPeriod) {
  const end = accountDate();
  if (period === "initial_settlement") return { key: period, label: "Initial reconciliation statement", start: "2026-09-26", end: "2026-10-15", cutoffDate: "2026-10-15", nextBillingDate: "2026-10-16", cycleNumber: "Initial", timezone: "Asia/Manila" };
  if (period === "current_settlement") return { key: period, label: "Current 15-day remittance cycle", start: "2026-10-16", end, cutoffDate: "2026-10-31", nextBillingDate: "2026-11-01", cycleNumber: 2, timezone: "Asia/Manila" };
  if (period === "billing") {
    const dayMs = 24 * 60 * 60 * 1000;
    const anchor = Date.parse(`${AGREEMENT_EFFECTIVE_DATE}T00:00:00+08:00`);
    const today = Date.parse(`${end}T00:00:00+08:00`);
    const cycle = Math.max(0, Math.floor((today - anchor) / (BILLING_CYCLE_DAYS * dayMs)));
    const cycleStart = new Date(anchor + cycle * BILLING_CYCLE_DAYS * dayMs);
    const cutoff = new Date(anchor + ((cycle + 1) * BILLING_CYCLE_DAYS - 1) * dayMs);
    const nextBilling = new Date(anchor + (cycle + 1) * BILLING_CYCLE_DAYS * dayMs);
    const date = (value: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).format(value);
    return { key: period, label: "Current 15-day billing cycle", start: date(cycleStart), end, cutoffDate: date(cutoff), nextBillingDate: date(nextBilling), cycleNumber: cycle + 1, timezone: "Asia/Manila" };
  }
  if (period === "mtd") return { key: period, label: "Month to date", start: `${end.slice(0, 7)}-01`, end, timezone: "Asia/Manila" };
  if (period === "today") return { key: period, label: "Today", start: end, end, timezone: "Asia/Manila" };
  const start = accountDate(new Date(Date.now() - 6 * 24 * 60 * 60 * 1000));
  return { key: period, label: "Last 7 days", start, end, timezone: "Asia/Manila" };
}

function orderTimestamp(order: Row) {
  return String(order.inserted_at || order.created_at || order.updated_at || "");
}

function orderIsInWindow(order: Row, window: ReturnType<typeof reportingWindow>) {
  const timestamp = orderTimestamp(order);
  if (!timestamp) return false;
  const day = accountDate(new Date(timestamp));
  return day >= window.start && day <= window.end;
}

function courierPushDay(order: Row) {
  const direct = String(order.time_send_partner || order.partner?.picked_up_at || "").trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(direct)) return direct.slice(0, 10);
  const updates = list(order.partner?.extend_update).map(update => String(update.update_at || update.updated_at || update.event_time || update.status_time || update.created_at || update.inserted_at || update.timestamp || update.time || update.date || "").trim()).filter(value => /^\d{4}-\d{2}-\d{2}/.test(value)).sort();
  return updates[0]?.slice(0, 10) || "";
}

function orderWasPushedInWindow(order: Row, window: ReturnType<typeof reportingWindow>) {
  const day = courierPushDay(order);
  return Boolean(visionTrackingNumber(order)) && day >= window.start && day <= window.end;
}

function courierFee(order: Row) {
  const raw = Number(order.partner_fee || order.estimate_shipping_fee || order.partner?.total_fee || 0);
  if (!Number.isFinite(raw) || raw <= 0) return null;
  return raw >= 1000 ? raw / 100 : raw;
}

function landingOrderRecord(order: Row) {
  const note = String(order.note || "");
  const page = note.match(/(?:page|landing)\s*:\s*(\/[\w/?=&-]+)/i)?.[1] || "/visionsaha";
  return {
    id: String(order.id || order.order_id || ""),
    createdAt: orderTimestamp(order),
    value: visionOrderValue(order),
    status: visionOrderStage(order, latestVisionCourierUpdate(order).text),
    page
  };
}

function preferredActionType(rows: Row[], field: "actions" | "action_values") {
  for (const type of ["purchase", "omni_purchase", "offsite_conversion.fb_pixel_purchase"]) {
    if (rows.some(row => list(row[field]).some(action => String(action.action_type || "") === type))) return type;
  }
  return "";
}

function actionValue(row: Row, field: "actions" | "action_values", actionType: string) {
  if (!actionType) return 0;
  return list(row[field])
    .filter(action => String(action.action_type || "") === actionType)
    .reduce((sum, action) => sum + Number(action.value || 0), 0);
}

function actionTotal(row: Row, types: string[]) {
  return list(row.actions)
    .filter(action => types.includes(String(action.action_type || "")))
    .reduce((sum, action) => sum + Number(action.value || 0), 0);
}

function videoTotal(row: Row, field: string) {
  return list(row[field]).reduce((sum, item) => sum + Number(item.value || 0), 0);
}

function creativePreview(creative: Row) {
  const story = creative.object_story_spec || {};
  const link = story.link_data || {};
  const video = story.video_data || {};
  const assets = creative.asset_feed_spec || {};
  return {
    id: String(creative.id || ""),
    name: String(creative.name || "Unnamed creative"),
    format: String(creative.object_type || (video.video_id ? "VIDEO" : "IMAGE")),
    thumbnailUrl: String(creative.thumbnail_url || creative.image_url || list(assets.images)[0]?.url || list(assets.videos)[0]?.thumbnail_url || ""),
    primaryText: String(creative.body || link.message || video.message || list(assets.bodies)[0]?.text || ""),
    headline: String(creative.title || link.name || video.title || list(assets.titles)[0]?.text || ""),
    description: String(link.description || video.link_description || list(assets.descriptions)[0]?.text || ""),
    callToAction: String(creative.call_to_action_type || link.call_to_action?.type || video.call_to_action?.type || ""),
    destinationUrl: String(link.link || video.call_to_action?.value?.link || list(assets.link_urls)[0]?.website_url || "")
  };
}

async function metaData(period: ReportingPeriod): Promise<ProviderResult<Row>> {
  try {
    const token = env("VISION_X_SAHA_META_TOKEN", "LAKATAN_META_TOKEN", "META_ACCESS_TOKEN");
    if (!token) throw new Error("Meta access is not configured.");
    const window = reportingWindow(period);
    const timeRange = JSON.stringify({ since: window.start, until: window.end });
    const accountParams = new URLSearchParams({
      fields: "id,name,account_status,currency,timezone_name",
      access_token: token
    });
    const campaignInsightParams = new URLSearchParams({
      fields: "campaign_id,campaign_name,spend,impressions,reach,clicks,actions,action_values",
      level: "campaign",
      time_range: timeRange,
      access_token: token,
      limit: "200"
    });
    const accountInsightParams = new URLSearchParams({
      fields: "spend,impressions,reach,clicks,actions,action_values",
      level: "account",
      time_range: timeRange,
      access_token: token,
      limit: "10"
    });
    const adsParams = new URLSearchParams({
      fields: "id,name,status,effective_status,created_time,updated_time,campaign{id,name,status,effective_status,objective,daily_budget,lifetime_budget},adset{id,name,status,effective_status,daily_budget,lifetime_budget,optimization_goal,billing_event,bid_strategy,targeting,start_time,end_time},creative{id,name,object_type,thumbnail_url,image_url,effective_object_story_id,object_story_id,body,title,call_to_action_type,object_story_spec,asset_feed_spec}",
      access_token: token,
      limit: "200",
      filtering: JSON.stringify([{ field: "effective_status", operator: "IN", value: ["ACTIVE"] }])
    });
    const adInsightParams = new URLSearchParams({
      fields: "ad_id,spend,impressions,reach,frequency,clicks,inline_link_clicks,ctr,cpc,cpm,actions,action_values,video_play_actions,video_thruplay_watched_actions,video_p100_watched_actions",
      level: "ad",
      time_range: timeRange,
      access_token: token,
      limit: "200"
    });
    const [account, campaignRows, accountInsightRows, adsRows, adInsightRows] = await Promise.all([
      jsonRequest(`https://graph.facebook.com/${META_API_VERSION}/${META_ACCOUNT_ID}?${accountParams}`, "Meta Ads"),
      pagedMetaRequest(`https://graph.facebook.com/${META_API_VERSION}/${META_ACCOUNT_ID}/insights?${campaignInsightParams}`),
      pagedMetaRequest(`https://graph.facebook.com/${META_API_VERSION}/${META_ACCOUNT_ID}/insights?${accountInsightParams}`),
      pagedMetaRequest(`https://graph.facebook.com/${META_API_VERSION}/${META_ACCOUNT_ID}/ads?${adsParams}`),
      pagedMetaRequest(`https://graph.facebook.com/${META_API_VERSION}/${META_ACCOUNT_ID}/insights?${adInsightParams}`)
    ]);
    const purchaseType = preferredActionType([...accountInsightRows, ...campaignRows], "actions");
    const purchaseValueType = preferredActionType([...accountInsightRows, ...campaignRows], "action_values");
    const campaigns = campaignRows.map(row => {
      const spend = Number(row.spend || 0);
      const clicks = Number(row.clicks || 0);
      const impressions = Number(row.impressions || 0);
      const purchases = actionValue(row, "actions", purchaseType);
      const purchaseValue = actionValue(row, "action_values", purchaseValueType);
      return {
        id: String(row.campaign_id || ""),
        name: String(row.campaign_name || "Unnamed campaign"),
        spend,
        impressions,
        reach: Number(row.reach || 0),
        clicks,
        purchases,
        purchaseValue,
        ctr: impressions ? (clicks / impressions) * 100 : 0,
        cpc: clicks ? spend / clicks : 0,
        cpa: purchases ? spend / purchases : 0,
        roas: spend ? purchaseValue / spend : 0
      };
    }).sort((a, b) => b.spend - a.spend);
    const accountInsight = accountInsightRows[0] || {};
    const totals = {
      spend: Number(accountInsight.spend || 0),
      impressions: Number(accountInsight.impressions || 0),
      reach: Number(accountInsight.reach || 0),
      clicks: Number(accountInsight.clicks || 0),
      purchases: actionValue(accountInsight, "actions", purchaseType),
      purchaseValue: actionValue(accountInsight, "action_values", purchaseValueType)
    };
    const adInsights = new Map(adInsightRows.map(row => [String(row.ad_id || ""), row]));
    const activeAds = adsRows.filter(ad => String(ad.effective_status || "") === "ACTIVE").map(ad => {
      const row = adInsights.get(String(ad.id || "")) || {};
      const creative = ad.creative || {};
      const storyId = String(creative.effective_object_story_id || creative.object_story_id || "");
      const separator = storyId.indexOf("_");
      const pageId = separator > 0 ? storyId.slice(0, separator) : "";
      const postId = separator > 0 ? storyId.slice(separator + 1) : storyId;
      const spend = Number(row.spend || 0);
      const purchases = actionValue(row, "actions", purchaseType);
      const purchaseValue = actionValue(row, "action_values", purchaseValueType);
      const impressions = Number(row.impressions || 0);
      const clicks = Number(row.clicks || 0);
      return {
        id: String(ad.id || ""),
        name: String(ad.name || "Unnamed ad"),
        status: String(ad.status || ""),
        effectiveStatus: String(ad.effective_status || ""),
        createdTime: String(ad.created_time || ""),
        updatedTime: String(ad.updated_time || ""),
        campaign: {
          id: String(ad.campaign?.id || ""),
          name: String(ad.campaign?.name || "Unnamed campaign"),
          objective: String(ad.campaign?.objective || ""),
          budget: Number(ad.campaign?.daily_budget || ad.campaign?.lifetime_budget || 0) / 100,
          budgetType: ad.campaign?.daily_budget ? "Daily campaign budget" : ad.campaign?.lifetime_budget ? "Lifetime campaign budget" : "Ad set budget"
        },
        adset: {
          id: String(ad.adset?.id || ""),
          name: String(ad.adset?.name || "Unnamed ad set"),
          optimizationGoal: String(ad.adset?.optimization_goal || ""),
          billingEvent: String(ad.adset?.billing_event || ""),
          bidStrategy: String(ad.adset?.bid_strategy || ""),
          budget: Number(ad.adset?.daily_budget || ad.adset?.lifetime_budget || 0) / 100,
          budgetType: ad.adset?.daily_budget ? "Daily ad set budget" : ad.adset?.lifetime_budget ? "Lifetime ad set budget" : "Campaign budget",
          startTime: String(ad.adset?.start_time || ""),
          endTime: String(ad.adset?.end_time || ""),
          targeting: ad.adset?.targeting || null
        },
        pageId,
        postId,
        postLink: pageId && postId ? `https://www.facebook.com/${pageId}/posts/${postId}` : "",
        creative: creativePreview(creative),
        performance: {
          spend,
          impressions,
          reach: Number(row.reach || 0),
          frequency: Number(row.frequency || 0),
          clicks,
          linkClicks: Number(row.inline_link_clicks || 0),
          ctr: Number(row.ctr || (impressions ? clicks / impressions * 100 : 0)),
          cpc: Number(row.cpc || (clicks ? spend / clicks : 0)),
          cpm: Number(row.cpm || (impressions ? spend / impressions * 1000 : 0)),
          purchases,
          purchaseValue,
          cpa: purchases ? spend / purchases : 0,
          roas: spend ? purchaseValue / spend : 0,
          engagements: actionTotal(row, ["post_engagement"]),
          reactions: actionTotal(row, ["post_reaction"]),
          comments: actionTotal(row, ["comment"]),
          shares: actionTotal(row, ["post"]),
          saves: actionTotal(row, ["onsite_conversion.post_save"]),
          videoStarts: videoTotal(row, "video_play_actions"),
          thruPlays: videoTotal(row, "video_thruplay_watched_actions"),
          videoCompletions: videoTotal(row, "video_p100_watched_actions")
        }
      };
    }).sort((a, b) => b.performance.spend - a.performance.spend);
    return { connected: true, data: {
      account: { id: account.id, name: account.name, status: Number(account.account_status), currency: account.currency, timezone: account.timezone_name },
      period: window,
      totals: {
        ...totals,
        spend: Math.round(totals.spend * 100) / 100,
        purchaseValue: Math.round(totals.purchaseValue * 100) / 100,
        cpc: totals.clicks ? totals.spend / totals.clicks : 0,
        cpa: totals.purchases ? totals.spend / totals.purchases : 0,
        roas: totals.spend ? totals.purchaseValue / totals.spend : 0
      },
      campaigns,
      activeAds,
      attribution: {
        source: "Meta account-level insights",
        purchaseActionType: purchaseType || "Unavailable",
        purchaseValueActionType: purchaseValueType || "Unavailable"
      }
    } };
  } catch (error) {
    return { connected: false, error: error instanceof Error ? error.message : "Meta Ads could not be reached." };
  }
}

function productName(item: Row) {
  return String(item.product_name || item.variation_info?.name || item.name || item.product?.name || "Product");
}

function isVisionSahaLandingOrder(order: Row) {
  return /VISION X SAHA/i.test(String(order.note || ""));
}

function stockValue(item: Row): number | null {
  for (const field of ["remaining_quantity", "available_quantity", "inventory", "stock", "quantity"]) {
    const value = Number(item[field]);
    if (Number.isFinite(value)) return value;
  }
  return null;
}

async function pancakeData(period: ReportingPeriod): Promise<ProviderResult<Row>> {
  try {
    const { apiKey, shopId, rawOrders, businessOrders } = await loadVisionPancakeOrders();
    const summary = summarizeVisionPancakeOrders(businessOrders, rawOrders.length - businessOrders.length);
    const window = reportingWindow(period);
    const settlementPeriod = period === "initial_settlement" || period === "current_settlement";
    const performanceOrders = businessOrders.filter(order => settlementPeriod ? orderWasPushedInWindow(order, window) : orderIsInWindow(order, window));
    const performance = summarizeVisionPancakeOrders(performanceOrders, 0);
    // A tracking number is only present after Pancake has successfully pushed
    // the order to the courier. Incoming, confirmed, and packing orders stay
    // out of the COD-dispatched performance value until that point.
    const courierPushedOrders = performanceOrders.filter(order => Boolean(visionTrackingNumber(order)));
    const courierPushedCodValue = courierPushedOrders.reduce((total, order) => total + visionOrderValue(order), 0);
    const courierPushedFee = courierPushedOrders.reduce((total, order) => total + Number(courierFee(order) || 0), 0);
    const stagedPerformanceOrders = performanceOrders.map(order => ({ order, stage: visionOrderStage(order, latestVisionCourierUpdate(order).text) }));
    const deliveredOrders = stagedPerformanceOrders.filter(row => row.stage === "delivered");
    const returnOrders = stagedPerformanceOrders.filter(row => ["failed_delivery", "returning", "returned"].includes(row.stage));
    const returningOrders = stagedPerformanceOrders.filter(row => row.stage === "returning");
    const returnedOrders = stagedPerformanceOrders.filter(row => row.stage === "returned");
    const inTransitOrders = stagedPerformanceOrders.filter(row => !["delivered", "failed_delivery", "returning", "returned"].includes(row.stage));
    const dailyTrend = Array.from(stagedPerformanceOrders.reduce((rows, row) => {
      const day = settlementPeriod ? courierPushDay(row.order) : accountDate(new Date(orderTimestamp(row.order)));
      const entry = rows.get(day) || { date: day, orders: 0, pushed: 0, delivered: 0, failed: 0, cod: 0 };
      entry.orders += 1;
      entry.cod += visionOrderValue(row.order);
      if (visionTrackingNumber(row.order)) entry.pushed += 1;
      if (row.stage === "delivered") entry.delivered += 1;
      if (["failed_delivery", "returning", "returned"].includes(row.stage)) entry.failed += 1;
      rows.set(day, entry);
      return rows;
    }, new Map<string, { date: string; orders: number; pushed: number; delivered: number; failed: number; cod: number }>()).values()).sort((a, b) => a.date.localeCompare(b.date));
    const courierOrderRecords = stagedPerformanceOrders.map(row => {
      const latest = latestVisionCourierUpdate(row.order);
      return {
        id: String(row.order.id || row.order.order_id || ""),
        tracking: visionTrackingNumber(row.order),
        pushedAt: String(row.order.time_send_partner || row.order.partner?.picked_up_at || courierPushDay(row.order)),
        customer: String(row.order.bill_full_name || row.order.full_name || row.order.customer?.name || "Customer"),
        value: visionOrderValue(row.order),
        courierFee: courierFee(row.order),
        stage: row.stage,
        latestStatus: latest.text || String(row.order.status_name || row.order.status || "")
      };
    }).sort((left, right) => left.pushedAt.localeCompare(right.pushedAt) || left.id.localeCompare(right.id));
    const params = new URLSearchParams({ api_key: apiKey, page_number: "1", page_size: "100", include_removed: "0" });
    const [shop, catalogBody] = await Promise.all([
      jsonRequest(`${PANCAKE_BASE_URL}/shops/${encodeURIComponent(shopId)}?api_key=${encodeURIComponent(apiKey)}`, "Pancake POS"),
      jsonRequest(`${PANCAKE_BASE_URL}/shops/${encodeURIComponent(shopId)}/products?${params}`, "Pancake POS").catch(() => ({ data: [] }))
    ]);
    const landingOrders = businessOrders.filter(isVisionSahaLandingOrder);
    const performanceLandingOrders = performanceOrders.filter(isVisionSahaLandingOrder);
    const upsellOrders = businessOrders.filter(order => String(order.note || "").includes("VISION_SAHA_EXTRA_LAKATAN"));
    const now = Date.now();
    const recentOrders = businessOrders.slice(0, 30).map(order => {
      const items = visionArray(order.items);
      const createdAt = String(order.inserted_at || order.created_at || order.updated_at || "");
      const ageHours = createdAt ? Math.max(0, (now - new Date(createdAt).getTime()) / 3600000) : 0;
      const latest = latestVisionCourierUpdate(order);
      const stage = visionOrderStage(order, latest.text);
      const stageAt = String(latest.at || order.updated_at || createdAt);
      const stageAgeHours = stageAt ? Math.max(0, (now - new Date(stageAt).getTime()) / 3600000) : ageHours;
      const tracking = String(order?.partner?.extend_code || order?.partner?.tracking_number || order?.tracking_number || "").trim();
      return {
        id: String(order.id || order.order_id || ""),
        createdAt,
        customer: String(order.bill_full_name || order.full_name || order.customer?.name || "Customer"),
        phone: String(order.bill_phone_number || order.phone_number || "").trim(),
        status: stage,
        value: visionOrderValue(order),
        bundle: items.map(productName).filter(Boolean).join(", ") || "Lakatan Saha",
        landingPage: isVisionSahaLandingOrder(order),
        hasUpsell: String(order.note || "").includes("VISION_SAHA_EXTRA_LAKATAN"),
        ageHours: Number(ageHours.toFixed(1)),
        needsAction: !["delivered", "returned", "cancelled"].includes(stage) && stageAgeHours >= (tracking ? 36 : 20)
      };
    });
    const products = list(catalogBody.data || catalogBody.products).map(product => {
      const variations = list(product.variations || product.variants || product.product_variations);
      const stocks = variations.map(stockValue).filter((value): value is number => value !== null);
      return {
        id: String(product.id || product.product_id || ""),
        name: String(product.name || product.product_name || "Product"),
        active: product.active !== false && product.is_active !== false,
        variants: variations.length || 1,
        stock: stocks.length ? stocks.reduce((sum, value) => sum + value, 0) : stockValue(product)
      };
    });
    return { connected: true, data: {
      shop: { id: shopId, name: shop.shop?.name || shop.name || "Pancake shop" },
      sample: `Latest ${summary.totalOrders} real POS orders`,
      totalOrders: summary.totalOrders,
      excludedTestOrders: summary.excludedTestOrders,
      delivered: summary.delivered,
      returned: summary.returned,
      open: summary.open,
      needsAction: summary.needsAction,
      codValue: summary.codValue,
      deliveredValue: summary.deliveredValue,
      landingPageOrders: landingOrders.length,
      landingOrderRecords: landingOrders.map(landingOrderRecord),
      performance: {
        ...window,
        totalOrders: performance.totalOrders,
        delivered: performance.delivered,
        returned: performance.returned,
        open: performance.open,
        stages: performance.stages,
        codValue: performance.codValue,
        courierPushedOrders: courierPushedOrders.length,
        courierPushedCodValue,
        courierPushedFee: Math.round(courierPushedFee * 100) / 100,
        courierPushedPieces: courierPushedOrders.reduce((total, order) => total + visionOrderLakatanPieces(order), 0),
        deliveredValue: performance.deliveredValue,
        deliveredPieces: deliveredOrders.reduce((total, row) => total + visionOrderLakatanPieces(row.order), 0),
        returnPieces: returnOrders.reduce((total, row) => total + visionOrderLakatanPieces(row.order), 0),
        failedOrders: returnOrders.length,
        returningOrders: returningOrders.length,
        returnedOrders: returnedOrders.length,
        inTransitOrders: inTransitOrders.length,
        returningValue: returningOrders.reduce((total, row) => total + visionOrderValue(row.order), 0),
        returnedValue: returnedOrders.reduce((total, row) => total + visionOrderValue(row.order), 0),
        inTransitValue: inTransitOrders.reduce((total, row) => total + visionOrderValue(row.order), 0),
        resolvedOrders: deliveredOrders.length + returnOrders.length,
        deliverySuccessRate: courierPushedOrders.length ? deliveredOrders.length / courierPushedOrders.length * 100 : 0,
        failureRate: courierPushedOrders.length ? returnOrders.length / courierPushedOrders.length * 100 : 0,
        dailyTrend,
        courierOrderRecords,
        landingPageOrders: performanceLandingOrders.length,
        landingOrderRecords: performanceLandingOrders.map(landingOrderRecord)
      },
      upsellOrders: upsellOrders.length,
      statuses: summary.stages,
      recentOrders,
      products
    } };
  } catch (error) {
    return { connected: false, error: error instanceof Error ? error.message : "Pancake POS could not be reached." };
  }
}

async function landingPageData(): Promise<ProviderResult<Row>> {
  try {
    const [visionResponse, liveResponse, legacyResponse] = await Promise.all([
      fetch(LANDING_PAGE_URL, { cache: "no-store" }),
      fetch(LIVE_SAHA_URL, { cache: "no-store" }),
      fetch(LEGACY_VISION_URL, { cache: "no-store" })
    ]);
    if (!visionResponse.ok || !liveResponse.ok || !legacyResponse.ok) throw new Error(`Landing pages returned ${visionResponse.status}, ${liveResponse.status}, and ${legacyResponse.status}.`);
    return { connected: true, data: {
      name: "SecureCOD VISION X SAHA pages",
      pages: [
        { path: "/visionsaha", url: LANDING_PAGE_URL, status: visionResponse.status },
        { path: "/livesaha", url: LIVE_SAHA_URL, status: liveResponse.status },
        { path: "/region7lakatan", url: LEGACY_VISION_URL, status: legacyResponse.status }
      ]
    } };
  } catch (error) {
    return { connected: false, error: error instanceof Error ? error.message : "Landing pages could not be reached." };
  }
}

async function secureCodData(path: string, label: string): Promise<ProviderResult<Row>> {
  try {
    const secret = process.env.VISION_X_SAHA_ANALYTICS_SECRET;
    if (!secret) throw new Error(`${label} access is not configured.`);
    const response = await fetch(`https://www.securecodexpress.xyz/api/${path}`, {
      headers: { authorization: `Bearer ${secret}` },
      cache: "no-store"
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || `${label} returned ${response.status}.`);
    return { connected: true, data: body };
  } catch (error) {
    return { connected: false, error: error instanceof Error ? error.message : `${label} could not be reached.` };
  }
}

function sheetRecordDate(value: unknown) {
  const text = String(value || "");
  const match = text.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!match) return "";
  return `${match[3]}-${match[1].padStart(2, "0")}-${match[2].padStart(2, "0")}`;
}

export async function GET(request: NextRequest) {
  const requestedPeriod = request.nextUrl.searchParams.get("period");
  const period: ReportingPeriod = requestedPeriod === "today" || requestedPeriod === "7d" || requestedPeriod === "mtd" || requestedPeriod === "billing" || requestedPeriod === "initial_settlement" || requestedPeriod === "current_settlement" ? requestedPeriod : "mtd";
  const window = reportingWindow(period);
  // Each source is cached with a TTL matched to how fast it changes and served
  // stale-while-revalidate, so after the first load every poll returns instantly
  // and refreshes in the background. Failures (connected:false) are not cached,
  // so a transient error retries on the next poll. Meta is the heaviest call
  // (deep Graph API paging) and its spend/ROAS move slowly, so it gets the
  // longest TTL.
  const [meta, pancake, landing, traffic, sheet] = await Promise.all([
    cached(`vision-meta:${period}`, 90000, () => metaData(period), result => result.connected),
    cached(`vision-pancake:${period}`, 15000, () => pancakeData(period), result => result.connected),
    cached("vision-landing", 90000, landingPageData, result => result.connected),
    cached("vision-traffic", 45000, () => secureCodData("vision-saha-live-visits", "Traffic analytics"), result => result.connected),
    cached("vision-sheet", 45000, () => secureCodData("vision-saha-operations", "Google Sheet"), result => result.connected)
  ]);
  const capiProfiles = [
    { name: "Vision pages", datasetId: process.env.VISION_X_SAHA_PIXEL_ID || "2533074450435922", configured: Boolean(process.env.VISION_X_SAHA_CAPI_TOKEN) },
    { name: "Region7 legacy page", datasetId: process.env.VISION_X_SAHA_LEGACY_PIXEL_ID || "1323008325857073", configured: Boolean(process.env.VISION_X_SAHA_LEGACY_CAPI_TOKEN) }
  ];
  const capi = capiProfiles.every(profile => profile.configured)
    ? { connected: true, data: {
      datasetId: process.env.VISION_X_SAHA_PIXEL_ID || "2533074450435922",
      profiles: capiProfiles,
      verification: "configuration-only",
      fullyVerified: false,
      note: "Credentials are configured. Confirm accepted Purchase events in Meta Events Manager."
    } }
    : { connected: false, error: "Meta CAPI is not configured." };
  const posRecords = pancake.connected ? list(pancake.data.performance?.landingOrderRecords) : [];
  const sheetRecords = sheet.connected ? list(sheet.data.recentOrders) : [];
  const sheetTotal = sheet.connected ? Number(sheet.data.totals?.loggedOrders || 0) : null;
  const sheetRowsComplete = sheetTotal !== null && sheetRecords.length >= sheetTotal;
  const sheetPeriodRecords = sheetRowsComplete ? sheetRecords.filter(record => {
    const day = sheetRecordDate(record.date || record.createdAt || record.timestamp);
    return day >= window.start && day <= window.end;
  }) : [];
  const sheetIds = new Set(sheetPeriodRecords.map(record => String(record.orderId || record.order_id || record.id || "")).filter(Boolean));
  const posIds = new Set(posRecords.map(record => String(record.id || "")).filter(Boolean));
  const posOnly = posRecords.filter(record => !sheetIds.has(String(record.id))).slice(0, 20);
  const sheetOnly = sheetPeriodRecords.filter(record => !posIds.has(String(record.orderId || record.order_id || record.id || ""))).slice(0, 20).map(record => ({
    id: String(record.orderId || record.order_id || record.id || ""),
    createdAt: String(record.date || record.createdAt || record.timestamp || ""),
    value: Number(record.total || record.value || record.amount || 0),
    source: String(record.source || "Google Sheet")
  }));
  const posLandingOrders = pancake.connected ? posRecords.length : null;
  const sheetLoggedOrders = sheetRowsComplete ? sheetPeriodRecords.length : null;
  const orderLogDifference = posLandingOrders !== null && sheetLoggedOrders !== null ? posLandingOrders - sheetLoggedOrders : null;
  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    scope: "Private operational data",
    meta,
    pancake,
    landing,
    traffic,
    sheet,
    capi,
    reconciliation: {
      period: window,
      posLandingOrders,
      sheetLoggedOrders,
      orderLogDifference,
      orderLogsMatch: orderLogDifference === 0,
      matchedOrders: sheetRowsComplete ? posRecords.filter(record => sheetIds.has(String(record.id))).length : null,
      posOnly,
      sheetOnly,
      sheetRowsComplete,
      note: sheetRowsComplete ? "Matched by order ID for the selected Philippine-time window." : "The Sheet response did not include every logged order row, so exceptions are withheld rather than guessed."
    }
  }, { headers: { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow, noarchive" } });
}


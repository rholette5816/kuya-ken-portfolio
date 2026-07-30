import { get, put } from "@vercel/blob";
import { NextRequest, NextResponse } from "next/server";
import { AdvertisingClientConfig, getAdvertisingClientConfig, validClientSession } from "@/lib/advertising-client-config";

const API_VERSION = "v23.0";
const COOKIE_NAME = "kra_os_access";
const REFRESH_MS = 5 * 60 * 1000;
const MANUAL_REFRESH_MS = 2 * 60 * 1000;
const DATA_VERSION = 8;
type MetaRow = Record<string, any>;
type SnapshotRecord = { snapshot: any | null; changes: any[] };

async function validClientToken(token: string, config: AdvertisingClientConfig) {
  if (validClientSession(token, config.slug)) return true;
  if (config.slug !== "rminds") return false;
  if (!/^[a-f0-9]{48}$/.test(token)) return false;
  const result = await get(`${config.storagePrefix}/${token}.json`, { access: "private", useCache: false });
  return Boolean(result?.statusCode === 200);
}

async function loadRecord(config: AdvertisingClientConfig): Promise<SnapshotRecord> {
  const result = await get(`${config.storagePrefix}/ad-operations.json`, { access: "private", useCache: false });
  if (!result || result.statusCode !== 200 || !result.stream) return { snapshot: null, changes: [] };
  return JSON.parse(await new Response(result.stream).text());
}

async function saveRecord(config: AdvertisingClientConfig, record: SnapshotRecord) {
  await put(`${config.storagePrefix}/ad-operations.json`, JSON.stringify(record), { access: "private", contentType: "application/json", addRandomSuffix: false, allowOverwrite: true, cacheControlMaxAge: 60 });
}

async function graph(config: AdvertisingClientConfig, pathname: string, params: Record<string, string>) {
  const token = process.env[config.metaTokenEnv];
  if (!token) throw new Error("Meta access is not configured.");
  const query = new URLSearchParams({ ...params, access_token: token });
  const response = await fetch(`https://graph.facebook.com/${API_VERSION}/${pathname}?${query}`, { cache: "no-store" });
  const body = await response.json();
  if (!response.ok || body.error) throw new Error(body.error?.message || "Meta request failed.");
  return body;
}

async function graphAll(config: AdvertisingClientConfig, pathname: string, params: Record<string, string>) {
  const rows: MetaRow[] = [];
  let body = await graph(config, pathname, { ...params, limit: "200" });
  while (true) {
    rows.push(...(body.data || []));
    const next = body.paging?.next;
    if (!next) break;
    const response = await fetch(next, { cache: "no-store" });
    body = await response.json();
    if (!response.ok || body.error) throw new Error(body.error?.message || "Meta pagination failed.");
  }
  return rows;
}

function money(value: unknown) {
  const amount = Number(value || 0);
  return Number.isFinite(amount) ? amount / 100 : 0;
}

function extractPageId(ad: MetaRow) {
  return ad.creative?.object_story_spec?.page_id || String(ad.creative?.effective_object_story_id || "").split("_")[0] || "";
}

function businessName(config: AdvertisingClientConfig, pageId: string, campaignName: string) {
  const pageBusiness = config.brands.find(brand => brand.pageId === pageId)?.name;
  if (pageBusiness) return pageBusiness;
  const value = campaignName.toLowerCase();
  const keywordBusiness = config.brands.find(brand => brand.campaignKeywords.some(keyword => value.includes(keyword.toLowerCase())))?.name;
  if (keywordBusiness) return keywordBusiness;
  return "Unmapped";
}

function actionResult(row: MetaRow, types: string[]) {
  for (const type of types) {
    const action = (row.actions || []).find((item: MetaRow) => item.action_type === type);
    if (action) return { type, value: Number(action.value || 0) };
  }
  return null;
}

function resultForGoal(row: MetaRow, optimizationGoal: string) {
  const goalActions: Record<string, string[]> = {
    CONVERSATIONS: ["onsite_conversion.messaging_conversation_started_7d", "messaging_conversation_started_7d"],
    POST_ENGAGEMENT: ["post_engagement"],
    LANDING_PAGE_VIEWS: ["landing_page_view"],
    LINK_CLICKS: ["link_click"],
    QUALITY_CALL: ["click_to_call_call_confirm", "phone_call_placed"]
  };
  if (optimizationGoal === "REACH") return { type: "reach", value: Number(row.reach || 0) };
  if (optimizationGoal === "IMPRESSIONS") return { type: "impressions", value: Number(row.impressions || 0) };
  if (optimizationGoal === "THRUPLAY") return { type: "video_thruplay_watched_actions", value: videoValue(row, "video_thruplay_watched_actions") };
  const expectedActions = goalActions[optimizationGoal];
  if (expectedActions) {
    return actionResult(row, expectedActions) || { type: expectedActions[0], value: 0 };
  }
  return actionResult(row, ["lead", "purchase", "onsite_conversion.messaging_conversation_started_7d", "link_click", "post_engagement"])
    || { type: "result", value: 0 };
}

function actionValue(row: MetaRow, types: string[]) {
  return (row.actions || []).filter((item: MetaRow) => types.includes(item.action_type)).reduce((sum: number, item: MetaRow) => sum + Number(item.value || 0), 0);
}

function videoValue(row: MetaRow, field: string) {
  return (row[field] || []).reduce((sum: number, item: MetaRow) => sum + Number(item.value || 0), 0);
}

function detectChanges(previous: any, current: any) {
  if (!previous) return [];
  const fields: Record<string, string[]> = {
    campaign: ["name", "status", "effectiveStatus", "objective", "dailyBudget", "lifetimeBudget", "startTime", "stopTime"],
    adset: ["name", "status", "effectiveStatus", "dailyBudget", "lifetimeBudget", "optimizationGoal", "bidStrategy", "startTime", "endTime"],
    ad: ["name", "status", "effectiveStatus", "postId"]
  };
  const events: any[] = [];
  for (const type of Object.keys(fields)) {
    const before = new Map((previous[`${type}s`] || []).map((item: any) => [item.id, item]));
    for (const item of current[`${type}s`] || []) {
      const old: any = before.get(item.id);
      if (!old) { events.push({ timestamp: current.syncedAt, type, objectId: item.id, objectName: item.name, business: item.business, field: "created", before: null, after: "Created" }); continue; }
      for (const field of fields[type]) {
        if (JSON.stringify(old[field] ?? null) !== JSON.stringify(item[field] ?? null)) events.push({ timestamp: current.syncedAt, type, objectId: item.id, objectName: item.name, business: item.business, field, before: old[field] ?? null, after: item[field] ?? null });
      }
    }
  }
  return events;
}

async function refresh(config: AdvertisingClientConfig, previous: any) {
  const accountId = config.metaAccountId;
  const pageBusinesses = Object.fromEntries(config.brands.filter(brand => brand.pageId).map(brand => [brand.pageId, brand.name]));
  const [account, campaignsRaw, adsetsRaw, adsRaw] = await Promise.all([
    graph(config, accountId, { fields: "id,name,currency,timezone_name,account_status,balance,amount_spent,spend_cap" }),
    graphAll(config, `${accountId}/campaigns`, { fields: "id,name,status,effective_status,objective,daily_budget,lifetime_budget,start_time,stop_time,updated_time" }),
    graphAll(config, `${accountId}/adsets`, { fields: "id,name,campaign_id,status,effective_status,daily_budget,lifetime_budget,optimization_goal,billing_event,bid_strategy,start_time,end_time,updated_time" }),
    graphAll(config, `${accountId}/ads`, { fields: "id,name,campaign_id,adset_id,status,effective_status,updated_time,creative{id,name,thumbnail_url,object_type,body,title,call_to_action_type,effective_object_story_id,object_story_spec}" })
  ]);
  const campaignById = new Map(campaignsRaw.map(item => [item.id, item]));
  const adsetById = new Map(adsetsRaw.map(item => [item.id, item]));
  const adById = new Map(adsRaw.map(item => [item.id, item]));
  const manilaDate = (date: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: config.timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
  const today = manilaDate(new Date());
  const historyStart = manilaDate(new Date(Date.now() - 89 * 86400000));
  const monthStart = today.slice(0, 8) + "01";
  const insightRows = await graphAll(config, `${accountId}/insights`, { level: "ad", fields: "ad_id,spend,impressions,reach,clicks,inline_link_clicks,actions,video_play_actions,video_thruplay_watched_actions,video_p100_watched_actions,date_start,date_stop", time_range: JSON.stringify({ since: historyStart, until: today }), time_increment: "1" });
  const insights = new Map<string, any>();
  for (const row of insightRows) {
    const current = insights.get(row.ad_id) || { today: 0, sevenDays: 0, month: 0, impressions: 0, reach: 0, clicks: 0, linkClicks: 0, results: 0, resultType: "result", daily: [] };
    const spend = Number(row.spend || 0);
    const daysAgo = Math.floor((Date.now() - new Date(`${row.date_start}T00:00:00Z`).getTime()) / 86400000);
    if (row.date_start >= monthStart) current.month += spend;
    if (row.date_start === today) current.today += spend;
    if (daysAgo <= 6) current.sevenDays += spend;
    current.impressions += Number(row.impressions || 0);
    current.reach += Number(row.reach || 0);
    current.clicks += Number(row.clicks || 0);
    current.linkClicks += Number(row.inline_link_clicks || 0);
    const ad: any = adById.get(row.ad_id);
    const adset: any = adsetById.get(ad?.adset_id);
    const result = resultForGoal(row, adset?.optimization_goal || "");
    current.results += result.value;
    if (result.value) current.resultType = result.type;
    current.daily.push({ date: row.date_start, spend, impressions: Number(row.impressions || 0), reach: Number(row.reach || 0), clicks: Number(row.clicks || 0), linkClicks: Number(row.inline_link_clicks || 0), results: result.value, resultType: result.type, engagements: actionValue(row, ["post_engagement"]), reactions: actionValue(row, ["post_reaction"]), comments: actionValue(row, ["comment"]), shares: actionValue(row, ["post"]), saves: actionValue(row, ["onsite_conversion.post_save"]), videoStarts: videoValue(row, "video_play_actions"), video100: videoValue(row, "video_p100_watched_actions") });
    insights.set(row.ad_id, current);
  }
  const adBusiness = new Map<string, string>();
  const ads = adsRaw.map(item => {
    const pageId = extractPageId(item);
    const campaign: any = campaignById.get(item.campaign_id);
    const business = businessName(config, pageId, campaign?.name || "");
    adBusiness.set(item.id, business);
    const postId = item.creative?.effective_object_story_id || "";
    const creative = item.creative || {};
    const story = creative.object_story_spec || {};
    const linkData = story.link_data || {};
    const videoData = story.video_data || {};
    return { id: item.id, name: item.name, campaignId: item.campaign_id, adsetId: item.adset_id, status: item.status, effectiveStatus: item.effective_status, updatedTime: item.updated_time, pageId, pageName: pageBusinesses[pageId] || "Unmapped Page", postId, postLink: postId ? `https://www.facebook.com/${postId.replace("_", "/posts/")}` : "", business, creative: { id: creative.id || "", name: creative.name || "", thumbnailUrl: creative.thumbnail_url || "", format: creative.object_type || (videoData.video_id ? "VIDEO" : "IMAGE"), body: creative.body || linkData.message || videoData.message || "", title: creative.title || linkData.name || videoData.title || "", callToAction: creative.call_to_action_type || linkData.call_to_action?.type || videoData.call_to_action?.type || "" }, spend: insights.get(item.id) || { today: 0, sevenDays: 0, month: 0, impressions: 0, reach: 0, clicks: 0, linkClicks: 0, results: 0, resultType: "result", daily: [] } };
  });
  const aggregate = (ids: string[]) => ids.reduce((totals: any, id) => { const value = insights.get(id); if (value) { for (const key of ["today", "sevenDays", "month", "impressions", "reach", "clicks", "linkClicks", "results"]) totals[key] += value[key]; totals.daily.push(...value.daily); } return totals; }, { today: 0, sevenDays: 0, month: 0, impressions: 0, reach: 0, clicks: 0, linkClicks: 0, results: 0, daily: [] });
  const adsets = adsetsRaw.map(item => { const childAds = ads.filter(ad => ad.adsetId === item.id); const business = childAds[0]?.business || businessName(config, "", (campaignById.get(item.campaign_id) as any)?.name || item.name); return { id: item.id, name: item.name, campaignId: item.campaign_id, status: item.status, effectiveStatus: item.effective_status, dailyBudget: money(item.daily_budget), lifetimeBudget: money(item.lifetime_budget), optimizationGoal: item.optimization_goal, bidStrategy: item.bid_strategy, startTime: item.start_time, endTime: item.end_time, updatedTime: item.updated_time, business, spend: aggregate(childAds.map(ad => ad.id)) }; });
  const campaigns = campaignsRaw.map(item => { const childAds = ads.filter(ad => ad.campaignId === item.id); const businessCounts = childAds.reduce((map: Record<string, number>, ad) => ({ ...map, [ad.business]: (map[ad.business] || 0) + 1 }), {}); const business = Object.entries(businessCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || businessName(config, "", item.name); return { id: item.id, name: item.name, status: item.status, effectiveStatus: item.effective_status, objective: item.objective, dailyBudget: money(item.daily_budget), lifetimeBudget: money(item.lifetime_budget), startTime: item.start_time, stopTime: item.stop_time, updatedTime: item.updated_time, business, budgetType: item.daily_budget || item.lifetime_budget ? "CBO" : "ABO", spend: aggregate(childAds.map(ad => ad.id)) }; });
  for (const item of [...adsets, ...ads]) if (item.business === "Unmapped") item.business = (campaigns.find(campaign => campaign.id === (item as any).campaignId)?.business || "Unmapped");
  return { account, syncedAt: new Date().toISOString(), dataVersion: DATA_VERSION, historyDays: 90, campaigns, adsets, ads };
}

export async function GET(request: NextRequest) {
  const config = await getAdvertisingClientConfig(request.nextUrl.searchParams.get("client") || "rminds");
  if (!config) return NextResponse.json({ error: "Advertising client not found." }, { status: 404 });
  const token = request.nextUrl.searchParams.get("token") || "";
  if (!(await validClientToken(token, config))) return NextResponse.json({ error: "A valid private client link is required." }, { status: 401 });
  const record = await loadRecord(config);
  const isAdmin = Boolean(process.env.KRA_OS_ACCESS_TOKEN && request.cookies.get(COOKIE_NAME)?.value === process.env.KRA_OS_ACCESS_TOKEN);
  const stale = !record.snapshot || record.snapshot.dataVersion !== DATA_VERSION || Date.now() - new Date(record.snapshot.syncedAt).getTime() > REFRESH_MS;
  const snapshotAge = record.snapshot ? Date.now() - new Date(record.snapshot.syncedAt).getTime() : Infinity;
  const requestedRefresh = request.nextUrl.searchParams.get("refresh") === "1";
  const force = requestedRefresh && (isAdmin || snapshotAge >= MANUAL_REFRESH_MS);
  try {
    if (stale || force) {
      const snapshot = await refresh(config, record.snapshot);
      const changes = [...detectChanges(record.snapshot, snapshot), ...record.changes].slice(0, 1000);
      await saveRecord(config, { snapshot, changes });
      return NextResponse.json({ snapshot, changes, canRefresh: true, refreshCooldownMinutes: 2 }, { headers: { "Cache-Control": "no-store" } });
    }
    return NextResponse.json({ ...record, canRefresh: true, refreshCooldownMinutes: 2, refreshDeferred: requestedRefresh && !force }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (record.snapshot) return NextResponse.json({ ...record, canRefresh: true, syncError: error instanceof Error ? error.message : "Meta synchronization failed." }, { headers: { "Cache-Control": "no-store" } });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Meta synchronization failed." }, { status: 502 });
  }
}

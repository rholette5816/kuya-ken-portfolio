import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const META_API_VERSION = "v23.0";
const MAX_PAGES = 12;
const PAGE_IDS = ["791854314012769", "61578083413760", "851483241371016"] as const;
const PAGE_FALLBACKS: Record<string, string> = {
  "791854314012769": "Mr Lakatan Farmer",
  "61578083413760": "Linked Facebook Page",
  "851483241371016": "Backyard Farming TV"
};
const AD_ACCOUNTS = [
  { id: "act_1438592618166795", name: "BM extra #3 - saha" }
] as const;

type Row = Record<string, any>;

function token() {
  return process.env.VISION_X_SAHA_META_TOKEN || process.env.LAKATAN_META_TOKEN || process.env.META_ACCESS_TOKEN || "";
}

function list(value: unknown): Row[] {
  return Array.isArray(value) ? value.filter(item => item && typeof item === "object") : [];
}

function ymd(value: string | null) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value || "") ? String(value) : "";
}

function accountDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Hong_Kong",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const value = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

function rangeOf(request: NextRequest) {
  const defaultEnd = accountDate();
  const defaultStart = `${defaultEnd.slice(0, 7)}-01`;
  const start = ymd(request.nextUrl.searchParams.get("start")) || defaultStart;
  const end = ymd(request.nextUrl.searchParams.get("end")) || defaultEnd;
  const startMs = Date.parse(`${start}T00:00:00Z`);
  const endMs = Date.parse(`${end}T23:59:59Z`);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || startMs > endMs || endMs - startMs > 180 * 86400000) {
    throw new Error("Choose a valid date range of 180 days or less.");
  }
  return { start, end };
}

async function graph(path: string, params: Record<string, string> = {}, suppliedToken = "") {
  const accessToken = suppliedToken || token();
  if (!accessToken) throw new Error("Meta access is not configured.");
  const query = new URLSearchParams({ ...params, access_token: accessToken });
  const response = await fetch(`https://graph.facebook.com/${META_API_VERSION}/${path}?${query}`, { cache: "no-store" });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.error) throw new Error(body.error?.message || `Meta returned ${response.status}.`);
  return body;
}

async function paged(path: string, params: Record<string, string>, suppliedToken = "") {
  const rows: Row[] = [];
  let body = await graph(path, params, suppliedToken);
  let page = 0;
  while (body && page < MAX_PAGES) {
    rows.push(...list(body.data));
    const next = String(body.paging?.next || "");
    if (!next) break;
    const response = await fetch(next, { cache: "no-store" });
    body = await response.json().catch(() => ({}));
    if (!response.ok || body.error) throw new Error(body.error?.message || `Meta returned ${response.status}.`);
    page += 1;
  }
  return rows;
}

function actionValue(row: Row, field: "actions" | "action_values", types: string[]) {
  return list(row[field])
    .filter(action => types.includes(String(action.action_type || "")))
    .reduce((sum, action) => sum + Number(action.value || 0), 0);
}

function preferredActionType(rows: Row[], field: "actions" | "action_values", types: string[]) {
  for (const type of types) {
    if (rows.some(row => list(row[field]).some(action => String(action.action_type || "") === type))) return type;
  }
  return "";
}

function videoValue(row: Row, field: string) {
  return list(row[field]).reduce((sum, item) => sum + Number(item.value || 0), 0);
}

function storyParts(storyId: string) {
  const split = storyId.indexOf("_");
  return split > 0 ? { pageId: storyId.slice(0, split), postId: storyId.slice(split + 1) } : { pageId: "", postId: storyId };
}

function previewOf(post: Row) {
  const attachment = list(post.attachments?.data)[0] || {};
  const media = attachment.media || {};
  return {
    type: String(attachment.media_type || post.status_type || "post").toLowerCase(),
    url: String(post.full_picture || media.image?.src || media.source || attachment.url || "")
  };
}

function postInsightMap(post: Row) {
  const output: Record<string, any> = {};
  for (const metric of list(post.insights?.data)) {
    output[String(metric.name || "")] = list(metric.values)[0]?.value ?? 0;
  }
  return output;
}

function numberMetric(insights: Record<string, any>, name: string) {
  const value = insights[name];
  if (typeof value === "number") return value;
  if (value && typeof value === "object") return Object.values(value).reduce<number>((sum, item) => sum + Number(item || 0), 0);
  return Number(value || 0);
}

function blankPost(pageId: string, postId: string, pageName: string): Row {
  return {
    key: `${pageId}_${postId}`,
    pageId,
    postId,
    pageName,
    message: "",
    createdTime: "",
    postUrl: `https://www.facebook.com/${pageId}/posts/${postId}`,
    preview: { type: "post", url: "" },
    organic: { impressions: 0, reach: 0, engagedUsers: 0, clicks: 0, reactions: 0, comments: 0, shares: 0, videoViews: 0 },
    paid: { spend: 0, impressions: 0, reach: 0, clicks: 0, linkClicks: 0, landingPageViews: 0, purchases: 0, purchaseValue: 0, engagements: 0, reactions: 0, comments: 0, shares: 0, saves: 0, videoViews: 0, thruPlays: 0 },
    ads: [],
    source: { page: false, ads: false }
  };
}

async function pagePosts(pageId: string, range: { start: string; end: string }, pageToken = "") {
  const page = await graph(pageId, { fields: "id,name,picture{url}" }, pageToken);
  const fields = [
    "id", "message", "created_time", "permalink_url", "full_picture", "is_published", "status_type", "shares",
    "comments.limit(0).summary(true)", "reactions.limit(0).summary(true)",
    "attachments.limit(1){media_type,media,url}",
    "insights.metric(post_impressions,post_impressions_unique,post_engaged_users,post_clicks,post_video_views)"
  ].join(",");
  const posts = await paged(`${pageId}/published_posts`, {
    fields,
    since: range.start,
    until: range.end,
    limit: "100"
  }, pageToken);
  return { page, posts };
}

async function accountData(account: typeof AD_ACCOUNTS[number], range: { start: string; end: string }) {
  const [ads, insights, accountInsights] = await Promise.all([
    paged(`${account.id}/ads`, {
      fields: "id,name,status,effective_status,created_time,updated_time,creative{id,thumbnail_url,image_url,effective_object_story_id,object_story_id}",
      limit: "200"
    }),
    paged(`${account.id}/insights`, {
      level: "ad",
      fields: "ad_id,spend,impressions,reach,clicks,inline_link_clicks,actions,action_values,video_play_actions,video_thruplay_watched_actions",
      time_range: JSON.stringify({ since: range.start, until: range.end }),
      limit: "200"
    }),
    paged(`${account.id}/insights`, {
      level: "account",
      fields: "spend,impressions,reach,clicks,actions,action_values",
      time_range: JSON.stringify({ since: range.start, until: range.end }),
      limit: "10"
    })
  ]);
  return { account, ads, insights, accountInsights };
}

async function secureCodPageData(range: { start: string; end: string }) {
  const secret = process.env.VISION_X_SAHA_ANALYTICS_SECRET;
  if (!secret) return null;
  const params = new URLSearchParams(range);
  const response = await fetch(`https://www.securecodexpress.xyz/api/vision-saha-page-posts?${params}`, {
    headers: { authorization: `Bearer ${secret}` },
    cache: "no-store"
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || "SecureCOD Page access failed.");
  return body;
}

export async function GET(request: NextRequest) {
  try {
    const range = rangeOf(request);
    const posts = new Map<string, Row>();
    const secureCodPromise = secureCodPageData(range).catch(error => ({ pages: [], posts: [], warnings: [`SecureCOD Page access: ${error instanceof Error ? error.message : "Unavailable."}`] }));
    const managedPageTokens = new Map<string, string>();
    const accessWarnings: string[] = [];
    try {
      const managedPages = await paged("me/accounts", { fields: "id,name,access_token", limit: "100" });
      for (const managedPage of managedPages) {
        if (managedPage.id && managedPage.access_token) managedPageTokens.set(String(managedPage.id), String(managedPage.access_token));
      }
    } catch (error) {
      accessWarnings.push(`Managed Page tokens: ${error instanceof Error ? error.message : "Unavailable."}`);
    }
    const pageResults = await Promise.allSettled(PAGE_IDS.map(pageId => pagePosts(pageId, range, managedPageTokens.get(pageId) || "")));
    const accountResults = await Promise.allSettled(AD_ACCOUNTS.map(account => accountData(account, range)));
    let warnings: string[] = [...accessWarnings];
    const pages: Array<{ id: string; name: string; picture: string; connected: boolean }> = PAGE_IDS.map((pageId, index) => {
      const result = pageResults[index];
      if (result.status === "rejected") {
        warnings.push(`${PAGE_FALLBACKS[pageId]}: ${result.reason instanceof Error ? result.reason.message : "Page posts unavailable."}`);
        return { id: pageId, name: PAGE_FALLBACKS[pageId], picture: "", connected: false };
      }
      const pageName = String(result.value.page.name || PAGE_FALLBACKS[pageId]);
      for (const raw of result.value.posts) {
        const parts = storyParts(String(raw.id || ""));
        const insight = postInsightMap(raw);
        const item = blankPost(pageId, parts.postId, pageName);
        item.message = String(raw.message || "");
        item.createdTime = String(raw.created_time || "");
        item.postUrl = String(raw.permalink_url || item.postUrl);
        item.preview = previewOf(raw);
        item.organic = {
          impressions: numberMetric(insight, "post_impressions"),
          reach: numberMetric(insight, "post_impressions_unique"),
          engagedUsers: numberMetric(insight, "post_engaged_users"),
          clicks: numberMetric(insight, "post_clicks"),
          reactions: Number(raw.reactions?.summary?.total_count || 0),
          comments: Number(raw.comments?.summary?.total_count || 0),
          shares: Number(raw.shares?.count || 0),
          videoViews: numberMetric(insight, "post_video_views")
        };
        item.source.page = true;
        posts.set(item.key, item);
      }
      return { id: pageId, name: pageName, picture: String(result.value.page.picture?.data?.url || ""), connected: true };
    });

    const secureCod = await secureCodPromise;
    const recoveredPages = new Set<string>();
    for (const remotePage of list(secureCod?.pages)) {
      if (!remotePage.connected) continue;
      const localPage = pages.find(page => page.id === String(remotePage.id || ""));
      if (localPage) {
        localPage.connected = true;
        localPage.name = String(remotePage.name || localPage.name);
        localPage.picture = String(remotePage.picture || localPage.picture);
        recoveredPages.add(localPage.id);
      }
    }
    for (const remote of list(secureCod?.posts)) {
      const pageId = String(remote.pageId || "");
      const postId = String(remote.postId || "");
      if (!PAGE_IDS.includes(pageId as typeof PAGE_IDS[number]) || !postId) continue;
      const key = `${pageId}_${postId}`;
      const item = posts.get(key) || blankPost(pageId, postId, String(remote.pageName || PAGE_FALLBACKS[pageId]));
      item.pageName = String(remote.pageName || item.pageName);
      item.message = String(remote.message || item.message);
      item.createdTime = String(remote.createdTime || item.createdTime);
      item.postUrl = String(remote.postUrl || item.postUrl);
      if (remote.preview?.url) item.preview = remote.preview;
      item.organic = remote.organic || item.organic;
      item.source.page = true;
      posts.set(key, item);
    }
    warnings.push(...(Array.isArray(secureCod?.warnings)
      ? secureCod.warnings.map((item: unknown) => String(item).replace(/^Facebook Page 61578083413760:/, "Linked Facebook Page:"))
      : []));
    warnings = warnings.filter(warning => ![...recoveredPages].some(pageId => warning.startsWith(`${PAGE_FALLBACKS[pageId]}:`)));

    const discoveredPageIds = [...new Set(accountResults.flatMap(result => {
      if (result.status !== "fulfilled") return [];
      return result.value.ads.map(ad => storyParts(String(ad.creative?.effective_object_story_id || ad.creative?.object_story_id || "")).pageId).filter(Boolean);
    }))];
    const knownPageIds = new Set(pages.map(page => page.id));
    const additionalPageIds = discoveredPageIds.filter(pageId => !knownPageIds.has(pageId));
    const additionalPages = await Promise.allSettled(additionalPageIds.map(pageId => graph(pageId, { fields: "id,name,picture{url}" }, managedPageTokens.get(pageId) || "")));
    additionalPageIds.forEach((pageId, index) => {
      const result = additionalPages[index];
      pages.push({
        id: pageId,
        name: result.status === "fulfilled" ? String(result.value.name || `Facebook Page ${pageId}`) : `Facebook Page ${pageId}`,
        picture: result.status === "fulfilled" ? String(result.value.picture?.data?.url || "") : "",
        connected: false
      });
    });

    for (const [index, result] of accountResults.entries()) {
      const account = AD_ACCOUNTS[index];
      if (result.status === "rejected") {
        warnings.push(`${account.name}: ${result.reason instanceof Error ? result.reason.message : "Ad account unavailable."}`);
        continue;
      }
      const insightByAd = new Map(result.value.insights.map(row => [String(row.ad_id || ""), row]));
      const purchaseActionType = preferredActionType(result.value.insights, "actions", ["purchase", "omni_purchase", "offsite_conversion.fb_pixel_purchase"]);
      const purchaseValueActionType = preferredActionType(result.value.insights, "action_values", ["purchase", "omni_purchase", "offsite_conversion.fb_pixel_purchase"]);
      for (const ad of result.value.ads) {
        const creative = ad.creative || {};
        const storyId = String(creative.effective_object_story_id || creative.object_story_id || "");
        const { pageId, postId } = storyParts(storyId);
        if (!pageId || !postId) continue;
        const key = `${pageId}_${postId}`;
        const pageName = pages.find(page => page.id === pageId)?.name || PAGE_FALLBACKS[pageId] || `Facebook Page ${pageId}`;
        const item = posts.get(key) || blankPost(pageId, postId, pageName);
        const insight = insightByAd.get(String(ad.id || "")) || {};
        item.source.ads = true;
        if (!item.preview.url) item.preview = { type: creative.video_id ? "video" : "image", url: String(creative.thumbnail_url || creative.image_url || "") };
        item.ads.push({
          id: String(ad.id || ""),
          name: String(ad.name || "Unnamed ad"),
          accountId: account.id,
          accountName: account.name,
          status: String(ad.effective_status || ad.status || "")
        });
        const paid = item.paid;
        paid.spend += Number(insight.spend || 0);
        paid.impressions += Number(insight.impressions || 0);
        paid.reach += Number(insight.reach || 0);
        paid.clicks += Number(insight.clicks || 0);
        paid.linkClicks += Number(insight.inline_link_clicks || 0);
        paid.landingPageViews += actionValue(insight, "actions", ["landing_page_view"]);
        paid.purchases += actionValue(insight, "actions", purchaseActionType ? [purchaseActionType] : []);
        paid.purchaseValue += actionValue(insight, "action_values", purchaseValueActionType ? [purchaseValueActionType] : []);
        paid.engagements += actionValue(insight, "actions", ["post_engagement"]);
        paid.reactions += actionValue(insight, "actions", ["post_reaction"]);
        paid.comments += actionValue(insight, "actions", ["comment"]);
        paid.shares += actionValue(insight, "actions", ["post"]);
        paid.saves += actionValue(insight, "actions", ["onsite_conversion.post_save"]);
        paid.videoViews += videoValue(insight, "video_play_actions");
        paid.thruPlays += videoValue(insight, "video_thruplay_watched_actions");
        posts.set(key, item);
      }
    }

    const items: Row[] = [...posts.values()].map((item): Row => {
      const impressions = item.organic.impressions || item.paid.impressions;
      const engagements = item.organic.engagedUsers || item.paid.engagements;
      const engagementRate = impressions ? engagements / impressions * 100 : 0;
      const uniqueCtr = item.paid.reach ? item.paid.linkClicks / item.paid.reach * 100 : 0;
      const landingPageRate = item.paid.linkClicks ? item.paid.landingPageViews / item.paid.linkClicks * 100 : 0;
      const roas = item.paid.spend ? item.paid.purchaseValue / item.paid.spend : 0;
      const hookRate = item.paid.impressions ? item.paid.videoViews / item.paid.impressions * 100 : 0;
      const holdRate = item.paid.impressions ? item.paid.thruPlays / item.paid.impressions * 100 : 0;
      const engagementScore = Math.min(100, hookRate * 0.45 + holdRate * 0.35 + engagementRate * 2);
      const behaviorScore = Math.min(100, uniqueCtr * 10 + landingPageRate * 0.5);
      const profitabilityScore = Math.min(100, roas * 12 + item.paid.purchases * 4);
      return {
        ...item,
        metrics: {
          engagementRate, uniqueCtr, landingPageRate, hookRate, holdRate, roas,
          cpa: item.paid.purchases ? item.paid.spend / item.paid.purchases : 0,
          cpc: item.paid.linkClicks ? item.paid.spend / item.paid.linkClicks : 0
        },
        scores: {
          engagement: engagementScore,
          behavior: behaviorScore,
          profitability: profitabilityScore,
          overall: engagementScore * 0.5 + behaviorScore * 0.35 + profitabilityScore * 0.15
        }
      };
    }).sort((a, b) => b.scores.overall - a.scores.overall || String(b.createdTime).localeCompare(String(a.createdTime)));
    for (const field of ["engagement", "behavior", "profitability", "overall"] as const) {
      [...items].sort((a, b) => b.scores[field] - a.scores[field]).forEach((item, index) => {
        item.ranks = { ...(item.ranks || {}), [field]: index + 1 };
      });
    }
    const rankedSpend = items.reduce((sum, item) => sum + item.paid.spend, 0);
    const accountInsightRows = accountResults.flatMap(result => result.status === "fulfilled" ? result.value.accountInsights : []);
    const accountPurchaseType = preferredActionType(accountInsightRows, "actions", ["purchase", "omni_purchase", "offsite_conversion.fb_pixel_purchase"]);
    const accountPurchaseValueType = preferredActionType(accountInsightRows, "action_values", ["purchase", "omni_purchase", "offsite_conversion.fb_pixel_purchase"]);
    const summary = {
      posts: items.length,
      organicPosts: items.filter(item => item.source.page).length,
      advertisedPosts: items.filter(item => item.source.ads).length,
      activeAds: items.reduce((sum, item) => sum + item.ads.filter((ad: Row) => ad.status === "ACTIVE").length, 0),
      spend: Math.round((accountInsightRows.length ? accountInsightRows.reduce((sum, row) => sum + Number(row.spend || 0), 0) : rankedSpend) * 100) / 100,
      rankedSpend: Math.round(rankedSpend * 100) / 100,
      purchases: accountInsightRows.length ? accountInsightRows.reduce((sum, row) => sum + actionValue(row, "actions", accountPurchaseType ? [accountPurchaseType] : []), 0) : items.reduce((sum, item) => sum + item.paid.purchases, 0),
      purchaseValue: Math.round((accountInsightRows.length ? accountInsightRows.reduce((sum, row) => sum + actionValue(row, "action_values", accountPurchaseValueType ? [accountPurchaseValueType] : []), 0) : items.reduce((sum, item) => sum + item.paid.purchaseValue, 0)) * 100) / 100
    };
    warnings = [...new Set(warnings)];

    return NextResponse.json({ generatedAt: new Date().toISOString(), range, pages, summary, warnings, posts: items }, {
      headers: { "Cache-Control": "private, no-store, max-age=0", "X-Robots-Tag": "noindex, nofollow, noarchive" }
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Post Library could not be loaded." }, { status: 500, headers: { "Cache-Control": "private, no-store" } });
  }
}



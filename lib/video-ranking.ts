import { get, put } from "@vercel/blob";
import { AdvertisingClientConfig, getAdvertisingClientConfig, validClientSession } from "@/lib/advertising-client-config";

const API_VERSION = "v23.0";
export const COOKIE_NAME = "kra_os_access";
export const REFRESH_MS = 12 * 60 * 60 * 1000;
export const MANUAL_REFRESH_MS = 5 * 60 * 1000;
export const DATA_VERSION = 1;
const MIN_IMPRESSIONS = 5000;
const WEIGHTS = { hold: 0.35, thru: 0.25, eng: 0.25, amp: 0.15 };
const UNMAPPED = "Unmapped pages";

type MetaRow = Record<string, any>;

export async function validClientToken(token: string, config: AdvertisingClientConfig) {
  if (validClientSession(token, config.slug)) return true;
  if (config.slug !== "rminds") return false;
  if (!/^[a-f0-9]{48}$/.test(token)) return false;
  const result = await get(`${config.storagePrefix}/${token}.json`, { access: "private", useCache: false });
  return Boolean(result?.statusCode === 200);
}

export async function loadRecord(config: AdvertisingClientConfig) {
  const result = await get(`${config.storagePrefix}/video-ranking.json`, { access: "private", useCache: false });
  if (!result || result.statusCode !== 200 || !result.stream) return null;
  return JSON.parse(await new Response(result.stream).text());
}

export async function saveRecord(config: AdvertisingClientConfig, report: any) {
  await put(`${config.storagePrefix}/video-ranking.json`, JSON.stringify(report), {
    access: "private", contentType: "application/json", addRandomSuffix: false, allowOverwrite: true, cacheControlMaxAge: 60
  });
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
  let body = await graph(config, pathname, { ...params, limit: params.limit || "200" });
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

function sumValues(row: MetaRow, field: string) {
  return (row[field] || []).reduce((total: number, item: MetaRow) => total + Number(item.value || 0), 0);
}

function actionValue(row: MetaRow, type: string) {
  const action = (row.actions || []).find((item: MetaRow) => item.action_type === type);
  return action ? Number(action.value || 0) : 0;
}

function videoIdOf(creative: MetaRow) {
  const story = creative.object_story_spec || {};
  return creative.video_id || story.video_data?.video_id || (creative.asset_feed_spec?.videos || [])[0]?.video_id || "";
}

function isVideoAd(creative: MetaRow) {
  return Boolean(videoIdOf(creative)) || creative.object_type === "VIDEO";
}

function cleanName(name: string) {
  const stripped = String(name || "")
    .replace(/\s*\|\s*ORIGINAL POST/i, "")
    .replace(/^(VIDEO\s*\|\s*|Post:\s*)/i, "")
    .replace(/\|/g, "/")
    .replace(/^"|"$/g, "")
    .trim();
  return stripped.slice(0, 44) || "Untitled";
}

function percentileRank(pool: number[], value: number) {
  const below = pool.filter(item => item < value).length;
  const equal = pool.filter(item => item === value).length;
  return ((below + equal / 2) / pool.length) * 100;
}

function tierOf(score: number) {
  if (score >= 70) return "Top attention";
  if (score >= 50) return "Solid";
  if (score >= 30) return "Weak";
  return "Scroll-past";
}

function verdictOf(post: any) {
  const parts: string[] = [];
  if (post.holdRate >= 15) parts.push(`${post.holdRate.toFixed(0)}% of viewers who started finished the whole video`);
  else if (post.holdRate >= 6) parts.push(`${post.holdRate.toFixed(0)}% completion, mid-pack retention`);
  else parts.push(`only ${post.holdRate.toFixed(1)}% completion, viewers drop early`);
  if (post.engRate >= 45) parts.push(`very high interaction at ${post.engRate.toFixed(0)}% of impressions`);
  else if (post.engRate >= 20) parts.push(`healthy interaction at ${post.engRate.toFixed(0)}%`);
  else parts.push(`low interaction at ${post.engRate.toFixed(0)}%`);
  if (post.ampRate >= 0.06) parts.push("strong comment and share pull");
  else if (post.ampRate <= 0.015) parts.push("almost no comments or shares");
  return parts.map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(". ") + ".";
}

function brandForPage(config: AdvertisingClientConfig, pageId: string) {
  return config.brands.find(brand => brand.pageId && brand.pageId === pageId)?.name || "";
}

export async function buildReport(config: AdvertisingClientConfig) {
  const accountId = config.metaAccountId;
  const [adsRaw, insightRows] = await Promise.all([
    graphAll(config, `${accountId}/ads`, {
      fields: "id,name,status,effective_status,created_time,campaign{id,name},creative{id,object_type,effective_object_story_id,object_story_id,video_id,object_story_spec,asset_feed_spec}"
    }),
    graphAll(config, `${accountId}/insights`, {
      level: "ad",
      date_preset: "maximum",
      limit: "500",
      fields: "ad_id,impressions,reach,spend,clicks,actions,video_play_actions,video_thruplay_watched_actions,video_p100_watched_actions"
    })
  ]);

  const metrics = new Map<string, MetaRow>(insightRows.map(row => [row.ad_id, row]));
  const posts = new Map<string, any>();

  for (const ad of adsRaw) {
    const creative = ad.creative || {};
    if (!isVideoAd(creative)) continue;
    const storyId = creative.effective_object_story_id || creative.object_story_id || "";
    if (!storyId.includes("_")) continue;
    const [pageId, postId] = storyId.split("_");
    const link = `https://www.facebook.com/${pageId}/posts/${postId}`;
    const row = metrics.get(ad.id) || {};
    const entry = posts.get(link) || {
      link, pageId, videoId: videoIdOf(creative),
      videoLink: videoIdOf(creative) ? `https://www.facebook.com/${pageId}/videos/${videoIdOf(creative)}` : "",
      names: [] as string[], statuses: [] as string[], created: ad.created_time,
      ads: 0, impressions: 0, reach: 0, spend: 0, clicks: 0,
      plays3s: 0, thruplays: 0, completions: 0,
      engagements: 0, comments: 0, shares: 0, saves: 0, messages: 0
    };
    entry.ads += 1;
    entry.names.push(cleanName(ad.name));
    entry.statuses.push(ad.effective_status);
    if (ad.created_time < entry.created) entry.created = ad.created_time;
    entry.impressions += Number(row.impressions || 0);
    entry.reach += Number(row.reach || 0);
    entry.spend += Number(row.spend || 0);
    entry.clicks += Number(row.clicks || 0);
    entry.plays3s += sumValues(row, "video_play_actions");
    entry.thruplays += sumValues(row, "video_thruplay_watched_actions");
    entry.completions += sumValues(row, "video_p100_watched_actions");
    entry.engagements += actionValue(row, "post_engagement");
    entry.comments += actionValue(row, "comment");
    entry.shares += actionValue(row, "post");
    entry.saves += actionValue(row, "onsite_conversion.post_save");
    entry.messages += actionValue(row, "onsite_conversion.messaging_conversation_started_7d");
    posts.set(link, entry);
  }

  const all = [...posts.values()].map(entry => {
    const impressions = entry.impressions;
    return {
      ...entry,
      name: entry.names.slice().sort((a: string, b: string) => a.length - b.length)[0],
      status: entry.statuses.includes("ACTIVE") ? "ACTIVE" : "Paused",
      created: String(entry.created).slice(0, 10),
      hookRate: impressions ? (entry.plays3s / impressions) * 100 : 0,
      holdRate: entry.plays3s ? (entry.completions / entry.plays3s) * 100 : 0,
      thruRate: impressions ? (entry.thruplays / impressions) * 100 : 0,
      engRate: impressions ? (entry.engagements / impressions) * 100 : 0,
      ampRate: impressions ? ((entry.comments + entry.shares + entry.saves) / impressions) * 100 : 0,
      ctr: impressions ? (entry.clicks / impressions) * 100 : 0
    };
  });

  const graded = all.filter(post => post.impressions >= MIN_IMPRESSIONS);
  const excluded = all.filter(post => post.impressions < MIN_IMPRESSIONS).sort((a, b) => b.impressions - a.impressions);

  const pools = {
    hold: graded.map(post => post.holdRate),
    thru: graded.map(post => post.thruRate),
    eng: graded.map(post => post.engRate),
    amp: graded.map(post => post.ampRate)
  };
  for (const post of graded) {
    const score = graded.length
      ? percentileRank(pools.hold, post.holdRate) * WEIGHTS.hold
        + percentileRank(pools.thru, post.thruRate) * WEIGHTS.thru
        + percentileRank(pools.eng, post.engRate) * WEIGHTS.eng
        + percentileRank(pools.amp, post.ampRate) * WEIGHTS.amp
      : 0;
    (post as any).score = Math.round(score * 10) / 10;
    (post as any).tier = tierOf(score);
    (post as any).verdict = verdictOf(post);
  }
  graded.sort((a, b) => (b as any).score - (a as any).score);
  graded.forEach((post, index) => { (post as any).overallRank = index + 1; });

  const grouped = new Map<string, any[]>();
  for (const post of graded) {
    const brand = brandForPage(config, post.pageId) || UNMAPPED;
    if (!grouped.has(brand)) grouped.set(brand, []);
    grouped.get(brand)!.push(post);
  }

  const order = [...config.brands.map(brand => brand.name), UNMAPPED];
  const brands = order
    .filter(brand => grouped.has(brand))
    .map(brand => {
      const list = grouped.get(brand)!;
      list.forEach((post, index) => { post.rank = index + 1; });
      const totalImpressions = list.reduce((sum, post) => sum + post.impressions, 0);
      const totalSpend = list.reduce((sum, post) => sum + post.spend, 0);
      const best = list[0];
      const worst = list[list.length - 1];
      let summary = `${list.length} video post${list.length > 1 ? "s" : ""} graded, ${totalImpressions.toLocaleString("en-PH")} lifetime impressions on PHP ${Math.round(totalSpend).toLocaleString("en-PH")}. `
        + `Best attention is "${best.name}" at score ${best.score} (${best.holdRate.toFixed(0)}% completion, ${best.engRate.toFixed(0)}% engagement rate).`;
      if (list.length > 1) {
        summary += ` Weakest is "${worst.name}" at ${worst.score} (${worst.holdRate.toFixed(1)}% completion). `
          + `Gap between best and worst is ${(best.score - worst.score).toFixed(0)} points.`;
      }
      return {
        brand,
        summary,
        totalImpressions,
        totalSpend: Math.round(totalSpend * 100) / 100,
        posts: list.map(post => ({
          rank: post.rank, overallRank: post.overallRank, name: post.name, link: post.link,
          videoLink: post.videoLink, status: post.status, created: post.created, ads: post.ads,
          score: post.score, tier: post.tier,
          impressions: post.impressions, spend: Math.round(post.spend * 100) / 100,
          hookRate: Math.round(post.hookRate * 10) / 10, holdRate: Math.round(post.holdRate * 10) / 10,
          thruRate: Math.round(post.thruRate * 10) / 10, engRate: Math.round(post.engRate * 10) / 10,
          ampRate: Math.round(post.ampRate * 1000) / 1000, ctr: Math.round(post.ctr * 100) / 100,
          completions: post.completions, plays3s: post.plays3s, engagements: post.engagements,
          comments: post.comments, shares: post.shares, messages: post.messages,
          verdict: post.verdict
        }))
      };
    });

  return {
    dataVersion: DATA_VERSION,
    syncedAt: new Date().toISOString(),
    generated: new Date().toISOString().slice(0, 10),
    accountId,
    minImpressions: MIN_IMPRESSIONS,
    weights: WEIGHTS,
    totalGraded: graded.length,
    brands,
    excluded: excluded.map(post => ({
      brand: brandForPage(config, post.pageId) || UNMAPPED,
      name: post.name, link: post.link, impressions: post.impressions,
      spend: Math.round(post.spend * 100) / 100, status: post.status
    }))
  };
}


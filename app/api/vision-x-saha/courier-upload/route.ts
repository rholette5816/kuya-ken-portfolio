import { NextRequest, NextResponse } from "next/server";
import { appendJanRun } from "../../../lib/visionJanLog";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const PANCAKE_API = "https://pos.pages.fm/api/v1";

// Bigate J&T Philippines in this Pancake shop.
const JT_PARTNER_ID = 180;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Order statuses we consider "still shippable": new, confirmed, packing.
const SHIPPABLE_STATUSES = new Set([0, 1, 8]);

function array(value: unknown): any[] {
  return Array.isArray(value) ? value : [];
}

function numberValue(value: unknown) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function orderValue(order: any) {
  const raw = numberValue(order.cod || order.total_price_after_sub_discount || order.total_price);
  return raw > 10000 ? raw / 100 : raw;
}

// An order counts as already pushed only when it has a REAL courier booking,
// not just a partner_id left over from a failed attempt.
function isPushed(order: any) {
  const p = order?.partner;
  if (!p || typeof p !== "object") return false;
  return Boolean(p.extend_code || p.service_partner);
}

function isAbandoned(order: any) {
  return order?.is_abandoned_order === true || order?.is_webcake_abandoned_cart === true;
}

// Address is complete only when province / city / barangay IDs all resolve.
function addressComplete(order: any) {
  const a = order?.shipping_address || {};
  return Boolean(a.province_id && a.district_id && a.commune_id);
}

function missingAddressParts(order: any) {
  const a = order?.shipping_address || {};
  const missing: string[] = [];
  if (!a.province_id) missing.push("province");
  if (!a.district_id) missing.push("city");
  if (!a.commune_id) missing.push("barangay");
  return missing;
}

function duplicateReasons(order: any) {
  const reasons: string[] = [];
  if (order?.duplicated_ip) reasons.push("Duplicate IP");
  if (order?.duplicated_phone) reasons.push("Duplicate phone");
  return reasons;
}

async function pancakeJson(url: string, init?: RequestInit) {
  const response = await fetch(url, { cache: "no-store", ...init });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body?.error) {
    throw new Error(body?.error?.message || body?.message || `Pancake returned ${response.status}.`);
  }
  return body;
}

// Book one order to Bigate J&T for courier pick-up. Pancake uses the
// is_drop_off flag as a mode switch, so false selects pick-up. The courier
// books against the address already stored on the order.
async function pushToJT(apiKey: string, shopId: string, order: any) {
  const id = order.id || order.order_id;
  const form = new URLSearchParams();
  form.set("orders[0][id]", String(id));
  form.set("orders[0][status]", String(Number(order.status) || 0));
  form.set("orders[0][is_send_to_bigate_jnt_phi]", "true");
  form.set("orders[0][is_drop_off_jnt_phi]", "false");
  form.set("orders[0][insurance_services_jnt_phi]", "true");
  form.set("orders[0][order_max_weight]", "0");

  const url = `${PANCAKE_API}/shops/${encodeURIComponent(shopId)}/orders/update_multiple_orders?api_key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
    cache: "no-store",
  });
  const resBody = await res.json().catch(() => ({}));
  if (!res.ok || resBody?.error) {
    throw new Error(resBody?.error?.message || resBody?.message || `Pancake returned ${res.status}.`);
  }
  return resBody;
}

// J&T can take a few seconds to generate the tracking number.
async function fetchTracking(apiKey: string, shopId: string, id: string) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await sleep(2000);
    try {
      const body = await pancakeJson(
        `${PANCAKE_API}/shops/${encodeURIComponent(shopId)}/orders/${encodeURIComponent(id)}?api_key=${encodeURIComponent(apiKey)}`,
      );
      const tracking = String(body?.data?.partner?.extend_code || "").trim();
      if (tracking) return tracking;
    } catch {
      // keep retrying
    }
  }
  return "";
}

// Report the result of a real run to Ken's Telegram. Never throws.
async function sendTelegram(text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chat = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chat) return;
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: chat, text, parse_mode: "Markdown" }),
    });
  } catch {
    // reporting is best-effort; never fail the run over it
  }
}

async function fetchCandidateOrders(apiKey: string, shopId: string) {
  const raw: any[] = [];
  for (let page = 1; page <= 5; page += 1) {
    const params = new URLSearchParams({
      api_key: apiKey,
      page_number: String(page),
      page_size: "100",
      include_removed: "0",
    });
    const body = await pancakeJson(`${PANCAKE_API}/shops/${encodeURIComponent(shopId)}/orders?${params}`);
    const batch = array(body.data);
    raw.push(...batch);
    if (batch.length < 100) break;
  }
  return raw;
}

type Bucket = {
  id: string;
  customer: string;
  phone: string;
  value: number;
  status: string;
  reasons: string[];
};

function summarize(order: any, reasons: string[] = []): Bucket {
  return {
    id: String(order.id || order.order_id || ""),
    customer: String(order.bill_full_name || order.full_name || order.customer?.name || "Customer"),
    phone: String(order.bill_phone_number || order.phone_number || ""),
    value: orderValue(order),
    status: String(order.status_name || order.status || "unknown").toLowerCase(),
    reasons,
  };
}

// Core logic shared by the manual button (POST) and the scheduled run (GET).
async function runUpload(
  apiKey: string,
  shopId: string,
  opts: { dryRun: boolean; onlyOrderIds: string[] | null; trigger?: string },
) {
  const { dryRun, onlyOrderIds, trigger = "manual" } = opts;
  const raw = await fetchCandidateOrders(apiKey, shopId);

  // Checkpoint 0 + 1: shippable status, not yet pushed, tags ignored.
  const candidates = raw.filter(
    (o) => SHIPPABLE_STATUSES.has(Number(o.status)) && !isPushed(o),
  );

  // Checkpoint 2: classify.
  const abandoned: Bucket[] = [];
  const flagged: Bucket[] = [];
  const incomplete: Bucket[] = [];
  const clean: Bucket[] = [];
  const cleanRaw: any[] = [];

  for (const order of candidates) {
    if (isAbandoned(order)) {
      abandoned.push(summarize(order, ["Abandoned order"]));
      continue;
    }
    const dupes = duplicateReasons(order);
    if (dupes.length) {
      flagged.push(summarize(order, dupes));
      continue;
    }
    if (!addressComplete(order)) {
      incomplete.push(summarize(order, [`Incomplete address: ${missingAddressParts(order).join(", ")}`]));
      continue;
    }
    clean.push(summarize(order));
    cleanRaw.push(order);
  }

  // Checkpoint 3: push clean orders to Bigate J&T (only on a real run).
  const pushed: Array<Bucket & { tracking: string }> = [];
  const failed: Array<Bucket & { error: string }> = [];

  if (!dryRun) {
    const toShip = onlyOrderIds
      ? cleanRaw.filter((o) => onlyOrderIds.includes(String(o.id || o.order_id)))
      : cleanRaw;
    for (const order of toShip) {
      const base = summarize(order);
      try {
        await pushToJT(apiKey, shopId, order);
        const tracking = await fetchTracking(apiKey, shopId, base.id);
        pushed.push({ ...base, tracking });
      } catch (error) {
        failed.push({ ...base, error: error instanceof Error ? error.message : "Push failed." });
      }
    }
  }

  // Report every real run to Telegram so the autopilot is never silent.
  if (!dryRun) {
    const when = new Date().toLocaleString("en-PH", { timeZone: "Asia/Manila" });
    const lines = [
      `*Courier Upload — ${when}*`,
      ``,
      `Shipped to J&T: ${pushed.length}`,
      `Failed: ${failed.length}`,
      `Flagged (held): ${flagged.length}`,
      `Abandoned (not shipped): ${abandoned.length}`,
      `Incomplete address (held): ${incomplete.length}`,
    ];
    if (pushed.length) {
      lines.push(``, `*Shipped:*`);
      for (const o of pushed) lines.push(`- #${o.id} ${o.customer} ${o.tracking || "(tracking pending)"}`);
    }
    if (failed.length) {
      lines.push(``, `*Failed:*`);
      for (const o of failed) lines.push(`- #${o.id} ${o.customer}: ${o.error}`);
    }
    if (abandoned.length) {
      lines.push(``, `*Abandoned (Mel is recovering, left untouched):*`);
      for (const o of abandoned) lines.push(`- #${o.id} ${o.customer}`);
    }
    await sendTelegram(lines.join("\n"));

    // Permanent log row for Jan Uploader AI (Vercel Blob).
    await appendJanRun({
      at: new Date().toISOString(),
      timestamp: when,
      trigger,
      candidates: candidates.length,
      shipped: pushed.length,
      failed: failed.length,
      flagged: flagged.length,
      abandoned: abandoned.length,
      incomplete: incomplete.length,
      tracking: pushed.map((o) => `#${o.id} ${o.tracking || "pending"}`).join(" | "),
      failures: failed.map((o) => `#${o.id} ${o.error}`).join(" | "),
    });
  }

  // Abandoned orders are flagged and reported, not auto-deleted. They are
  // removed manually in Pancake (cancel -> remove).

  return {
    generatedAt: new Date().toISOString(),
    dryRun,
    shopId,
    jtPartnerId: JT_PARTNER_ID,
    deleteImplemented: false,
    totals: {
      candidates: candidates.length,
      clean: clean.length,
      flaggedDuplicate: flagged.length,
      abandoned: abandoned.length,
      incompleteAddress: incomplete.length,
      pushed: pushed.length,
      failed: failed.length,
    },
    clean,
    pushed,
    failed,
    flagged,
    abandoned,
    incomplete,
  };
}

function pancakeConfig() {
  return {
    apiKey: process.env.VISION_X_SAHA_PANCAKE_API_KEY,
    shopId: process.env.VISION_X_SAHA_PANCAKE_SHOP_ID,
  };
}

// The manual button carries the dashboard login cookie.
function isDashboardAuthed(req: NextRequest) {
  const tokens = [
    process.env.VISION_X_SAHA_DASHBOARD_ACCESS_TOKEN,
    process.env.VISION_X_SAHA_RUSTAN_ACCESS_TOKEN,
  ].filter((t): t is string => Boolean(t));
  const cookie = req.cookies.get("vision_x_saha_access")?.value || "";
  return tokens.length > 0 && tokens.includes(cookie);
}

/**
 * Manual run from the dashboard button.
 * Body: { dryRun?: boolean (default true), orderIds?: string[] }
 */
export async function POST(req: NextRequest) {
  if (!isDashboardAuthed(req)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const { apiKey, shopId } = pancakeConfig();
  if (!apiKey || !shopId) {
    return NextResponse.json({ error: "Pancake POS access is not configured." }, { status: 503 });
  }
  const body = await req.json().catch(() => ({}));
  const dryRun = body?.dryRun !== false; // default true
  const onlyOrderIds: string[] | null = Array.isArray(body?.orderIds)
    ? body.orderIds.map((x: unknown) => String(x))
    : null;
  try {
    const result = await runUpload(apiKey, shopId, { dryRun, onlyOrderIds, trigger: "manual" });
    return NextResponse.json(result, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Pancake POS could not be reached." },
      { status: 502 },
    );
  }
}

/**
 * Scheduled run (Vercel Cron, every other day at 07:00 PHT = 23:00 UTC odd days).
 * Real run: pushes clean orders to J&T. Protected by CRON_SECRET, which Vercel
 * sends as `Authorization: Bearer <CRON_SECRET>` on cron requests.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization") || "";
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const { apiKey, shopId } = pancakeConfig();
  if (!apiKey || !shopId) {
    return NextResponse.json({ error: "Pancake POS access is not configured." }, { status: 503 });
  }
  try {
    const result = await runUpload(apiKey, shopId, { dryRun: false, onlyOrderIds: null, trigger: "cron" });
    return NextResponse.json(result, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Pancake POS could not be reached." },
      { status: 502 },
    );
  }
}

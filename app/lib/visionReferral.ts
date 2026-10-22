import "server-only";
import { get, list, put } from "@vercel/blob";
import { normalizePhilippineMobile } from "./visionInfotxt";

// Referral program. Referrer gets a fixed credit off their NEXT order; the new
// referred customer gets a percentage off their first order (applied at order time).
export const REFERRER_CREDIT_PHP = 100;
export const REFEREE_DISCOUNT_PERCENT = 10;

const CREDIT_PREFIX = "vision-x-saha/referrals/credits/";
const EVENT_PREFIX = "vision-x-saha/referrals/events/";

type ReferralCredit = {
  phone: string;
  pendingPhp: number;
  earnedPhp: number;
  redeemedPhp: number;
  updatedAt: string;
};

export type ReferralEvent = {
  id: string;
  type: "referred" | "redeemed";
  referrerPhoneMasked: string;
  refereePhoneMasked: string;
  amountPhp: number;
  createdAt: string;
};

function creditPath(phone: string) {
  return `${CREDIT_PREFIX}${phone.replace(/\D/g, "")}.json`;
}

function mask(phone: string) {
  return phone ? phone.replace(/.(?=.{4})/g, "*") : "";
}

async function loadCredit(phone: string): Promise<ReferralCredit | null> {
  try {
    const r = await get(creditPath(phone), { access: "private", useCache: false });
    if (!r || r.statusCode !== 200 || !r.stream) return null;
    return JSON.parse(await new Response(r.stream).text()) as ReferralCredit;
  } catch {
    return null;
  }
}

async function saveCredit(credit: ReferralCredit) {
  try {
    await put(creditPath(credit.phone), JSON.stringify(credit), {
      access: "private", contentType: "application/json", addRandomSuffix: false, allowOverwrite: true, cacheControlMaxAge: 0
    });
  } catch {
    // best-effort
  }
}

async function recordEvent(event: Omit<ReferralEvent, "id" | "createdAt">) {
  try {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const record: ReferralEvent = { ...event, id, createdAt: new Date().toISOString() };
    await put(`${EVENT_PREFIX}${id}.json`, JSON.stringify(record), {
      access: "private", contentType: "application/json", addRandomSuffix: false, allowOverwrite: true, cacheControlMaxAge: 0
    });
  } catch {
    // best-effort
  }
}

// A new customer named a referrer. Give the referrer a pending credit. Returns
// true when a valid, different referrer phone was recorded. Self-referral is ignored.
export async function recordReferral(referrerPhoneRaw: string, refereePhoneRaw: string): Promise<boolean> {
  const referrer = normalizePhilippineMobile(referrerPhoneRaw);
  const referee = normalizePhilippineMobile(refereePhoneRaw);
  if (!referrer || !referee || referrer === referee) return false;
  const existing = await loadCredit(referrer) || { phone: referrer, pendingPhp: 0, earnedPhp: 0, redeemedPhp: 0, updatedAt: "" };
  existing.pendingPhp += REFERRER_CREDIT_PHP;
  existing.earnedPhp += REFERRER_CREDIT_PHP;
  existing.updatedAt = new Date().toISOString();
  await saveCredit(existing);
  await recordEvent({ type: "referred", referrerPhoneMasked: mask(referrer), refereePhoneMasked: mask(referee), amountPhp: REFERRER_CREDIT_PHP });
  return true;
}

// How much pending referral credit this phone has (peso), without consuming it.
export async function peekReferrerCredit(phoneRaw: string): Promise<number> {
  const phone = normalizePhilippineMobile(phoneRaw);
  if (!phone) return 0;
  const credit = await loadCredit(phone);
  return Math.max(0, Number(credit?.pendingPhp || 0));
}

// Consume up to `maxPhp` of this phone's pending credit when they place an order.
// Returns the peso amount actually applied (and decrements the stored balance).
export async function consumeReferrerCredit(phoneRaw: string, maxPhp: number): Promise<number> {
  const phone = normalizePhilippineMobile(phoneRaw);
  if (!phone || maxPhp <= 0) return 0;
  const credit = await loadCredit(phone);
  if (!credit || credit.pendingPhp <= 0) return 0;
  const applied = Math.min(credit.pendingPhp, Math.floor(maxPhp));
  if (applied <= 0) return 0;
  credit.pendingPhp -= applied;
  credit.redeemedPhp += applied;
  credit.updatedAt = new Date().toISOString();
  await saveCredit(credit);
  await recordEvent({ type: "redeemed", referrerPhoneMasked: mask(phone), refereePhoneMasked: "", amountPhp: applied });
  return applied;
}

export async function loadReferralEvents(limit = 200): Promise<ReferralEvent[]> {
  try {
    const result = await list({ prefix: EVENT_PREFIX, limit: Math.min(1000, Math.max(1, limit)) });
    const rows = await Promise.all(result.blobs.map(async b => {
      try {
        const g = await get(b.pathname, { access: "private", useCache: false });
        if (!g || g.statusCode !== 200 || !g.stream) return null;
        return JSON.parse(await new Response(g.stream).text()) as ReferralEvent;
      } catch { return null; }
    }));
    return rows.filter((r): r is ReferralEvent => Boolean(r)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } catch {
    return [];
  }
}

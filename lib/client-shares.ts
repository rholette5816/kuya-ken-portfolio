import { randomBytes } from "node:crypto";
import { get, put } from "@vercel/blob";
import { AdvertisingClientConfig } from "@/lib/advertising-client-config";

export type SharePanel =
  | "structure" | "inputs" | "budget" | "spending"
  | "analysis" | "creatives" | "videoranking" | "changes";

export const SHAREABLE_PANELS: Record<SharePanel, string> = {
  structure: "Live structure",
  inputs: "Business results",
  budget: "Budget planning",
  spending: "Spending report",
  analysis: "Analysis summary",
  creatives: "Creative report",
  videoranking: "Video ads ranking",
  changes: "Change log"
};

// Deliberately excluded: billing, agreement, onboarding hold contractual and
// personal data; approvals accepts writes. None may be exposed to an
// unauthenticated share recipient.
export function isSharePanel(value: string): value is SharePanel {
  return Object.prototype.hasOwnProperty.call(SHAREABLE_PANELS, value);
}

export type ShareRecord = {
  token: string;
  client: string;
  panel: SharePanel;
  brand: string | null;
  from: string | null;
  to: string | null;
  label: string;
  createdAt: string;
  expiresAt: string | null;
  revokedAt: string | null;
};

const INDEX_KEY = "shares/index.json";

function key(config: AdvertisingClientConfig, token: string) {
  return `${config.storagePrefix}/shares/${token}.json`;
}

function indexKey(config: AdvertisingClientConfig) {
  return `${config.storagePrefix}/${INDEX_KEY}`;
}

async function readJson(path: string) {
  const result = await get(path, { access: "private", useCache: false });
  if (!result || result.statusCode !== 200 || !result.stream) return null;
  return JSON.parse(await new Response(result.stream).text());
}

async function writeJson(path: string, value: unknown) {
  await put(path, JSON.stringify(value), {
    access: "private", contentType: "application/json",
    addRandomSuffix: false, allowOverwrite: true, cacheControlMaxAge: 0
  });
}

export function isValidShareToken(token: string) {
  return /^[a-f0-9]{40}$/.test(token);
}

function isoDate(value: unknown) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

export async function listShares(config: AdvertisingClientConfig): Promise<ShareRecord[]> {
  const index = await readJson(indexKey(config));
  return Array.isArray(index) ? index : [];
}

export async function createShare(
  config: AdvertisingClientConfig,
  input: { panel: string; brand?: string | null; from?: string | null; to?: string | null; label?: string; expiresInDays?: number | null }
): Promise<ShareRecord> {
  if (!isSharePanel(input.panel)) throw new Error("That panel cannot be shared.");
  const brands = config.brands.map(brand => brand.name);
  const brand = input.brand && brands.includes(input.brand) ? input.brand : null;
  const from = isoDate(input.from);
  const to = isoDate(input.to);
  if (from && to && from > to) throw new Error("The start date must be on or before the end date.");

  const days = Number(input.expiresInDays);
  const record: ShareRecord = {
    token: randomBytes(20).toString("hex"),
    client: config.slug,
    panel: input.panel,
    brand,
    from,
    to,
    label: String(input.label || SHAREABLE_PANELS[input.panel]).slice(0, 80),
    createdAt: new Date().toISOString(),
    expiresAt: Number.isFinite(days) && days > 0 ? new Date(Date.now() + days * 86400000).toISOString() : null,
    revokedAt: null
  };

  await writeJson(key(config, record.token), record);
  const index = await listShares(config);
  await writeJson(indexKey(config), [record, ...index].slice(0, 500));
  return record;
}

export async function revokeShare(config: AdvertisingClientConfig, token: string) {
  if (!isValidShareToken(token)) return false;
  const record = (await readJson(key(config, token))) as ShareRecord | null;
  if (!record) return false;
  const revoked = { ...record, revokedAt: new Date().toISOString() };
  await writeJson(key(config, token), revoked);
  const index = await listShares(config);
  await writeJson(indexKey(config), index.map(item => (item.token === token ? revoked : item)));
  return true;
}

export function shareIsUsable(record: ShareRecord | null): record is ShareRecord {
  if (!record || record.revokedAt) return false;
  if (record.expiresAt && new Date(record.expiresAt).getTime() < Date.now()) return false;
  return true;
}

/** Resolves a share token to its record, or null when missing, revoked, or expired. */
export async function resolveShare(config: AdvertisingClientConfig, token: string): Promise<ShareRecord | null> {
  if (!isValidShareToken(token)) return null;
  const record = (await readJson(key(config, token))) as ShareRecord | null;
  return shareIsUsable(record) ? record : null;
}

/**
 * Share tokens are presented to the data APIs as `share:<token>`. Panels map to
 * the API surface each is allowed to reach, so a link shared for one panel
 * cannot be replayed against another endpoint.
 */
export const PANEL_ENDPOINTS: Record<SharePanel, string[]> = {
  structure: ["client-ad-operations"],
  inputs: ["client-ad-operations", "client-business-results"],
  budget: ["client-ad-operations", "client-business-results"],
  spending: ["client-ad-operations"],
  analysis: ["client-ad-operations", "client-analysis-summary", "client-business-results"],
  creatives: ["client-ad-operations"],
  videoranking: ["client-video-ranking"],
  changes: ["client-ad-operations"]
};

export function shareAllowsEndpoint(record: ShareRecord, endpoint: string) {
  return PANEL_ENDPOINTS[record.panel].includes(endpoint);
}

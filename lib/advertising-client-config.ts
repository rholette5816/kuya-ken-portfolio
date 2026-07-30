import { createHmac, timingSafeEqual } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

export type AdvertisingBrand = {
  name: string;
  pageId?: string;
  profile: string;
  campaignKeywords: string[];
};

export type AdvertisingClientConfig = {
  schemaVersion: 1;
  slug: string;
  organizationName: string;
  dashboardTitle: string;
  portfolioLabel: string;
  currency: string;
  timezone: string;
  metaAccountId: string;
  metaTokenEnv: string;
  storagePrefix: string;
  defaultTargetSpendPercent: number;
  brands: AdvertisingBrand[];
  modules: {
    historicalPlanning: boolean;
    agreement: boolean;
    billing: boolean;
    onboarding: boolean;
    creativeApprovals: boolean;
  };
};

const CONFIG_DIR = path.join(process.cwd(), "config", "advertising-clients");

function validate(config: AdvertisingClientConfig) {
  if (config.schemaVersion !== 1) throw new Error("Unsupported advertising client schema.");
  if (!/^[a-z0-9-]+$/.test(config.slug)) throw new Error("Client slug is invalid.");
  if (!config.organizationName || !config.storagePrefix || !Array.isArray(config.brands) || !config.brands.length) throw new Error("Client configuration is incomplete.");
  const names = new Set(config.brands.map(brand => brand.name));
  if (names.size !== config.brands.length) throw new Error("Business names must be unique.");
  return config;
}

export async function getAdvertisingClientConfig(slug: string) {
  if (!/^[a-z0-9-]+$/.test(slug)) return null;
  try {
    const source = await readFile(path.join(CONFIG_DIR, `${slug}.json`), "utf8");
    return validate(JSON.parse(source) as AdvertisingClientConfig);
  } catch {
    return null;
  }
}

export async function listAdvertisingClientConfigs() {
  const files = await readdir(CONFIG_DIR).catch(() => []);
  const configs = await Promise.all(files.filter(file => file.endsWith(".json") && file !== "schema.json").map(file => getAdvertisingClientConfig(file.slice(0, -5))));
  return configs.filter((config): config is AdvertisingClientConfig => Boolean(config));
}

function sessionSecret() {
  return process.env.CLIENT_DASHBOARD_SECRET || process.env.RMINDS_CLIENT_SIGN_TOKEN || "";
}

export function createClientSession(slug: string) {
  const secret = sessionSecret();
  if (!secret) throw new Error("CLIENT_DASHBOARD_SECRET is not configured.");
  const expires = Math.floor(Date.now() / 1000) + 7 * 86400;
  const value = `${slug}.${expires}`;
  const signature = createHmac("sha256", secret).update(value).digest("hex");
  return `${value}.${signature}`;
}

export function validClientSession(token: string, slug: string) {
  const secret = sessionSecret();
  const match = token.match(/^([a-z0-9-]+)\.(\d{10})\.([a-f0-9]{64})$/);
  if (!secret || !match || match[1] !== slug || Number(match[2]) < Math.floor(Date.now() / 1000)) return false;
  const expected = createHmac("sha256", secret).update(`${match[1]}.${match[2]}`).digest("hex");
  const supplied = match[3];
  return timingSafeEqual(Buffer.from(expected), Buffer.from(supplied));
}

export function publicClientConfig(config: AdvertisingClientConfig) {
  return {
    slug: config.slug,
    organizationName: config.organizationName,
    dashboardTitle: config.dashboardTitle,
    portfolioLabel: config.portfolioLabel,
    currency: config.currency,
    timezone: config.timezone,
    defaultTargetSpendPercent: config.defaultTargetSpendPercent,
    brands: config.brands.map(brand => ({ name: brand.name, profile: brand.profile })),
    modules: config.modules
  };
}

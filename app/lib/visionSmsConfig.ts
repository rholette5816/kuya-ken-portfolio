import { get, put } from "@vercel/blob";

const PATHNAME = "vision-x-saha/sms-config.json";

export type SmsConfig = {
  userId: string;
  apiKey: string;
  simSlot: string;
  simMobile: string;
  expiresAt: string;
  updatedAt: string;
  updatedBy: string;
};

export type SmsConfigView = {
  configured: boolean;
  source: "saved" | "env" | "none";
  maskedUserId: string;
  maskedKey: string;
  simSlot: string;
  maskedSimMobile: string;
  expiresAt: string | null;
  updatedAt: string | null;
  updatedBy: string | null;
};

export function maskKey(key: string): string {
  const trimmed = (key || "").trim();
  if (!trimmed) return "";
  if (trimmed.length <= 4) return "****";
  return `${"*".repeat(Math.min(8, trimmed.length - 4))}${trimmed.slice(-4)}`;
}

function maskIdentifier(value: string): string {
  const trimmed = (value || "").trim();
  if (!trimmed) return "";
  if (trimmed.length <= 2) return "*".repeat(trimmed.length);
  return `${"*".repeat(trimmed.length - 2)}${trimmed.slice(-2)}`;
}

function maskPhone(value: string): string {
  const digits = (value || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length <= 4) return "*".repeat(digits.length);
  return `${digits.slice(0, 4)}${"*".repeat(Math.max(3, digits.length - 7))}${digits.slice(-3)}`;
}

async function loadSaved(): Promise<SmsConfig | null> {
  try {
    const result = await get(PATHNAME, { access: "private", useCache: false });
    if (!result || result.statusCode !== 200 || !result.stream) return null;
    const parsed = JSON.parse(await new Response(result.stream).text()) as Partial<SmsConfig>;
    if (!parsed.apiKey) return null;
    return {
      userId: String(parsed.userId || ""),
      apiKey: String(parsed.apiKey),
      simSlot: String(parsed.simSlot || ""),
      simMobile: String(parsed.simMobile || ""),
      expiresAt: String(parsed.expiresAt || ""),
      updatedAt: String(parsed.updatedAt || ""),
      updatedBy: String(parsed.updatedBy || "")
    };
  } catch {
    return null;
  }
}

export async function loadSmsConfig(): Promise<SmsConfig | null> {
  const saved = await loadSaved();
  if (saved?.userId) return saved;
  const envKey = process.env.INFOTXT_API_KEY?.trim();
  const envUserId = process.env.INFOTXT_USER_ID?.trim();
  if (!envKey || !envUserId) return null;
  return {
    userId: envUserId,
    apiKey: envKey,
    simSlot: process.env.INFOTXT_SIM_SLOT?.trim() || "",
    simMobile: process.env.INFOTXT_SIM_MOBILE?.trim() || "",
    expiresAt: process.env.INFOTXT_EXPIRES_AT?.trim() || "",
    updatedAt: "",
    updatedBy: "environment"
  };
}

export async function loadSmsConfigView(): Promise<SmsConfigView> {
  const saved = await loadSaved();
  if (saved) {
    return {
      configured: Boolean(saved.userId && saved.apiKey),
      source: "saved",
      maskedUserId: maskIdentifier(saved.userId),
      maskedKey: maskKey(saved.apiKey),
      simSlot: saved.simSlot,
      maskedSimMobile: maskPhone(saved.simMobile),
      expiresAt: saved.expiresAt || null,
      updatedAt: saved.updatedAt || null,
      updatedBy: saved.updatedBy || null
    };
  }
  const envKey = process.env.INFOTXT_API_KEY?.trim();
  const envUserId = process.env.INFOTXT_USER_ID?.trim();
  if (envKey && envUserId) {
    return {
      configured: true,
      source: "env",
      maskedUserId: maskIdentifier(envUserId),
      maskedKey: maskKey(envKey),
      simSlot: process.env.INFOTXT_SIM_SLOT?.trim() || "",
      maskedSimMobile: maskPhone(process.env.INFOTXT_SIM_MOBILE?.trim() || ""),
      expiresAt: process.env.INFOTXT_EXPIRES_AT?.trim() || null,
      updatedAt: null,
      updatedBy: "environment"
    };
  }
  return {
    configured: false,
    source: "none",
    maskedUserId: "",
    maskedKey: "",
    simSlot: process.env.INFOTXT_SIM_SLOT?.trim() || "",
    maskedSimMobile: "",
    expiresAt: process.env.INFOTXT_EXPIRES_AT?.trim() || null,
    updatedAt: null,
    updatedBy: null
  };
}

export async function saveSmsConfig(input: Pick<SmsConfig, "userId" | "apiKey" | "simSlot" | "simMobile" | "expiresAt">, updatedBy: string): Promise<SmsConfig> {
  const record: SmsConfig = {
    userId: input.userId.trim(),
    apiKey: input.apiKey.trim(),
    simSlot: input.simSlot.trim(),
    simMobile: input.simMobile.trim(),
    expiresAt: input.expiresAt.trim(),
    updatedAt: new Date().toISOString(),
    updatedBy: updatedBy || "vision-x-saha"
  };
  await put(PATHNAME, JSON.stringify(record), {
    access: "private",
    contentType: "application/json",
    addRandomSuffix: false,
    allowOverwrite: true,
    cacheControlMaxAge: 0
  });
  return record;
}

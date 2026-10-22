import "server-only";

import { createHash } from "node:crypto";
import { get, list, put } from "@vercel/blob";
import type { CustomerMarketingFacts, MarketingDecision, MarketingSegment } from "./visionMarketingTypes";

const CONFIG_PATH = "vision-x-saha/marketing/config.json";
const ENROLLMENT_PREFIX = "vision-x-saha/marketing/enrollments/";
const EVENT_PREFIX = "vision-x-saha/marketing/events/";

export type MarketingSystemMode = "off" | "dry_run" | "live";

export type MarketingSequenceStep = {
  id: string;
  delayDays: number;
  label: string;
  template: string;
};

export type MarketingSequence = {
  id: string;
  name: string;
  segment: MarketingSegment;
  enabled: boolean;
  discountPercent: number;
  cooldownDays: number;
  steps: MarketingSequenceStep[];
};

export type MarketingConfig = {
  version: number;
  mode: MarketingSystemMode;
  activationLocked: boolean;
  enrollmentEnabled: boolean;
  smsSendingEnabled: boolean;
  pancakeWritesEnabled: boolean;
  bulkAlertsEnabled: boolean;
  dailyEnrollmentLimit: number;
  bulkOrderThreshold: number;
  bulkAlertNumber: string;
  quietStart: string;
  quietEnd: string;
  smsUnitCostPhp: number;
  sequences: MarketingSequence[];
  updatedAt: string;
  updatedBy: string;
};

export type MarketingEnrollmentStatus = "preview" | "active" | "waiting" | "replied" | "ordered" | "bulk_handoff" | "completed" | "paused" | "suppressed";

export type MarketingEnrollment = {
  id: string;
  customerId: string;
  customerName: string;
  phone: string;
  segment: MarketingSegment;
  sequenceId: string;
  stepIndex: number;
  status: MarketingEnrollmentStatus;
  campaignId: string;
  nextActionAt: string | null;
  lastSentAt: string | null;
  lastReplyAt: string | null;
  cooldownUntil: string | null;
  createdAt: string;
  updatedAt: string;
  closedReason: string;
};

export type MarketingEvent = {
  id: string;
  customerId: string;
  phoneMasked: string;
  enrollmentId: string;
  sequenceId: string;
  stepId: string;
  type: "previewed" | "enrolled" | "sent" | "failed" | "replied" | "ordered" | "bulk_handoff" | "paused" | "completed";
  detail: string;
  amount: number;
  createdAt: string;
};

const defaultSequences: MarketingSequence[] = [
  {
    id: "vip_repeat",
    name: "VIP repeat order",
    segment: "vip",
    enabled: true,
    discountPercent: 10,
    cooldownDays: 30,
    steps: [
      { id: "vip_offer", delayDays: 0, label: "Personal reorder", template: "Hi {first_name}! Si Mel ito ng Lakatan Saha. VIP customer ka, may 10% offer ako para sa iyo. Reply YES para umorder. STOP kung ayaw na." },
      { id: "vip_last", delayDays: 4, label: "Final follow-up", template: "Hi {first_name}, si Mel ulit. Nandito pa ang 10% VIP offer mo. Reply YES anytime, walang pressure." }
    ]
  },
  {
    id: "repeat_reorder",
    name: "Repeat customer reorder",
    segment: "repeat",
    enabled: true,
    discountPercent: 10,
    cooldownDays: 30,
    steps: [
      { id: "repeat_offer", delayDays: 0, label: "Reorder invitation", template: "Hi {first_name}! Si Mel ito ng Lakatan Saha. Salamat sa paulit-ulit mong order! May 10% discount ka. Reply YES. STOP kung ayaw na." },
      { id: "repeat_last", delayDays: 4, label: "Final follow-up", template: "Hi {first_name}, si Mel ulit. Nandito pa ang 10% kung gusto mong mag-order ulit. Reply YES anytime, ha?" }
    ]
  },
  {
    id: "plant_lifecycle",
    name: "New grower plant lifecycle",
    segment: "recent_delivered",
    enabled: true,
    discountPercent: 10,
    cooldownDays: 30,
    steps: [
      { id: "lc_plant", delayDays: 0, label: "Planting care tip", template: "Hi {first_name}! Si Mel ito ng Lakatan Saha. Natanim mo na ba? Tip: itanim ang saha na pataas ang usbong, sa matabang lupa na may patuluan ng tubig, full sun. Diligan pero wag basa. Reply lang kung may tanong. STOP kung ayaw ng updates." },
      { id: "lc_reassure", delayDays: 12, label: "Growth reassurance", template: "Hi {first_name}, kumusta ang tanim mo? Normal lang kahit maliit pa, tutubo at dadami ang Lakatan pag inalagaan. Karamihan ng grower dinadagdagan pa ang taniman. May tanong ka ba sa pag-aalaga?" },
      { id: "lc_scale_1mo", delayDays: 25, label: "1-month scale offer", template: "Hi {first_name}! Mga 1 buwan na ang Lakatan mo. Gusto mo bang paramihin ang taniman para mas malaki ang ani balang araw? May 10% off ako sa susunod mong bulbs. Reply YES at ihahanda ko." },
      { id: "lc_progress", delayDays: 55, label: "Progress reorder", template: "Hi {first_name}, lumalago na ba ang Lakatan mo? Maraming grower ang nagdadagdag ngayon habang maganda ang panahon. Gusto mo ring magdagdag ng tanim? May 10% discount ka pa. Reply YES." },
      { id: "lc_midgrowth", delayDays: 110, label: "Mid-growth reorder", template: "Hi {first_name}! Kumusta ang tanim? Ilang buwan na lang mamumunga ang Lakatan mo. Para dumami ang ani, pwede ka pang magdagdag ng bulbs ngayon. May 10% balik-customer discount ka. Reply YES." },
      { id: "lc_harvest_referral", delayDays: 210, label: "Pre-harvest + referral", template: "Hi {first_name}, malapit na siguro ang unang ani ng Lakatan mo! Gusto mo pang magdagdag ng bulbs? At kung may kakilala kang gustong magtanim, i-refer mo, parehas kayong may discount. Reply YES." }
    ]
  },
  {
    id: "dormant_winback",
    name: "Dormant customer win-back",
    segment: "dormant",
    enabled: true,
    discountPercent: 10,
    cooldownDays: 60,
    steps: [
      { id: "dormant_check", delayDays: 0, label: "Reactivation", template: "Hi {first_name}! Si Mel ito ng Lakatan Saha. Kumusta na ang tanim mong Lakatan? Sana malago na. Nag-check in lang ako. STOP kung ayaw na." },
      { id: "dormant_offer", delayDays: 4, label: "Win-back offer", template: "Hi {first_name}, si Mel ulit. Gusto mo bang dagdagan ang tanim? May 10% balik-customer discount ka. Reply YES." },
      { id: "dormant_last", delayDays: 7, label: "Final follow-up", template: "Hi {first_name}, last follow-up ko na. Nandito pa ang 10% kung gusto mong mag-order ulit. Reply YES anytime." }
    ]
  },
  {
    id: "failed_winback",
    name: "Failed or cancelled win-back",
    segment: "failed_winback",
    enabled: true,
    discountPercent: 10,
    cooldownDays: 60,
    steps: [
      { id: "failed_restart", delayDays: 0, label: "Restart conversation", template: "Hi {first_name}, si Mel ito ng Lakatan Saha. Pasensya kung di natuloy ang order mo. Interesado ka pa ba? Reply YES. STOP kung ayaw na." }
    ]
  },
  {
    id: "inquiry_followup",
    name: "Previous inquiry follow-up",
    segment: "inquiry",
    enabled: true,
    discountPercent: 10,
    cooldownDays: 60,
    steps: [
      { id: "inquiry_restart", delayDays: 0, label: "Interest follow-up", template: "Hi {first_name}! Si Mel ito ng Lakatan Saha. Nagtanong ka dati sa Lakatan. Interesado ka pa? Reply YES para sa packages. STOP kung ayaw na." }
    ]
  }
];

export function marketingActivationUnlocked() {
  return process.env.VISION_X_SAHA_MARKETING_UNLOCKED === "true";
}

// Bump when the default sequence copy changes so saved configs re-seed the new templates on load.
const CONFIG_COPY_VERSION = 3;

export function defaultMarketingConfig(): MarketingConfig {
  return {
    version: CONFIG_COPY_VERSION,
    mode: "off",
    activationLocked: !marketingActivationUnlocked(),
    enrollmentEnabled: false,
    smsSendingEnabled: false,
    pancakeWritesEnabled: false,
    bulkAlertsEnabled: false,
    dailyEnrollmentLimit: 60,
    bulkOrderThreshold: 20,
    bulkAlertNumber: "09618321310",
    quietStart: "18:00",
    quietEnd: "20:00",
    smsUnitCostPhp: 0.5,
    sequences: defaultSequences.map(sequence => ({ ...sequence, steps: sequence.steps.map(step => ({ ...step })) })),
    updatedAt: "",
    updatedBy: "system-default"
  };
}

function cleanTemplate(value: unknown, fallback: string) {
  const result = String(value || "").replace(/https?:\/\/\S+/gi, "").replace(/\s+/g, " ").trim().slice(0, 459);
  return result || fallback;
}

function sanitizeMarketingConfig(input: any, updatedBy: string): MarketingConfig {
  const base = defaultMarketingConfig();
  const unlocked = marketingActivationUnlocked();
  const suppliedSequences = Array.isArray(input?.sequences) ? input.sequences : [];
  const requestedMode: MarketingSystemMode = input?.mode === "live" ? "live" : input?.mode === "dry_run" ? "dry_run" : "off";
  const mode: MarketingSystemMode = unlocked ? requestedMode : "off";
  return {
    ...base,
    mode,
    activationLocked: !unlocked,
    enrollmentEnabled: unlocked && mode !== "off" && Boolean(input?.enrollmentEnabled),
    smsSendingEnabled: unlocked && mode === "live" && Boolean(input?.smsSendingEnabled),
    pancakeWritesEnabled: unlocked && Boolean(input?.pancakeWritesEnabled),
    bulkAlertsEnabled: unlocked && Boolean(input?.bulkAlertsEnabled),
    dailyEnrollmentLimit: Math.min(5000, Math.max(1, Number(input?.dailyEnrollmentLimit || base.dailyEnrollmentLimit))),
    bulkOrderThreshold: Math.min(1000, Math.max(20, Number(input?.bulkOrderThreshold || base.bulkOrderThreshold))),
    bulkAlertNumber: String(input?.bulkAlertNumber || base.bulkAlertNumber).replace(/[^\d+]/g, "").slice(0, 16) || base.bulkAlertNumber,
    quietStart: /^\d{2}:\d{2}$/.test(String(input?.quietStart)) ? String(input.quietStart) : base.quietStart,
    quietEnd: /^\d{2}:\d{2}$/.test(String(input?.quietEnd)) ? String(input.quietEnd) : base.quietEnd,
    smsUnitCostPhp: Math.min(50, Math.max(0, Number(input?.smsUnitCostPhp ?? base.smsUnitCostPhp) || 0)),
    sequences: base.sequences.map(sequence => {
      const supplied = suppliedSequences.find((candidate: any) => String(candidate?.id) === sequence.id) || {};
      const suppliedSteps = Array.isArray(supplied.steps) ? supplied.steps : [];
      return {
        ...sequence,
        enabled: typeof supplied.enabled === "boolean" ? supplied.enabled : sequence.enabled,
        steps: sequence.steps.map(step => {
          const candidate = suppliedSteps.find((item: any) => String(item?.id) === step.id) || {};
          return { ...step, template: cleanTemplate(candidate.template, step.template) };
        })
      };
    }),
    updatedAt: new Date().toISOString(),
    updatedBy: updatedBy || "vision-x-saha"
  };
}

export async function loadMarketingConfig(): Promise<MarketingConfig> {
  try {
    const item = await get(CONFIG_PATH, { access: "private", useCache: false });
    if (!item || item.statusCode !== 200 || !item.stream) return defaultMarketingConfig();
    const saved = JSON.parse(await new Response(item.stream).text());
    // Re-seed sequence copy from code defaults when the saved config predates the current template version.
    // Operational settings (mode, limits, quiet hours) are preserved; only the message copy is refreshed.
    const input = Number(saved?.version || 0) < CONFIG_COPY_VERSION ? { ...saved, sequences: [] } : saved;
    return { ...sanitizeMarketingConfig(input, String(saved.updatedBy || "saved")), updatedAt: String(saved.updatedAt || ""), updatedBy: String(saved.updatedBy || "saved") };
  } catch {
    return defaultMarketingConfig();
  }
}

export async function saveMarketingConfig(input: unknown, updatedBy: string) {
  const config = sanitizeMarketingConfig(input, updatedBy);
  await put(CONFIG_PATH, JSON.stringify(config), {
    access: "private",
    contentType: "application/json",
    addRandomSuffix: false,
    allowOverwrite: true,
    cacheControlMaxAge: 0
  });
  return config;
}

function enrollmentId(customerId: string, sequenceId: string) {
  return createHash("sha256").update(`${customerId}|${sequenceId}`).digest("hex");
}

function enrollmentPath(id: string) {
  return `${ENROLLMENT_PREFIX}${id}.json`;
}

async function readJson<T>(pathname: string): Promise<T | null> {
  try {
    const item = await get(pathname, { access: "private", useCache: false });
    if (!item || item.statusCode !== 200 || !item.stream) return null;
    return JSON.parse(await new Response(item.stream).text()) as T;
  } catch {
    return null;
  }
}

export async function saveMarketingEnrollment(input: Omit<MarketingEnrollment, "id" | "createdAt" | "updatedAt"> & { id?: string; createdAt?: string }) {
  const id = input.id || enrollmentId(input.customerId, input.sequenceId);
  const now = new Date().toISOString();
  const existing = await readJson<MarketingEnrollment>(enrollmentPath(id));
  const record: MarketingEnrollment = {
    ...input,
    id,
    createdAt: existing?.createdAt || input.createdAt || now,
    updatedAt: now
  };
  await put(enrollmentPath(id), JSON.stringify(record), {
    access: "private",
    contentType: "application/json",
    addRandomSuffix: false,
    allowOverwrite: true,
    cacheControlMaxAge: 0
  });
  return record;
}

export async function loadMarketingEnrollments(limit = 1000): Promise<MarketingEnrollment[]> {
  try {
    const result = await list({ prefix: ENROLLMENT_PREFIX, limit: Math.min(1000, Math.max(1, limit)) });
    const rows = await Promise.all(result.blobs.map(blob => readJson<MarketingEnrollment>(blob.pathname)));
    return rows.filter((row): row is MarketingEnrollment => Boolean(row)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  } catch {
    return [];
  }
}

export async function findActiveMarketingEnrollment(phone: string) {
  const digits = String(phone || "").replace(/\D/g, "").replace(/^63/, "0");
  const rows = await loadMarketingEnrollments();
  return rows.find(row => row.phone.replace(/\D/g, "").replace(/^63/, "0") === digits && ["active", "waiting", "replied", "preview"].includes(row.status)) || null;
}

export async function closeMarketingForPhone(phone: string, status: MarketingEnrollmentStatus, reason: string) {
  const digits = String(phone || "").replace(/\D/g, "").replace(/^63/, "0");
  const rows = await loadMarketingEnrollments();
  const matches = rows.filter(row => row.phone.replace(/\D/g, "").replace(/^63/, "0") === digits && ["active", "waiting", "preview", "replied"].includes(row.status));
  for (const row of matches) {
    await saveMarketingEnrollment({ ...row, status, closedReason: reason, nextActionAt: null, lastReplyAt: status === "replied" ? new Date().toISOString() : row.lastReplyAt });
  }
  return matches.length;
}

export async function recordMarketingEvent(input: Omit<MarketingEvent, "id" | "createdAt">) {
  const createdAt = new Date().toISOString();
  const id = createHash("sha256").update([input.customerId, input.enrollmentId, input.type, input.stepId, createdAt].join("|")).digest("hex");
  const record: MarketingEvent = { ...input, id, createdAt };
  await put(`${EVENT_PREFIX}${createdAt.replace(/[:.]/g, "-")}-${id}.json`, JSON.stringify(record), {
    access: "private",
    contentType: "application/json",
    addRandomSuffix: false,
    allowOverwrite: false,
    cacheControlMaxAge: 0
  });
  return record;
}

export async function loadMarketingEvents(limit = 500): Promise<MarketingEvent[]> {
  try {
    const want = Math.min(5000, Math.max(1, limit));
    // Blob list returns pathnames ASCENDING; event filenames are timestamp-prefixed, so a plain
    // list returns the OLDEST events and recent ones never appear once the total exceeds the page
    // size. Paginate to collect every pathname, then keep the NEWEST `want` (largest pathnames).
    const pathnames: string[] = [];
    let cursor: string | undefined;
    do {
      const page = await list({ prefix: EVENT_PREFIX, limit: 1000, cursor });
      for (const blob of page.blobs) pathnames.push(blob.pathname);
      cursor = page.hasMore ? page.cursor : undefined;
    } while (cursor && pathnames.length < 50000);
    const newest = pathnames.sort((a, b) => (a < b ? 1 : a > b ? -1 : 0)).slice(0, want);
    const rows = await Promise.all(newest.map(pathname => readJson<MarketingEvent>(pathname)));
    return rows.filter((row): row is MarketingEvent => Boolean(row)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } catch {
    return [];
  }
}

export function crmRowToMarketingFacts(customer: any): CustomerMarketingFacts {
  const tags = Array.isArray(customer?.tags) ? customer.tags.map((tag: unknown) => String(tag).toLowerCase()) : [];
  return {
    customerId: String(customer?.id || ""),
    name: String(customer?.full_name || "Customer"),
    phone: String(customer?.phone_e164 || customer?.phone || ""),
    // Existing-customer win-back (owner-approved policy): an explicit true is opt-in. A blanket false,
    // the CRM default for customers who were never asked, is treated as unknown rather than a decline.
    // Real opt-outs are still enforced below through doNotContact and the STOP suppression tags.
    smsMarketingConsent: customer?.sms_marketing_consent === true ? true : null,
    doNotContact: Boolean(customer?.do_not_contact),
    smsSuppressed: tags.some((tag: string) => ["sms_suppressed", "stop_sms", "unsubscribe"].includes(tag)),
    totalOrders: Number(customer?.order_count || 0),
    deliveredCount: Number(customer?.delivered_count || 0),
    failedCount: Number(customer?.failed_count || 0),
    returnedCount: Number(customer?.returned_count || 0),
    cancelledCount: Number(customer?.cancelled_count || 0),
    lifetimeValue: Number(customer?.lifetime_value || 0),
    lastStatus: customer?.last_status ? String(customer.last_status) : null,
    lastOrderDate: customer?.last_order_at ? String(customer.last_order_at) : null,
    lastInteractionDate: customer?.last_interaction_at ? String(customer.last_interaction_at) : null,
    hasActiveConversation: false,
    hasOpenIssue: tags.some((tag: string) => ["open_issue", "plant_issue_open"].includes(tag)),
    hasOpenBulkHandoff: tags.includes("bulk_handoff_open"),
    cooldownUntil: null,
    currentSequence: null
  };
}

export function firstName(value: string) {
  return String(value || "Customer").trim().split(/\s+/)[0] || "Customer";
}

export function renderMarketingMessage(template: string, customer: { name: string }) {
  return cleanTemplate(String(template || "").replaceAll("{first_name}", firstName(customer.name)), "");
}

function manilaDayKey(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const map = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${map.year}-${map.month}-${map.day}`;
}

function rate(part: number, whole: number) {
  return whole > 0 ? Math.round((part / whole) * 1000) / 10 : 0;
}

export function marketingAnalytics(events: MarketingEvent[], sequences: MarketingSequence[], smsUnitCostPhp: number, now: Date = new Date()) {
  const segmentOf = new Map(sequences.map(sequence => [sequence.id, sequence.segment as string]));
  const count = (type: MarketingEvent["type"]) => events.filter(event => event.type === type).length;

  const enrolled = count("enrolled");
  const sent = count("sent");
  const failed = count("failed");
  const replied = count("replied");
  const ordered = count("ordered");
  const bulkHandoffs = count("bulk_handoff");
  const revenue = events.filter(event => event.type === "ordered").reduce((sum, event) => sum + Number(event.amount || 0), 0);
  const totalCost = Math.round(sent * (Number(smsUnitCostPhp) || 0) * 100) / 100;
  const netProfit = Math.round((revenue - totalCost) * 100) / 100;

  const segments = new Map<string, { segment: string; sent: number; replied: number; ordered: number; revenue: number }>();
  const bucket = (seqId: string) => {
    const segment = segmentOf.get(seqId) || (seqId === "bulk_handoff" ? "bulk_handoff" : "other");
    if (!segments.has(segment)) segments.set(segment, { segment, sent: 0, replied: 0, ordered: 0, revenue: 0 });
    return segments.get(segment)!;
  };
  for (const event of events) {
    if (event.type === "sent") bucket(event.sequenceId).sent += 1;
    else if (event.type === "replied") bucket(event.sequenceId).replied += 1;
    else if (event.type === "ordered") {
      const row = bucket(event.sequenceId);
      row.ordered += 1;
      row.revenue += Number(event.amount || 0);
    }
  }
  const bySegment = [...segments.values()]
    .map(row => ({ ...row, replyRate: rate(row.replied, row.sent), orderRate: rate(row.ordered, row.sent) }))
    .sort((a, b) => b.revenue - a.revenue || b.ordered - a.ordered);

  const days: string[] = [];
  for (let i = 13; i >= 0; i -= 1) days.push(manilaDayKey(new Date(now.getTime() - i * 86_400_000).toISOString()));
  const daily = days.map(date => {
    const dayEvents = events.filter(event => manilaDayKey(event.createdAt) === date);
    return {
      date,
      sent: dayEvents.filter(event => event.type === "sent").length,
      ordered: dayEvents.filter(event => event.type === "ordered").length,
      revenue: dayEvents.filter(event => event.type === "ordered").reduce((sum, event) => sum + Number(event.amount || 0), 0)
    };
  });

  return {
    totals: { enrolled, sent, failed, replied, ordered, bulkHandoffs, revenue },
    rates: {
      deliverability: rate(sent, sent + failed),
      replyRate: rate(replied, sent),
      orderRate: rate(ordered, sent),
      replyToOrder: rate(ordered, replied)
    },
    economics: { smsUnitCostPhp: Number(smsUnitCostPhp) || 0, totalCost, revenue, netProfit, roi: totalCost > 0 ? Math.round((revenue / totalCost) * 100) / 100 : 0 },
    bySegment,
    daily
  };
}

export function marketingSummary(decisions: MarketingDecision[]) {
  const bySegment = decisions.reduce((result, decision) => {
    result[decision.segment] = (result[decision.segment] || 0) + 1;
    return result;
  }, {} as Record<string, number>);
  return {
    evaluated: decisions.length,
    eligible: decisions.filter(decision => decision.eligible).length,
    waiting: decisions.filter(decision => !decision.eligible && decision.segment === "waiting").length,
    excluded: decisions.filter(decision => decision.segment === "excluded").length,
    protected: decisions.filter(decision => ["active_order", "open_issue", "bulk_handoff", "recovery_cooldown"].includes(decision.segment)).length,
    bySegment
  };
}

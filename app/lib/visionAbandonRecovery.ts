import { get, put } from "@vercel/blob";
import { normalizePhilippineMobile } from "./visionInfotxt";
import { sendTrackedInfotxtSms } from "./visionSmsTrackedSend";

const PANCAKE_API = "https://pos.pages.fm/api/v1";
const PREFIX = "vision-x-saha/abandon-recovery/";

// Day since detection -> percent off. Day 0 is a no-discount nudge.
export const RECOVERY_TIERS: { day: number; pct: number }[] = [
  { day: 0, pct: 0 },
  { day: 1, pct: 5 },
  { day: 3, pct: 10 },
  { day: 5, pct: 15 },
  { day: 7, pct: 20 }
];
const FINAL_DAY = 7;

export type RecoveryState = {
  orderId: string;
  phone: string;
  detectedAt: string;
  lastTierDay: number;
  lastSentAt: string;
  status: "recovering" | "recovered" | "gaveup";
  recoveredPct: number;
};

function path(orderId: string) {
  return `${PREFIX}${String(orderId).replace(/\D/g, "")}.json`;
}

export async function loadRecovery(orderId: string): Promise<RecoveryState | null> {
  try {
    const r = await get(path(orderId), { access: "private", useCache: false });
    if (!r || r.statusCode !== 200 || !r.stream) return null;
    return JSON.parse(await new Response(r.stream).text()) as RecoveryState;
  } catch {
    return null;
  }
}

async function saveRecovery(state: RecoveryState) {
  try {
    await put(path(state.orderId), JSON.stringify(state), {
      access: "private",
      contentType: "application/json",
      addRandomSuffix: false,
      allowOverwrite: true,
      cacheControlMaxAge: 0
    });
  } catch {
    // best-effort
  }
}

function codPeso(order: any) {
  const raw = Number(order?.cod || order?.total_price_after_sub_discount || order?.total_price || 0);
  return Math.round(raw > 10000 ? raw / 100 : raw);
}

function firstName(order: any) {
  const full = String(order?.bill_full_name || order?.full_name || order?.customer?.name || "").trim();
  return full.split(/\s+/)[0] || "customer";
}

export function pctForDay(day: number) {
  const tier = RECOVERY_TIERS.find(t => t.day === day);
  return tier ? tier.pct : 0;
}

// The next tier to send given elapsed days and the last tier already sent, or null.
function dueTier(detectedAt: string, lastTierDay: number) {
  const elapsedDays = (Date.now() - Date.parse(detectedAt)) / 86_400_000;
  let due: { day: number; pct: number } | null = null;
  for (const tier of RECOVERY_TIERS) {
    if (tier.day <= elapsedDays && tier.day > lastTierDay) due = tier;
  }
  return due;
}

function tierMessage(day: number, pct: number, first: string, orderId: string, origCod: number) {
  if (pct <= 0) {
    return `Hi ${first}, hindi mo pa natapos ang Lakatan order mo #${orderId}. Gusto mo pa ba itong ituloy? Reply YES para i-process namin.`;
  }
  const newCod = Math.round(origCod * (1 - pct / 100));
  const last = day >= FINAL_DAY ? " Last offer na ito!" : "";
  return `Hi ${first}, para sa Lakatan order mo #${orderId}: ${pct}% OFF na - COD P${newCod} na lang (dating P${origCod}). Reply YES para i-lock ang order mo!${last}`;
}

/**
 * Advance one abandoned order's recovery by one step. Sends the due tier message
 * (if any) and updates state. Call this per abandoned order on each monitor run.
 */
export async function runRecoveryStep(order: any) {
  const id = String(order?.id || order?.order_id || "");
  const phone = normalizePhilippineMobile(order?.bill_phone_number || order?.phone_number);
  if (!id || !phone) return { id, outcome: "no_contact" as const };

  let state = await loadRecovery(id);
  if (!state) {
    state = {
      orderId: id,
      phone,
      detectedAt: String(order?.inserted_at || order?.created_at || new Date().toISOString()),
      lastTierDay: -1,
      lastSentAt: "",
      status: "recovering",
      recoveredPct: 0
    };
  }
  if (state.status !== "recovering") return { id, outcome: state.status };

  const tier = dueTier(state.detectedAt, state.lastTierDay);
  const elapsedDays = (Date.now() - Date.parse(state.detectedAt)) / 86_400_000;
  if (!tier) {
    if (elapsedDays > FINAL_DAY) {
      state.status = "gaveup";
      await saveRecovery(state);
      return { id, outcome: "gaveup" as const };
    }
    return { id, outcome: "not_due" as const };
  }

  const message = tierMessage(tier.day, tier.pct, firstName(order), id, codPeso(order));
  const res = await sendTrackedInfotxtSms({
    orderId: id,
    event: "abandon_recovery",
    eventLabel: `Abandon recovery day ${tier.day}${tier.pct ? ` (${tier.pct}% off)` : ""}`,
    recipient: "customer",
    phone,
    message,
    source: "abandon_recovery",
    eventAt: `recovery-${id}-day${tier.day}`
  });
  state.lastTierDay = tier.day;
  state.lastSentAt = new Date().toISOString();
  await saveRecovery(state);
  return { id, outcome: res.duplicate ? ("duplicate" as const) : ("sent" as const), day: tier.day, pct: tier.pct };
}

/**
 * Mel saves an abandoned order on a YES: applies the current tier's discount,
 * clears the abandoned flag, and confirms it so it flows to Jan Uploader.
 */
export async function completeAbandonRecovery(apiKey: string, shopId: string, order: any) {
  const id = String(order?.id || order?.order_id || "");
  const state = await loadRecovery(id);
  const pct = state ? pctForDay(state.lastTierDay) : 0;

  const currentCodCentavos = Number(order?.cod || 0);
  const existingDiscountCentavos = Number(order?.total_discount || 0);
  const discountCentavos = Math.round(currentCodCentavos * pct / 100);
  const newCodCentavos = currentCodCentavos - discountCentavos;

  const form = new URLSearchParams();
  form.set("orders[0][id]", id);
  form.set("orders[0][status]", "1");
  form.set("orders[0][is_abandoned_order]", "false");
  form.set("orders[0][cod]", String(newCodCentavos));
  form.set("orders[0][total_price]", String(newCodCentavos));
  form.set("orders[0][money_to_collect]", String(newCodCentavos));
  // Preserve any existing discount (e.g. landing-page combo) and add Mel's recovery discount.
  form.set("orders[0][total_discount]", String(existingDiscountCentavos + discountCentavos));
  await fetch(`${PANCAKE_API}/shops/${encodeURIComponent(shopId)}/orders/update_multiple_orders?api_key=${encodeURIComponent(apiKey)}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
    cache: "no-store"
  });

  if (state) {
    state.status = "recovered";
    state.recoveredPct = pct;
    await saveRecovery(state);
  }
  return { orderId: id, pct, newCodPeso: Math.round(newCodCentavos / 100), discountPeso: Math.round(discountCentavos / 100) };
}

export async function markRecoveryGaveUp(orderId: string) {
  const state = await loadRecovery(orderId);
  if (state && state.status === "recovering") {
    state.status = "gaveup";
    await saveRecovery(state);
  }
}

import { createHash } from "node:crypto";
import { get, put } from "@vercel/blob";
import { normalizePhilippineMobile, sendInfotxtSms } from "./visionInfotxt";
import {
  closeMarketingForPhone,
  findActiveMarketingEnrollment,
  loadMarketingConfig,
  recordMarketingEvent,
  saveMarketingEnrollment
} from "./visionMarketingEngine";
import { sendTrackedInfotxtSms } from "./visionSmsTrackedSend";
import { consumeReferrerCredit, recordReferral, REFERRER_CREDIT_PHP, REFEREE_DISCOUNT_PERCENT } from "./visionReferral";

const PANCAKE_API = "https://pos.pages.fm/api/v1";
const CONVO_PREFIX = "vision-x-saha/sms-convo/";
const CONVO_TTL_MS = 2 * 60 * 60 * 1000; // a conversation goes stale after 2 hours

// Lakatan Saha bundles (COD). Upsell/downsell move between these sizes.
export const BUNDLES: Record<string, { label: string; quantity: number; price: number }> = {
  "2pcs_499": { label: "2 pcs Lakatan Saha", quantity: 2, price: 499 },
  "4pcs_799": { label: "4 pcs Lakatan Saha", quantity: 4, price: 799 },
  "10pcs_1699": { label: "10 pcs Lakatan Saha", quantity: 10, price: 1699 },
  "20pcs_2999": { label: "Buy 10 Take 10 Lakatan Saha (20 pcs)", quantity: 20, price: 2999 }
};

// Grow Na Na Organic bundles (COD) - organic fertilizer/booster cross-sold to growers.
export const BOOSTER_BUNDLES: Record<string, { label: string; quantity: number; price: number }> = {
  "booster_1pc_199": { label: "1 pc Grow Na Na Organic", quantity: 1, price: 199 },
  "booster_2pcs_349": { label: "2 pcs Grow Na Na Organic", quantity: 2, price: 349 },
  "booster_3pcs_499": { label: "3 pcs Grow Na Na Organic", quantity: 3, price: 499 }
};

// Product catalog for order creation (Pancake lookup by name, with optional env ID overrides).
const PRODUCT_CATALOG = {
  lakatan: { name: "lakatan saha", productEnv: "VISION_X_SAHA_LAKATAN_PRODUCT_ID", variationEnv: "VISION_X_SAHA_LAKATAN_VARIATION_ID", bundles: BUNDLES },
  booster: { name: "grow na na organic", productEnv: "VISION_X_SAHA_BOOSTER_PRODUCT_ID", variationEnv: "VISION_X_SAHA_BOOSTER_VARIATION_ID", bundles: BOOSTER_BUNDLES }
} as const;

// Returned-order (RTS) shipping refund, collected via GCash by Mel's recovery script.
const SHIPPING_REFUND_PHP = 80;
const GCASH_NUMBER = "09561603751";
const GCASH_NAME = "DO..A L..";

type ChatMessage = { role: "user" | "assistant"; content: string };
type ConvoState = { messages: ChatMessage[]; active: boolean; updatedAt: string };

function convoPath(mobile: string) {
  return `${CONVO_PREFIX}${mobile.replace(/\D/g, "")}.json`;
}

async function loadConvo(mobile: string): Promise<ConvoState> {
  const fresh: ConvoState = { messages: [], active: false, updatedAt: "" };
  try {
    const result = await get(convoPath(mobile), { access: "private", useCache: false });
    if (!result || result.statusCode !== 200 || !result.stream) return fresh;
    const data = JSON.parse(await new Response(result.stream).text());
    if (Date.now() - Date.parse(data.updatedAt || "") > CONVO_TTL_MS) return fresh;
    return { messages: Array.isArray(data.messages) ? data.messages.slice(-10) : [], active: Boolean(data.active), updatedAt: String(data.updatedAt || "") };
  } catch {
    return fresh;
  }
}

async function saveConvo(mobile: string, messages: ChatMessage[], active: boolean) {
  try {
    await put(convoPath(mobile), JSON.stringify({ mobile, messages: messages.slice(-10), active, updatedAt: new Date().toISOString() }), {
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

export async function isConvoActive(mobile: string) {
  const convo = await loadConvo(mobile);
  return convo.active;
}

async function pancakeJson(url: string, init?: RequestInit) {
  const res = await fetch(url, { ...init, cache: "no-store" });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body?.error) throw new Error(body?.error?.message || body?.message || `Pancake returned ${res.status}.`);
  return body;
}

function statusTagalog(order: any): string {
  const s = Number(order?.status);
  const name = String(order?.status_name || "").toLowerCase();
  if (s === 0 || name === "new") return "bagong order";
  if (s === 1 || name.includes("confirm")) return "confirmed na";
  if (s === 8 || name.includes("pack")) return "inihahanda na";
  if (s === 9 || name.includes("waiting")) return "nakahanda na para sa courier";
  if (s === 2 || name.includes("ship")) return "naka-ship na";
  if (s === 3 || name.includes("deliver")) return "na-deliver na";
  if (s === 6 || name.includes("cancel")) return "na-cancel na";
  return name || "nasa proseso";
}

const GEO = "https://pos.pages.fm/api/v1/geo";

function normLoc(value: string) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\b(city|municipality|province|of|del|de)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function geoList(url: string): Promise<any[]> {
  try {
    const r = await fetch(url, { cache: "no-store" });
    const b = await r.json().catch(() => ({}));
    return Array.isArray(b) ? b : (Array.isArray(b.data) ? b.data : []);
  } catch {
    return [];
  }
}

function bestGeoMatch(list: any[], name: string) {
  const target = normLoc(name);
  if (!target) return null;
  let hit = list.find(x => normLoc(x.name_en) === target || normLoc(x.name) === target);
  if (hit) return hit;
  hit = list.find(x => {
    const en = normLoc(x.name_en);
    const nm = normLoc(x.name);
    return (en && (en.startsWith(target) || target.startsWith(en))) || (nm && (nm.includes(target) || target.includes(en || nm)));
  });
  return hit || null;
}

// Match typed province/city/barangay words to Pancake geo IDs so the order ships without a hold.
async function resolveLocation(province: string, city: string, barangay: string) {
  const ids = { province_id: "", district_id: "", commune_id: "" };
  const provinces = await geoList(`${GEO}/provinces?country_code=63`);
  const p = bestGeoMatch(provinces, province);
  if (!p) return ids;
  ids.province_id = String(p.id);
  const districts = await geoList(`${GEO}/districts?province_id=${encodeURIComponent(p.id)}`);
  const d = bestGeoMatch(districts, city);
  if (!d) return ids;
  ids.district_id = String(d.id);
  const communes = await geoList(`${GEO}/communes?province_id=${encodeURIComponent(p.id)}&district_id=${encodeURIComponent(d.id)}`);
  const c = bestGeoMatch(communes, barangay);
  if (c) ids.commune_id = String(c.id);
  return ids;
}

type ReorderLocation = { street: string; barangay: string; city: string; province: string };

// Resolve a catalog product's Pancake product + variation IDs (env override, else name lookup).
async function resolveProduct(apiKey: string, shopId: string, key: keyof typeof PRODUCT_CATALOG) {
  const spec = PRODUCT_CATALOG[key];
  let productId = process.env[spec.productEnv] || "";
  let variationId = process.env[spec.variationEnv] || "";
  if (!productId || !variationId) {
    const body = await pancakeJson(`${PANCAKE_API}/shops/${encodeURIComponent(shopId)}/products?api_key=${encodeURIComponent(apiKey)}&page_number=1&page_size=100`);
    const products = Array.isArray(body.data) ? body.data : (Array.isArray(body.products) ? body.products : []);
    const product = products.find((item: any) => String(item?.name || item?.product_name || "").trim().toLowerCase() === spec.name);
    if (!product) throw new Error(`${spec.name} product not found.`);
    productId = String(product.id || product.product_id || "");
    const variations = product.variations || product.variants || product.product_variations || [];
    variationId = String(variations[0]?.id || variations[0]?.variation_id || product.variation_id || "");
  }
  if (!productId || !variationId) throw new Error("Product or variation unavailable.");
  return { productId, variationId };
}

type CreateOrderInput = {
  lakatanBundleKey?: string;
  boosterBundleKey?: string;
  loc: ReorderLocation;
  discountPercent?: number;
  referrerCreditPhp?: number;
};

// Create a COD order in Pancake. Supports a Lakatan bundle and/or a Grow Na Na booster
// in one order, a percentage discount, and a fixed referral credit. Resolves the typed
// location to geo IDs for courier upload.
async function createReorder(apiKey: string, shopId: string, phone: string, name: string, input: CreateOrderInput): Promise<{ orderId: string; subtotal: number; discountPhp: number }> {
  const lakatan = input.lakatanBundleKey ? BUNDLES[input.lakatanBundleKey] : null;
  const booster = input.boosterBundleKey ? BOOSTER_BUNDLES[input.boosterBundleKey] : null;
  if (input.lakatanBundleKey && !lakatan) throw new Error("Invalid bundle.");
  if (input.boosterBundleKey && !booster) throw new Error("Invalid booster bundle.");
  if (!lakatan && !booster) throw new Error("No product selected.");

  const loc = input.loc;
  const fullAddress = [loc.street, loc.barangay, loc.city, loc.province].map(s => String(s || "").trim()).filter(Boolean).join(", ");
  if (fullAddress.length < 6) throw new Error("Address is incomplete.");

  const items: any[] = [];
  const labels: string[] = [];
  let subtotal = 0;
  if (lakatan) {
    const p = await resolveProduct(apiKey, shopId, "lakatan");
    items.push({ product_id: p.productId, variation_id: p.variationId, quantity: lakatan.quantity, price: lakatan.price });
    subtotal += lakatan.price;
    labels.push(lakatan.label);
  }
  if (booster) {
    const p = await resolveProduct(apiKey, shopId, "booster");
    items.push({ product_id: p.productId, variation_id: p.variationId, quantity: booster.quantity, price: booster.price });
    subtotal += booster.price;
    labels.push(booster.label);
  }

  const geo = await resolveLocation(loc.province, loc.city, loc.barangay);
  const safeDiscountPercent = [0, 10, 20, 30].includes(Number(input.discountPercent)) ? Number(input.discountPercent) : 0;
  const pctAmount = Math.round(subtotal * safeDiscountPercent / 100);
  const credit = Math.max(0, Math.min(Math.floor(Number(input.referrerCreditPhp || 0)), subtotal - pctAmount));
  const discountPhp = Math.min(subtotal, pctAmount + credit);
  const note = `COD order via VISION X SAHA Mel SMS: ${labels.join(" + ")}${safeDiscountPercent ? `, ${safeDiscountPercent}% discount` : ""}${credit ? `, P${credit} referral credit` : ""}`;
  const payload = {
    bill_full_name: name || "SMS Customer",
    bill_phone_number: phone,
    shipping_address: fullAddress,
    province_id: geo.province_id || null,
    district_id: geo.district_id || null,
    commune_id: geo.commune_id || null,
    is_free_shipping: true,
    shipping_fee: 0,
    received_at_shop: false,
    note,
    items,
    total_discount: discountPhp,
    status: 0
  };
  const res = await pancakeJson(`${PANCAKE_API}/shops/${encodeURIComponent(shopId)}/orders?api_key=${encodeURIComponent(apiKey)}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
  return { orderId: String(res.id || res.order_id || res.data?.id || res.data?.order_id || ""), subtotal, discountPhp };
}

function detectedRecoveryDiscount(messages: ChatMessage[], currentSms: string) {
  const text = [...messages.map(message => message.content), currentSms].join(" ").toLowerCase();
  if (/dumating.{0,30}(patay|bulok|rotten|dead)|dead on arrival|rotten on arrival|bulok.{0,30}(dating|dumating)|patay.{0,30}(dating|dumating)/i.test(text)) return 30;
  if (/hindi.{0,25}(nabuhay|tumubo)|namatay.{0,25}(tanim|plant)|died after planting|failed after planting|partial.{0,20}(surviv|nabuhay)/i.test(text)) return 20;
  return 0;
}

function isPlantingGuideQuestion(messages: ChatMessage[], currentSms: string) {
  const text = [...messages.slice(-2).map(message => message.content), currentSms].join(" ").toLowerCase();
  return /planting guide|guide sa pagtanim|paano (itanim|magtanim)|how to plant|instructions? sa pagtanim/.test(text);
}

async function createBulkHandoff(input: {
  mobile: string;
  customerName: string;
  product: string;
  quantity: number;
  location: string;
  alertNumber: string;
  alertsEnabled: boolean;
}) {
  const customerId = `lead-${createHash("sha256").update(input.mobile).digest("hex").slice(0, 16)}`;
  const enrollment = await saveMarketingEnrollment({
    customerId,
    customerName: input.customerName || "SMS customer",
    phone: input.mobile,
    segment: "bulk_handoff",
    sequenceId: "bulk_handoff",
    stepIndex: 0,
    status: "bulk_handoff",
    campaignId: "mel_bulk_order",
    nextActionAt: null,
    lastSentAt: null,
    lastReplyAt: new Date().toISOString(),
    cooldownUntil: null,
    closedReason: "Quantity reached the bulk-order threshold"
  });
  if (!input.alertsEnabled) throw new Error("Bulk-order alerts are not enabled.");
  const alert = [
    "BULK ORDER ALERT",
    `Customer: ${input.customerName || "SMS customer"}`,
    `Mobile: ${input.mobile}`,
    `Product: ${input.product || "Lakatan Saha"}`,
    `Quantity: ${input.quantity}`,
    `Location: ${input.location || "Not completed"}`
  ].join("\n");
  const outcome = await sendInfotxtSms(input.alertNumber, alert);
  if (!outcome.accepted) throw new Error(outcome.error || "Bulk alert was not accepted by InfoTXT.");
  await recordMarketingEvent({
    customerId,
    phoneMasked: input.mobile.replace(/.(?=.{4})/g, "*"),
    enrollmentId: enrollment.id,
    sequenceId: "bulk_handoff",
    stepId: "owner_alert",
    type: "bulk_handoff",
    detail: `Bulk inquiry for ${input.quantity} units sent to the owner alert number.`,
    amount: 0
  });
  return enrollment;
}

async function openaiChat(key: string, messages: any[], tools: any[]) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
    body: JSON.stringify({ model: "gpt-4o-mini", max_tokens: 220, temperature: 0.4, messages, tools, tool_choice: "auto" })
  });
  return res.json().catch(() => ({}));
}

// Notify Ken on Telegram (used for add-to-open-order requests; no order edit here).
async function notifyTeam(text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chat = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chat) return;
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: chat, text })
    });
  } catch {
    // best-effort
  }
}

/**
 * Run the SMS sales agent for one customer message. Returns the reply text to send.
 * New orders are created deterministically via function-calling. Adding to an existing
 * open order is NOT auto-done; it is routed to the team via Telegram (human adds it).
 */
export async function runSmsAgent(
  mobile: string,
  sms: string,
  order: any,
  apiKey: string,
  shopId: string,
  openOrder: any,
  transitOrder: any
): Promise<string> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return "";

  const [convo, marketing, activeEnrollment] = await Promise.all([
    loadConvo(mobile),
    loadMarketingConfig(),
    findActiveMarketingEnrollment(mobile)
  ]);
  const marketingFeaturesActive = !marketing.activationLocked && marketing.mode === "live";
  const recoveryDiscount = marketingFeaturesActive ? detectedRecoveryDiscount(convo.messages, sms) : 0;
  const guideQuestion = marketingFeaturesActive && isPlantingGuideQuestion(convo.messages, sms);
  const sequenceDiscount = marketingFeaturesActive && activeEnrollment ? 10 : 0;
  const appliedDiscount = Math.max(recoveryDiscount, sequenceDiscount);
  if (guideQuestion) {
    const reply = "Available ang planting guide sa Facebook page namin. I-search lang po ang planting guide doon. Salamat!";
    await saveConvo(mobile, [...convo.messages, { role: "user", content: sms }, { role: "assistant", content: reply }], false);
    await closeMarketingForPhone(mobile, "completed", "Planting-guide location provided and conversation closed");
    return reply;
  }
  const isExisting = Boolean(order && (order.id || order.order_id));
  const tools: any[] = [
    {
      type: "function",
      function: {
        name: "create_order",
        description: "Place a Lakatan Saha order below the bulk threshold. Use only after the customer's YES and when there is no editable open order. Requires the bundle and complete address. Optionally add a Grow Na Na booster to the same order, and pass the referrer's number if someone referred this new customer.",
        parameters: {
          type: "object",
          properties: {
            bundle_key: { type: "string", enum: Object.keys(BUNDLES), description: "The chosen Lakatan bundle" },
            booster_bundle_key: { type: "string", enum: Object.keys(BOOSTER_BUNDLES), description: "Optional Grow Na Na booster to include in the same order after they accept the cross-sell" },
            referrer_phone: { type: "string", description: "Optional. The mobile number of the person who referred this NEW customer, if they named one" },
            full_name: { type: "string", description: "Customer full name, required for a new customer" },
            street: { type: "string", description: "House number, street, sitio or purok" },
            barangay: { type: "string", description: "Barangay" },
            city: { type: "string", description: "City or municipality" },
            province: { type: "string", description: "Province" }
          },
          required: ["bundle_key", "street", "barangay", "city", "province"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "create_booster_order",
        description: "Place a standalone Grow Na Na Organic (fertilizer/booster) COD order when the customer wants ONLY the booster, not Lakatan bulbs. Use only after their YES. Requires the booster bundle and complete address.",
        parameters: {
          type: "object",
          properties: {
            booster_bundle_key: { type: "string", enum: Object.keys(BOOSTER_BUNDLES), description: "The chosen Grow Na Na bundle" },
            full_name: { type: "string", description: "Customer full name, required for a new customer" },
            street: { type: "string", description: "House number, street, sitio or purok" },
            barangay: { type: "string", description: "Barangay" },
            city: { type: "string", description: "City or municipality" },
            province: { type: "string", description: "Province" }
          },
          required: ["booster_bundle_key", "street", "barangay", "city", "province"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "request_add_to_open_order",
        description: "Request adding more pcs to the customer's EXISTING OPEN (not yet shipped) order. Use when they want more and they already have an open order. Requires the customer's YES.",
        parameters: {
          type: "object",
          properties: {
            add_bundle_key: { type: "string", enum: Object.keys(BUNDLES), description: "The bundle quantity to add" }
          },
          required: ["add_bundle_key"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "request_new_order",
        description: "Submit a NEW (not-yet-registered) customer's Lakatan order for the team to verify and finalize. Use ONLY for a new person with no existing order. Requires bundle, full name, complete delivery address, and their YES.",
        parameters: {
          type: "object",
          properties: {
            bundle_key: { type: "string", enum: Object.keys(BUNDLES), description: "The chosen bundle" },
            full_name: { type: "string", description: "Customer's full name" },
            full_address: { type: "string", description: "Complete delivery address" }
          },
          required: ["bundle_key", "full_name", "full_address"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "coordinate_delivery_with_rider",
        description: "Bridge the customer with their assigned rider when they request a specific delivery time or want to coordinate timing. Only works when the order is out for delivery with an assigned rider.",
        parameters: {
          type: "object",
          properties: {
            preferred_time: { type: "string", description: "The delivery time or window the customer prefers" }
          },
          required: ["preferred_time"]
        }
      }
    }
  ];

  if (marketingFeaturesActive) {
    tools.push({
      type: "function",
      function: {
        name: "request_bulk_order",
        description: `Create a human handoff for any Lakatan order of ${marketing.bulkOrderThreshold} units or more. Never create these orders in Pancake automatically. Use only after collecting the customer name, quantity, and location.`,
        parameters: {
          type: "object",
          properties: {
            full_name: { type: "string", description: "Customer full name" },
            product: { type: "string", description: "Requested product" },
            quantity: { type: "integer", minimum: marketing.bulkOrderThreshold, description: "Requested unit quantity" },
            location: { type: "string", description: "Customer city and province or complete location" }
          },
          required: ["full_name", "product", "quantity", "location"]
        }
      }
    });
  }

  let orderPolicy: string;
  if (openOrder) {
    orderPolicy = `The customer ALREADY HAS AN OPEN order #${openOrder.id || openOrder.order_id} (${openOrder.total_quantity || "?"} pcs, not yet shipped). If they want more, DO NOT create a new order - that would be a double order. Tell them they have this open order and offer to ADD to it; after they confirm YES, call request_add_to_open_order. Never create a duplicate order while an open order exists.`;
  } else if (transitOrder) {
    orderPolicy = `The customer has order #${transitOrder.id || transitOrder.order_id} that is ALREADY SHIPPED/in-transit and can no longer be changed. If they want more, tell them this and ask if they want a SEPARATE new order; only then call create_order after their YES.`;
  } else {
    orderPolicy = `The customer has no open order, so a reorder uses create_order.`;
  }

  const bundleList = Object.values(BUNDLES).map(b => `${b.label} = P${b.price} COD`).join("; ");
  const boosterList = Object.values(BOOSTER_BUNDLES).map(b => `${b.label} = P${b.price} COD`).join("; ");
  const crossSellReferral = ` CROSS-SELL: Grow Na Na Organic is our organic fertilizer/booster that helps the Lakatan grow faster, greener, and fruit more. Boosters: ${boosterList}. When a grower reorders or is happy with their plants, offer ONE booster as a helpful add-on; if they say yes, include booster_bundle_key in create_order (same COD order). If they want ONLY the booster, use create_booster_order. Do not push it more than once. REFERRAL: whoever refers a new customer gets P${REFERRER_CREDIT_PHP} off their next order, and the new customer gets ${REFEREE_DISCOUNT_PERCENT}% off their first order. If a NEW customer says someone referred them, ask for that referrer's mobile number and pass it as referrer_phone in create_order. Invite happy customers to refer a kakilala.`;
  const returnedOrderPlaybook = ` RETURNED / REJECTED ORDER (RTS): If the customer's order was returned, rejected, or is returning to sender, that parcel can NO LONGER be re-delivered. Follow this path: (1) Warmly ask if they still want the Lakatan. If YES, take a BRAND-NEW order the normal way (plain COD via create_order). (2) Separately and sincerely, ask them to cover the P${SHIPPING_REFUND_PHP} shipping lost on the returned order via GCash ${GCASH_NUMBER} (${GCASH_NAME}), using an honest personal angle - the failed shipping is deducted from you, Mel: "ako po mismo ang nakaltasan sa shipping." If they are hard or resist, soften: "kahit anong amount na lang po sa GCash para hindi masyadong masakit yung kaltas sa akin." NEVER let the P${SHIPPING_REFUND_PHP} block or cancel the new order - it is a SOFT request, you do not lose the sale over it, and the new order stays plain COD (do NOT add P${SHIPPING_REFUND_PHP} to the COD total). The whole point is simply to MAKE the ask once; whether they send or not does not matter - if they say they paid just thank them warmly, and if they ignore or decline the shipping, do NOT ask for proof, do NOT chase it, and do NOT make it transactional. Always proceed with the new order either way. If they do not want to re-order at all, close politely without pushing the shipping.`;
  const productKnowledge = ` PRODUCT: You sell the Lakatan Saha BULB only - the banana corm/sucker base (the planting bulb), NOT the whole stem, trunk, or a tall seedling. It is roughly the size of a fist to two fists (about 10-20 cm), a live planting bulb the customer grows at home or on their farm. NEVER describe it as "1-2 feet tall" or as a full plant/seedling with leaves. If asked how big it is (gaano kalaki): say it is a healthy banana bulb about the size of a fist, ready to plant. It is NOT food and NOT any other product; if an order shows a different item, go by what the customer ordered. It is a disease-resistant Lakatan variety; once planted it yields sweet bananas in roughly 9-12 months with care. PLANTING EXPERTISE - answer planting and care questions yourself, briefly and confidently like an experienced grower: plant the bulb with the pointed shoot/bud side up, buried a few inches in rich, well-draining soil; full sun; water regularly but avoid waterlogging; space about 2-3 meters apart in ground, or use a large pot/sack; feed with compost or organic fertilizer; keep weeds down; shoots sprout in a few weeks and it starts bearing fruit in about 9-12 months. TRUST AND ASSURANCE - address worries warmly FIRST, before price: it is legit and COD (Cash on Delivery), so they PAY ONLY WHEN IT ARRIVES - zero risk, no prepayment; many growers already bought. If worried about problems/returns: because it is COD they can refuse a clearly bad delivery, and if a bulb arrives damaged we give 20% off, dead or rotten we give 30% off or a replacement. If someone says they will cancel without assurance, reassure them with the COD and replacement guarantee first, and only cancel if they still insist. HANDLING DISSATISFACTION - if a customer is unhappy, feels misled, says the bulbs are too small ("parang sibuyas"/like an onion), short in count, or calls it "false advertisement": FIRST make them feel important and heard - thank them sincerely, apologize warmly, and tell them their satisfaction truly matters to us. THEN calmly and confidently insist on the truth: these are LIVE PLANTS, sir/ma'am - they are meant to be PLANTED, and once planted even a small bulb grows into a full banana plant and MULTIPLIES into more suckers over time, so the starting size is normal and not a defect. Encourage them to plant it properly and it will reward them with fruit and more plants. If the count was genuinely short or an item truly arrived bad, apologize and apply the replacement/discount guarantee to make it right. Never argue, dismiss, or get defensive, and never agree that it was false advertising - always reframe around the live-plant growth and our COD and replacement support.`;
  const context = `Customer name: ${order?.bill_full_name || "customer"}. Their latest order #${order?.id || order?.order_id}: ${statusTagalog(order)}; tracking ${order?.partner?.extend_code || "wala pa"}.`;
  const marketingPolicy = marketingFeaturesActive
    ? ` MARKETING POLICY: You handle all ordinary questions and orders without human assistance. Any request for ${marketing.bulkOrderThreshold} units or more MUST call request_bulk_order and must not create a Pancake order. If the customer asks how to plant or care for the Lakatan saha, answer briefly and helpfully using your own planting knowledge; you may also mention that a full guide is on the Facebook page, but never send a URL. If plants arrived dead or rotten, apologize and immediately offer 30% off a replacement. If plants died after planting or partially survived, apologize and immediately offer 20% off a replacement. If the customer accepts, collect order details and complete the order. If they decline, close politely without further questions. ${appliedDiscount ? `The currently approved discount is ${appliedDiscount}%.` : "The normal marketing offer is 10%."}`
    : "";
  const system = isExisting
    ? `You are VISION X SAHA sales and support, replying over SMS to an EXISTING Lakatan Saha customer in the Philippines. Keep every reply short Taglish (Tagalog-English), under 300 characters, no links or URLs. You can take REORDERS. Bundles: ${bundleList}. When the customer wants to buy, upsell ONCE to a bigger bundle; if they hesitate on price, downsell to a smaller bundle so you keep the sale. If the customer asks for a specific delivery time or to coordinate the timing, call coordinate_delivery_with_rider with their preferred_time. For a NEW order you MUST have the bundle AND a COMPLETE delivery address that includes house/street, BARANGAY, CITY/municipality, and PROVINCE. If any of barangay, city, or province is missing, ask for it specifically before proceeding. Then summarize (bundle, discounted price when applicable, full address) and get YES before calling create_order. ORDER POLICY: ${orderPolicy} Never invent prices and never promise an exact delivery date. Do not add any company name or signature at the end of your replies.${productKnowledge}${crossSellReferral}${returnedOrderPlaybook}${marketingPolicy} ${context}`
    : `You are VISION X SAHA sales, replying over SMS to a NEW person interested in Lakatan Saha plants. Keep every reply short Taglish (Tagalog-English), under 300 characters, no links or URLs. Bundles: ${bundleList}. Help them order: collect their FULL NAME, the bundle, and a COMPLETE delivery address that includes house/street, BARANGAY, CITY/municipality, and PROVINCE. Ask specifically for any missing part. Upsell ONCE to a bigger bundle; if they hesitate on price, downsell to a smaller one. When you have name, address, and bundle, send a one-line summary and ask them to reply YES. ${marketingFeaturesActive ? "After YES, call create_order for quantities below the bulk threshold." : "After YES, call request_new_order so the team can verify it."} Never invent prices or promise an exact delivery date. Do not add any company name or signature.${productKnowledge}${crossSellReferral}${returnedOrderPlaybook}${marketingPolicy}`;

  const messages: any[] = [{ role: "system", content: system }, ...convo.messages, { role: "user", content: sms }];

  let data = await openaiChat(key, messages, tools);
  let message = data?.choices?.[0]?.message;
  let active = true;

  if (message?.tool_calls?.length) {
    const call = message.tool_calls[0];
    const name = call.function?.name;
    let toolResult = "";
    try {
      const args = JSON.parse(call.function?.arguments || "{}");
      if (name === "create_order") {
        const bundle = BUNDLES[String(args.bundle_key || "")];
        if (!bundle) {
          toolResult = "Invalid bundle.";
        } else if (marketingFeaturesActive && bundle.quantity >= marketing.bulkOrderThreshold) {
          await createBulkHandoff({
            mobile,
            customerName: String(args.full_name || order?.bill_full_name || "SMS customer"),
            product: bundle.label,
            quantity: bundle.quantity,
            location: [args.street, args.barangay, args.city, args.province].filter(Boolean).join(", "),
            alertNumber: marketing.bulkAlertNumber,
            alertsEnabled: marketing.bulkAlertsEnabled
          });
          toolResult = "Bulk handoff created and owner notified. Tell the customer the bulk-order team will continue the transaction.";
          active = false;
        } else if (!isExisting && !marketingFeaturesActive) {
          toolResult = "New-customer automatic order creation is not active. Use request_new_order.";
        } else if (marketingFeaturesActive && !marketing.pancakeWritesEnabled) {
          toolResult = "Pancake order writing is not enabled.";
        } else {
          // Referral: a NEW customer who named a referrer gets the referee discount; the referrer earns a credit.
          let orderDiscountPercent = appliedDiscount;
          if (!isExisting && args.referrer_phone) {
            const recorded = await recordReferral(String(args.referrer_phone), mobile);
            if (recorded) orderDiscountPercent = Math.max(orderDiscountPercent, REFEREE_DISCOUNT_PERCENT);
          }
          // Redeem this customer's own pending referral credit (earned by referring others before).
          const referrerCreditPhp = await consumeReferrerCredit(mobile, 100000);
          const boosterKey = args.booster_bundle_key && BOOSTER_BUNDLES[String(args.booster_bundle_key)] ? String(args.booster_bundle_key) : undefined;
          const created = await createReorder(apiKey, shopId, mobile, String(args.full_name || order?.bill_full_name || "SMS Customer"), {
            lakatanBundleKey: String(args.bundle_key || ""),
            boosterBundleKey: boosterKey,
            loc: {
              street: String(args.street || ""),
              barangay: String(args.barangay || ""),
              city: String(args.city || ""),
              province: String(args.province || "")
            },
            discountPercent: orderDiscountPercent,
            referrerCreditPhp
          });
          const orderId = created.orderId;
          const boosterNote = boosterKey ? ` Booster added: ${BOOSTER_BUNDLES[boosterKey].label}.` : "";
          const creditNote = referrerCreditPhp ? ` P${referrerCreditPhp} referral credit applied.` : "";
          toolResult = orderId ? `Order placed successfully. order_id=${orderId}. Discount: ${orderDiscountPercent}%.${boosterNote}${creditNote}` : "Order creation failed.";
          if (orderId && activeEnrollment) {
            await closeMarketingForPhone(mobile, "ordered", `Pancake order ${orderId} created by Mel`);
            await recordMarketingEvent({
              customerId: activeEnrollment.customerId,
              phoneMasked: mobile.replace(/.(?=.{4})/g, "*"),
              enrollmentId: activeEnrollment.id,
              sequenceId: activeEnrollment.sequenceId,
              stepId: "mel_order",
              type: "ordered",
              detail: `Pancake order ${orderId} created by Mel (${orderDiscountPercent}% discount${boosterKey ? ", booster cross-sell" : ""}).`,
              amount: Math.max(0, created.subtotal - created.discountPhp)
            });
          }
          active = false;
        }
      } else if (name === "create_booster_order") {
        const booster = BOOSTER_BUNDLES[String(args.booster_bundle_key || "")];
        if (!booster) {
          toolResult = "Invalid booster bundle.";
        } else if (!isExisting && !marketingFeaturesActive) {
          toolResult = "New-customer automatic order creation is not active. Use request_new_order.";
        } else if (marketingFeaturesActive && !marketing.pancakeWritesEnabled) {
          toolResult = "Pancake order writing is not enabled.";
        } else {
          const referrerCreditPhp = await consumeReferrerCredit(mobile, 100000);
          const created = await createReorder(apiKey, shopId, mobile, String(args.full_name || order?.bill_full_name || "SMS Customer"), {
            boosterBundleKey: String(args.booster_bundle_key || ""),
            loc: {
              street: String(args.street || ""),
              barangay: String(args.barangay || ""),
              city: String(args.city || ""),
              province: String(args.province || "")
            },
            referrerCreditPhp
          });
          const creditNote = referrerCreditPhp ? ` P${referrerCreditPhp} referral credit applied.` : "";
          toolResult = created.orderId ? `Grow Na Na order placed successfully. order_id=${created.orderId}.${creditNote}` : "Order creation failed.";
          active = false;
        }
      } else if (name === "request_add_to_open_order") {
        const bundle = BUNDLES[String(args.add_bundle_key || "")];
        const openId = openOrder ? String(openOrder.id || openOrder.order_id) : "";
        if (marketingFeaturesActive && bundle && bundle.quantity >= marketing.bulkOrderThreshold) {
          await createBulkHandoff({
            mobile,
            customerName: String(order?.bill_full_name || "SMS customer"),
            product: bundle.label,
            quantity: bundle.quantity,
            location: String(order?.shipping_address || order?.full_address || "Not completed"),
            alertNumber: marketing.bulkAlertNumber,
            alertsEnabled: marketing.bulkAlertsEnabled
          });
          toolResult = "Bulk handoff created and owner notified. Tell the customer the bulk-order team will continue the transaction.";
          active = false;
        } else if (bundle && openId) {
          await notifyTeam(`SMS add-on request: ${order?.bill_full_name || "Customer"} (${mobile}) wants to ADD ${bundle.label} (P${bundle.price}) to OPEN order #${openId}. Please add it in Pancake.`);
          toolResult = `Add-on request sent to the team for order #${openId}. Tell the customer it will be added to their open order and confirmed shortly.`;
          active = false;
        } else {
          toolResult = "No open order available to add to.";
        }
      } else if (name === "request_bulk_order" && marketingFeaturesActive) {
        const quantity = Math.max(marketing.bulkOrderThreshold, Number(args.quantity || 0));
        await createBulkHandoff({
          mobile,
          customerName: String(args.full_name || order?.bill_full_name || "SMS customer"),
          product: String(args.product || "Lakatan Saha"),
          quantity,
          location: String(args.location || "Not completed"),
          alertNumber: marketing.bulkAlertNumber,
          alertsEnabled: marketing.bulkAlertsEnabled
        });
        toolResult = "Bulk handoff created and owner notified. Tell the customer the bulk-order team will continue the transaction.";
        active = false;
      } else if (name === "request_new_order") {
        // New lead: never auto-create. Route to the team to verify and create.
        const bundle = BUNDLES[String(args.bundle_key || "")];
        if (bundle) {
          await notifyTeam(`SMS NEW LEAD order: ${String(args.full_name || order?.bill_full_name || "New customer")} (${mobile}) wants ${bundle.label} (P${bundle.price} COD). Deliver to: ${String(args.full_address || "")}. Please verify and create in Pancake.`);
          toolResult = `New order request sent to the team. Tell the customer their order is received and will be verified and confirmed shortly.`;
          active = false;
        } else {
          toolResult = "Invalid bundle.";
        }
      } else if (name === "coordinate_delivery_with_rider") {
        const riderPhone = normalizePhilippineMobile(order?.partner?.delivery_tel || "");
        const riderName = String(order?.partner?.delivery_name || "rider").trim() || "rider";
        const oid = String(order?.id || order?.order_id || "");
        const prefTime = String(args.preferred_time || "").slice(0, 120);
        if (riderPhone) {
          await sendTrackedInfotxtSms({
            orderId: oid,
            tracking: String(order?.partner?.extend_code || ""),
            event: "rider_coordination",
            eventLabel: "Rider coordination",
            recipient: "rider",
            phone: riderPhone,
            message: `Order #${oid}: si ${order?.bill_full_name || "customer"} (${mobile}) gusto i-deliver ${prefTime || "sa preferred time nila"}. Paki-coordinate sa kanila.`,
            source: "rider_coordination",
            eventAt: `rider-${oid}-${Date.now()}`
          });
          toolResult = `Rider ${riderName} (${riderPhone}) was messaged with the request. Tell the customer that rider ${riderName} at ${riderPhone} will coordinate the delivery time, and they can text or call the rider directly.`;
        } else {
          await notifyTeam(`Delivery-time request: ${order?.bill_full_name || "Customer"} (${mobile}) for order #${oid} wants delivery ${prefTime || "at a specific time"}. No rider number available yet - please help coordinate.`);
          toolResult = `No rider number is available yet. The team has been notified to help coordinate. Tell the customer we received their preferred time and will coordinate the delivery with the rider.`;
        }
        active = false;
      } else {
        toolResult = "Unknown action.";
      }
    } catch (error) {
      toolResult = `Action failed: ${error instanceof Error ? error.message : "error"}`;
    }
    const followUp = [...messages, message, { role: "tool", tool_call_id: call.id, content: toolResult }];
    data = await openaiChat(key, followUp, tools);
    message = data?.choices?.[0]?.message;
  }

  const reply = String(message?.content || "").trim().slice(0, 300);
  const history: ChatMessage[] = [...convo.messages, { role: "user", content: sms }, { role: "assistant", content: reply }];
  await saveConvo(mobile, history, active && Boolean(reply));
  return reply;
}

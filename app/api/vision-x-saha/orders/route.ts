import { NextResponse } from "next/server";
import {
  loadVisionPancakeOrders,
  visionArray as array,
  visionNumber as numberValue,
  visionOrderLakatanPieces,
  visionOrderStage as stageFor,
  visionOrderValue as orderValue,
  visionText as textValue,
  visionTrackingNumber as trackingNumber
} from "../../../lib/visionPancakeOrders";

export const dynamic = "force-dynamic";

const terminalStages = new Set(["delivered", "returned", "cancelled"]);

function itemName(item: any) {
  return String(item?.product_name || item?.name || item?.variation_info?.name || item?.variation_info?.product_display_id || "Product");
}

function tagTexts(value: any): string[] {
  const values = Array.isArray(value) ? value : typeof value === "string" ? value.split(",") : value ? [value] : [];
  return values.map(tag => textValue(typeof tag === "object" ? tag?.name || tag?.title || tag?.tag_name || tag?.value : tag)).filter(Boolean);
}

function orderTags(order: any): string[] {
  return Array.from(new Set([
    ...tagTexts(order.tags),
    ...tagTexts(order.tag_names),
    ...tagTexts(order.order_tags),
    ...tagTexts(order.tag)
  ])).slice(0, 3);
}

function courierName(order: any) {
  return String(order?.partner?.name || order?.partner?.partner_name || order?.partner?.courier_name || order?.shipping_partner || "").trim();
}

function riderPhone(order: any) {
  return String(order?.partner?.delivery_tel || "").trim();
}

function maskedPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.length < 7) return digits ? "••••" : "";
  const prefix = digits.startsWith("63") ? "+63" : digits.slice(0, 2);
  return `${prefix} ••••• ${digits.slice(-4)}`;
}

function officialTrackingUrl(order: any) {
  const tracking = trackingNumber(order);
  const courier = courierName(order);
  if (!tracking || (!/j\s*&\s*t|jnt|bigate/i.test(courier) && !/^JT/i.test(tracking))) return "";
  return `https://www.jtexpress.ph/track-and-trace?waybillNo=${encodeURIComponent(tracking)}`;
}

function imageUrls(update: any) {
  const found = new Set<string>();
  const add = (candidate: unknown, hinted = false) => {
    if (typeof candidate !== "string") return;
    const matches = candidate.match(/https:\/\/[^\s"'<>]+/gi) || [];
    for (const match of matches) {
      const cleaned = match.replace(/[),.;]+$/, "");
      if (!hinted && !/\.(?:avif|gif|jpe?g|png|webp)(?:\?|#|$)/i.test(cleaned)) continue;
      try {
        const url = new URL(cleaned);
        if (url.protocol === "https:") found.add(url.toString());
      } catch {
        // Ignore malformed courier attachment URLs.
      }
      if (found.size >= 8) break;
    }
  };
  const visit = (value: unknown, key = "", depth = 0) => {
    if (depth > 3 || found.size >= 8 || value === null || value === undefined) return;
    const hinted = /image|photo|proof|attachment|media|file|picture|url/i.test(key);
    if (typeof value === "string") { add(value, hinted); return; }
    if (Array.isArray(value)) { value.forEach(item => visit(item, key, depth + 1)); return; }
    if (typeof value === "object") Object.entries(value as Record<string, unknown>).forEach(([childKey, child]) => visit(child, childKey, depth + 1));
  };
  visit(update);
  return [...found];
}

function courierEventKind(title: string, note: string) {
  const text = `${title} ${note}`.toLowerCase();
  if (/failed|reject|refus|unable|undeliver|return/.test(text)) return "problem";
  if (/delivered|received by consignee|successfully delivered/.test(text)) return "success";
  if (/delivering|out for delivery/.test(text)) return "active";
  return "movement";
}

function courierUpdates(order: any) {
  return array(order?.partner?.extend_update).map((update, sourceIndex) => {
    const status = textValue(update?.status || update?.title || update?.event || update?.description);
    const rawNote = textValue(update?.note || update?.remark || update?.reason || update?.message);
    const title = status || rawNote || "Courier update";
    const note = rawNote && rawNote.toLowerCase() !== title.toLowerCase() ? rawNote : "";
    const at = String(update?.update_at || update?.updated_at || update?.event_time || update?.status_time || update?.created_at || update?.inserted_at || update?.timestamp || update?.time || update?.date || "").trim();
    return {
      id: `${at || "undated"}-${sourceIndex}-${title}`,
      title,
      note,
      at,
      kind: courierEventKind(title, note),
      images: imageUrls(update),
      sourceIndex
    };
  }).filter(update => update.title !== "Courier update" || update.note || update.at || update.images.length)
    .sort((a, b) => {
      const aTime = Date.parse(a.at);
      const bTime = Date.parse(b.at);
      if (Number.isFinite(aTime) && Number.isFinite(bTime)) return bTime - aTime;
      if (Number.isFinite(aTime)) return -1;
      if (Number.isFinite(bTime)) return 1;
      return a.sourceIndex - b.sourceIndex;
    })
    .slice(0, 100)
    .map(({ sourceIndex: _sourceIndex, ...update }) => update);
}

function timestamp(order: any, updateAt = "") {
  return String(updateAt || order.updated_at || order.inserted_at || order.created_at || "");
}

export async function GET() {
  try {
    const { rawOrders, businessOrders } = await loadVisionPancakeOrders();
    const now = Date.now();
    const orders = businessOrders.map(order => {
      const updates = courierUpdates(order);
      const latest = updates[0] || { title: "", note: "", at: "" };
      const stage = stageFor(order, `${latest.title} ${latest.note}`);
      const createdAt = String(order.inserted_at || order.created_at || order.updated_at || "");
      const updatedAt = timestamp(order, latest.at);
      const ageHours = createdAt ? Math.max(0, (now - new Date(createdAt).getTime()) / 3600000) : 0;
      const stageAgeHours = updatedAt ? Math.max(0, (now - new Date(updatedAt).getTime()) / 3600000) : ageHours;
      const items = array(order.items);
      const printingCount = Math.max(0, numberValue(order.printing_count));
      const posStatusCode = Number(order.status);
      const posStatusName = String(order.status_name || order.status || "unknown").toLowerCase();
      const readyToPrint = Boolean(trackingNumber(order))
        && printingCount === 0
        && posStatusCode === 9;
      return {
        id: String(order.id || order.order_id || ""),
        createdAt,
        updatedAt,
        customer: String(order.bill_full_name || order.full_name || order.customer?.name || "Customer"),
        phone: String(order.bill_phone_number || order.phone_number || "").trim(),
        value: orderValue(order),
        quantity: visionOrderLakatanPieces(order),
        bundle: items.map(itemName).filter(Boolean).join(", ") || "Lakatan Saha",
        hasUpsell: String(order.note || "").includes("VISION_SAHA_EXTRA_LAKATAN"),
        landingPage: /VISION X SAHA/i.test(String(order.note || "")),
        tags: orderTags(order),
        posStatus: posStatusName,
        posStatusCode,
        stage,
        tracking: trackingNumber(order),
        printingCount,
        readyToPrint,
        courier: courierName(order) || (trackingNumber(order) ? "Courier assigned" : "Not yet assigned"),
        trackingLink: officialTrackingUrl(order),
        sentToCourierAt: String(order.time_send_partner || ""),
        pickedUpAt: String(order?.partner?.picked_up_at || ""),
        estimatedDeliveryAt: String(order.estimate_delivery_date || ""),
        sortCode: String(order?.partner?.sort_code || "").trim(),
        deliveryRider: String(order?.partner?.delivery_name || "").trim(),
        riderPhoneAvailable: Boolean(riderPhone(order)),
        riderPhoneMasked: maskedPhone(riderPhone(order)),
        returnedReason: textValue(order.returned_reason),
        subStatus: textValue(order.sub_status || order.sub_status_name),
        latestCourierUpdate: latest.title || (trackingNumber(order) ? "Tracking created; waiting for first courier scan." : "Not yet pushed to courier."),
        latestCourierNote: latest.note,
        courierUpdatedAt: latest.at,
        courierUpdates: updates,
        courierEventCount: updates.length,
        ageHours: Number(ageHours.toFixed(1)),
        stageAgeHours: Number(stageAgeHours.toFixed(1)),
        needsAction: !terminalStages.has(stage) && stageAgeHours >= (trackingNumber(order) ? 36 : 20)
      };
    }).sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

    const stages = orders.reduce<Record<string, number>>((result, order) => {
      result[order.stage] = (result[order.stage] || 0) + 1;
      return result;
    }, {});
    const pushed = orders.filter(order => Boolean(order.tracking));
    const delivered = orders.filter(order => order.stage === "delivered");
    const returns = orders.filter(order => ["failed_delivery", "returning", "returned"].includes(order.stage));
    const courierMovements = orders.reduce((sum, order) => sum + order.courierEventCount, 0);
    const proofImages = orders.reduce((sum, order) => sum + order.courierUpdates.reduce((eventSum: number, update: any) => eventSum + update.images.length, 0), 0);

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      sample: `Latest ${orders.length} real POS orders`,
      totalOrders: orders.length,
      excludedTestOrders: rawOrders.length - businessOrders.length,
      pending: orders.filter(order => ["pending", "confirmed", "packing"].includes(order.stage)).length,
      pushed: pushed.length,
      inTransit: orders.filter(order => ["pushed_to_courier", "in_transit", "out_for_delivery"].includes(order.stage)).length,
      delivered: delivered.length,
      returns: returns.length,
      needsAction: orders.filter(order => order.needsAction).length,
      codValue: orders.reduce((sum, order) => sum + order.value, 0),
      deliveredValue: delivered.reduce((sum, order) => sum + order.value, 0),
      courierMovements,
      proofImages,
      stages,
      recentOrders: orders
    }, { headers: { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow, noarchive" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Pancake POS could not be reached." }, { status: 502 });
  }
}



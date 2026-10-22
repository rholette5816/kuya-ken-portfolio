import { NextRequest, NextResponse } from "next/server";
import { loadInfotxtInboundRecords, loadInfotxtOutboundRecords, outboundView } from "../../../lib/visionInfotxtRecords";
import { loadOrderDeliveryEvents } from "../../../lib/visionOrderOperations";

export const dynamic = "force-dynamic";

const headers = {
  "Cache-Control": "private, no-store, max-age=0",
  "X-Robots-Tag": "noindex, nofollow, noarchive"
};

export async function GET(request: NextRequest) {
  const orderId = request.nextUrl.searchParams.get("orderId")?.trim() || "";
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(orderId)) return NextResponse.json({ error: "Select a valid Pancake order." }, { status: 400, headers });
  try {
    const [outbound, inbound, deliveryEvents] = await Promise.all([
      loadInfotxtOutboundRecords(1000),
      loadInfotxtInboundRecords(1000),
      loadOrderDeliveryEvents(orderId)
    ]);
    const messages = [
      ...outbound.filter(row => row.orderId === orderId).map(row => ({
        id: `outbound-${row.providerSmsId}`,
        direction: "outbound" as const,
        recipient: row.recipient,
        source: row.source,
        text: row.message || "SMS body was not retained in this earlier audit record.",
        time: row.submittedAt,
        status: outboundView(row).providerStatus,
        destinationMasked: row.destinationMasked,
        eventLabel: row.eventLabel,
        providerSmsId: row.providerSmsId
      })),
      ...inbound.filter(row => row.orderId === orderId).map(row => ({
        id: `inbound-${row.id}`,
        direction: "inbound" as const,
        recipient: "customer",
        source: "customer_reply",
        text: row.sms,
        time: row.receivedAt || row.storedAt,
        status: "received",
        destinationMasked: row.mobileMasked,
        eventLabel: "Customer reply",
        providerSmsId: row.providerMessageId
      }))
    ].sort((left, right) => Date.parse(left.time) - Date.parse(right.time));
    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      orderId,
      messages,
      deliveryEvents: deliveryEvents.map(({ riderPhone: _riderPhone, ...event }) => event),
      note: "Messages are linked only by the Pancake order ID. Older outbound audit records may not include their SMS body because that content was not previously retained."
    }, { headers });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Order activity could not be loaded." }, { status: 502, headers });
  }
}

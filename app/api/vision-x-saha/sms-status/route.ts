import { NextRequest, NextResponse } from "next/server";
import {
  backfillInfotxtOutboundRecords,
  loadInfotxtInboundRecords,
  loadInfotxtOutboundRecords,
  outboundView,
  refreshInfotxtOutboundRecords
} from "../../../lib/visionInfotxtRecords";
import { loadSmsAutomationLogs } from "../../../lib/visionSmsAutomation";

export const dynamic = "force-dynamic";

const PRIVATE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  "X-Robots-Tag": "noindex, nofollow, noarchive"
};

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: PRIVATE_HEADERS });
}

export async function GET(request: NextRequest) {
  try {
    const shouldRefresh = request.nextUrl.searchParams.get("refresh") === "1";
    if (shouldRefresh) {
      const logs = await loadSmsAutomationLogs(200);
      await backfillInfotxtOutboundRecords(logs);
    }
    const [records, inbound] = await Promise.all([
      shouldRefresh ? refreshInfotxtOutboundRecords(100, 0) : loadInfotxtOutboundRecords(100),
      loadInfotxtInboundRecords(500)
    ]);
    const outbound = records.map(outboundView);
    const secret = process.env.VISION_X_SAHA_INFOTXT_WEBHOOK_SECRET?.trim() || "";
    const webhookUrl = secret ? `${request.nextUrl.origin}/api/vision-x-saha/infotxt-webhook?key=${encodeURIComponent(secret)}` : "";
    return json({
      checkedAt: new Date().toISOString(),
      outbound,
      inbound: inbound.map(row => ({
        id: row.id,
        providerMessageId: row.providerMessageId,
        mobileMasked: row.mobileMasked,
        sms: row.sms,
        sentAt: row.sentAt,
        receivedAt: row.receivedAt,
        sim: row.sim,
        isCustomer: Boolean(row.isCustomer),
        orderId: row.orderId || "",
        customerName: row.customerName || "",
        storedAt: row.storedAt
      })),
      stats: {
        total: outbound.length,
        queued: outbound.filter(row => row.providerStatus === "queued").length,
        sent: outbound.filter(row => row.providerStatus === "sent").length,
        failed: outbound.filter(row => row.providerStatus === "failed").length,
        attention: outbound.filter(row => row.gatewayAttention).length,
        replies: inbound.length
      },
      inboundWebhook: {
        configured: Boolean(secret),
        setupUrl: webhookUrl,
        method: "POST",
        contentType: "application/x-www-form-urlencoded"
      },
      note: "Statuses update during scheduled reconciliation. Use Refresh provider for an on-demand check. InfoTXT status 1 means the provider dispatched the SMS; the official guide does not define handset delivery receipts."
    });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "InfoTXT records could not be loaded." }, 502);
  }
}

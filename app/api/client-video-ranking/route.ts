import { NextRequest, NextResponse } from "next/server";
import { getAdvertisingClientConfig } from "@/lib/advertising-client-config";
import { COOKIE_NAME, DATA_VERSION, MANUAL_REFRESH_MS, REFRESH_MS, buildReport, loadRecord, saveRecord, validClientToken } from "@/lib/video-ranking";

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const config = await getAdvertisingClientConfig(request.nextUrl.searchParams.get("client") || "rminds");
  if (!config) return NextResponse.json({ error: "Advertising client not found." }, { status: 404 });

  const cronSecret = process.env.CRON_SECRET;
  const isCron = Boolean(cronSecret && request.headers.get("authorization") === `Bearer ${cronSecret}`);
  const token = request.nextUrl.searchParams.get("token") || "";
  if (!isCron && !(await validClientToken(token, config))) {
    return NextResponse.json({ error: "A valid private client link is required." }, { status: 401 });
  }

  const record = await loadRecord(config);
  const isAdmin = Boolean(process.env.KRA_OS_ACCESS_TOKEN && request.cookies.get(COOKIE_NAME)?.value === process.env.KRA_OS_ACCESS_TOKEN);
  const age = record ? Date.now() - new Date(record.syncedAt).getTime() : Infinity;
  const stale = !record || record.dataVersion !== DATA_VERSION || age > REFRESH_MS;
  const requestedRefresh = request.nextUrl.searchParams.get("refresh") === "1";
  const force = isCron || (requestedRefresh && (isAdmin || age >= MANUAL_REFRESH_MS));

  try {
    if (stale || force) {
      const report = await buildReport(config);
      await saveRecord(config, report);
      return NextResponse.json(report, { headers: { "Cache-Control": "no-store" } });
    }
    return NextResponse.json({ ...record, refreshDeferred: requestedRefresh && !force }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Meta synchronization failed.";
    if (record) return NextResponse.json({ ...record, syncError: message }, { headers: { "Cache-Control": "no-store" } });
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { getAdvertisingClientConfig } from "@/lib/advertising-client-config";
import { authorizeClientRequest, scopedBrand, scopedRange } from "@/lib/client-auth";
import { COOKIE_NAME, DATA_VERSION, MANUAL_REFRESH_MS, REFRESH_MS, buildReport, loadRecord, reportForRange, saveRecord, scopeReport, withoutDaily } from "@/lib/video-ranking";

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const config = await getAdvertisingClientConfig(request.nextUrl.searchParams.get("client") || "rminds");
  if (!config) return NextResponse.json({ error: "Advertising client not found." }, { status: 404 });

  const cronSecret = process.env.CRON_SECRET;
  const isCron = Boolean(cronSecret && request.headers.get("authorization") === `Bearer ${cronSecret}`);
  const token = request.nextUrl.searchParams.get("token") || "";
  const access = isCron ? null : await authorizeClientRequest(token, config, "client-video-ranking");
  if (!isCron && !access) {
    return NextResponse.json({ error: "A valid private client link is required." }, { status: 401 });
  }
  // A shared link is locked to one brand. Filter before the payload leaves the
  // server so the recipient cannot read other brands out of the response.
  const brand = access ? scopedBrand(access) : null;

  // A shared link's range is fixed by the link. Everyone else may pass one.
  const locked = access ? scopedRange(access) : { from: null, to: null };
  const isoDate = (value: string | null) => (value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null);
  const from = access?.kind === "share" ? locked.from : isoDate(request.nextUrl.searchParams.get("from"));
  const to = access?.kind === "share" ? locked.to : isoDate(request.nextUrl.searchParams.get("to"));

  const shrink = (report: any) => {
    const ranged = from || to ? reportForRange(report, from, to) : withoutDaily(report);
    return scopeReport(ranged, brand);
  };

  const record = await loadRecord(config);
  const isAdmin = Boolean(process.env.KRA_OS_ACCESS_TOKEN && request.cookies.get(COOKIE_NAME)?.value === process.env.KRA_OS_ACCESS_TOKEN);
  const age = record ? Date.now() - new Date(record.syncedAt).getTime() : Infinity;
  const stale = !record || record.dataVersion !== DATA_VERSION || age > REFRESH_MS;
  const requestedRefresh = request.nextUrl.searchParams.get("refresh") === "1";
  // A share recipient may read but never trigger a paid Meta refresh.
  const canForce = access?.kind !== "share";
  const force = isCron || (canForce && requestedRefresh && (isAdmin || age >= MANUAL_REFRESH_MS));

  try {
    if (stale || force) {
      const report = await buildReport(config);
      await saveRecord(config, report);
      return NextResponse.json(shrink(report), { headers: { "Cache-Control": "no-store" } });
    }
    return NextResponse.json(
      { ...shrink(record), refreshDeferred: requestedRefresh && !force },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Meta synchronization failed.";
    if (record) return NextResponse.json({ ...shrink(record), syncError: message }, { headers: { "Cache-Control": "no-store" } });
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

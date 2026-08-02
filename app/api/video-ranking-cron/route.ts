import { NextRequest, NextResponse } from "next/server";
import { listAdvertisingClientConfigs } from "@/lib/advertising-client-config";
import { buildReport, saveRecord } from "@/lib/video-ranking";

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET is not configured, refusing to run an unauthenticated refresh." }, { status: 503 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const configs = await listAdvertisingClientConfigs();
  const results: Array<Record<string, unknown>> = [];

  for (const config of configs) {
    if (!process.env[config.metaTokenEnv]) {
      results.push({ client: config.slug, skipped: "Meta token not configured." });
      continue;
    }
    try {
      const report = await buildReport(config);
      await saveRecord(config, report);
      results.push({
        client: config.slug,
        graded: report.totalGraded,
        excluded: report.excluded.length,
        brands: report.brands.length,
        syncedAt: report.syncedAt
      });
    } catch (error) {
      results.push({ client: config.slug, error: error instanceof Error ? error.message : "Refresh failed." });
    }
  }

  const failed = results.filter(item => item.error).length;
  return NextResponse.json(
    { ranAt: new Date().toISOString(), clients: results.length, failed, results },
    { status: failed && failed === results.length ? 502 : 200, headers: { "Cache-Control": "no-store" } }
  );
}

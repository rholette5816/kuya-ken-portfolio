import { NextRequest, NextResponse } from "next/server";
import { loadJanRuns } from "../../../lib/visionJanLog";

export const dynamic = "force-dynamic";

function isDashboardAuthed(req: NextRequest) {
  const tokens = [
    process.env.VISION_X_SAHA_DASHBOARD_ACCESS_TOKEN,
    process.env.VISION_X_SAHA_RUSTAN_ACCESS_TOKEN,
  ].filter((t): t is string => Boolean(t));
  const cookie = req.cookies.get("vision_x_saha_access")?.value || "";
  return tokens.length > 0 && tokens.includes(cookie);
}

export async function GET(req: NextRequest) {
  if (!isDashboardAuthed(req)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const base = {
    name: "Jan Uploader AI",
    role: "Courier upload autopilot",
    schedule: "Every other day at 7:00 AM PHT",
    courier: "Bigate J&T Philippines",
  };

  try {
    const runs = (await loadJanRuns()).map((r) => ({
      timestamp: r.timestamp || "",
      trigger: r.trigger || "",
      candidates: Number(r.candidates || 0),
      shipped: Number(r.shipped || 0),
      failed: Number(r.failed || 0),
      flagged: Number(r.flagged || 0),
      abandoned: Number(r.abandoned || 0),
      incomplete: Number(r.incomplete || 0),
      tracking: r.tracking || "",
      failures: r.failures || "",
    }));

    const last = runs[0] || null;
    const status = !last ? "standby" : last.failed > 0 ? "attention" : "active";

    return NextResponse.json(
      { ...base, status, lastRun: last, runs: runs.slice(0, 12) },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return NextResponse.json(
      { ...base, status: "error", error: error instanceof Error ? error.message : "Log read failed.", runs: [] },
      { status: 502 },
    );
  }
}

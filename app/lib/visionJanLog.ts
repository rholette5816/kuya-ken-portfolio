import { get, put } from "@vercel/blob";

// Jan Uploader AI run log. Stored in Vercel Blob (same store the rest of Vision
// X Saha uses) so it works without any Google Sheet or service-account setup.
const BLOB_PATH = "vision-x-saha/jan-uploader/runs.json";
const MAX_RUNS = 60;

export type JanRun = {
  at: string; // ISO timestamp
  timestamp: string; // PHT display string
  trigger: string; // "manual" | "cron"
  candidates: number;
  shipped: number;
  failed: number;
  flagged: number;
  abandoned: number;
  incomplete: number;
  tracking: string; // "#id code | ..."
  failures: string; // "#id error | ..."
};

export async function loadJanRuns(): Promise<JanRun[]> {
  try {
    const r = await get(BLOB_PATH, { access: "private", useCache: false });
    if (!r || r.statusCode !== 200 || !r.stream) return [];
    const parsed = JSON.parse(await new Response(r.stream).text());
    return Array.isArray(parsed?.runs) ? (parsed.runs as JanRun[]) : [];
  } catch {
    return [];
  }
}

// Append one run, newest first, capped at MAX_RUNS. Best-effort, never throws.
export async function appendJanRun(run: JanRun): Promise<void> {
  try {
    const existing = await loadJanRuns();
    const runs = [run, ...existing].slice(0, MAX_RUNS);
    await put(BLOB_PATH, JSON.stringify({ runs }), {
      access: "private",
      contentType: "application/json",
      addRandomSuffix: false,
      allowOverwrite: true,
      cacheControlMaxAge: 0,
    });
  } catch {
    // logging is best-effort; never fail the run over it
  }
}

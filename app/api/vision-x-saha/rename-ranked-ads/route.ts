import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const META_API_VERSION = "v23.0";

function metaToken() {
  return process.env.VISION_X_SAHA_META_TOKEN || process.env.LAKATAN_META_TOKEN || process.env.META_ACCESS_TOKEN || "";
}

async function metaRequest(path: string, init?: RequestInit) {
  const token = metaToken();
  if (!token) throw new Error("Meta access is not configured.");
  const separator = path.includes("?") ? "&" : "?";
  const response = await fetch(`https://graph.facebook.com/${META_API_VERSION}/${path}${separator}access_token=${encodeURIComponent(token)}`, { ...init, cache: "no-store" });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.error) throw new Error(body.error?.message || `Meta returned ${response.status}.`);
  return body;
}

function baseName(name: string) {
  return name.replace(/^R\d{2}\s*\|\s*(?:TOP ATTENTION|TEST)\s*\|\s*/i, "").trim() || "Unnamed ad";
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const rankings = Array.isArray(body?.rankings) ? body.rankings.slice(0, 200) : [];
    const updates: Array<{ adId: string; rank: number }> = [];
    for (const item of rankings) {
      const rank = Number(item?.rank);
      if (!Number.isInteger(rank) || rank < 1 || rank > 999 || !Array.isArray(item?.adIds)) continue;
      for (const value of item.adIds) {
        const adId = String(value || "");
        if (/^\d{8,30}$/.test(adId)) updates.push({ adId, rank });
      }
    }
    if (!updates.length) return NextResponse.json({ error: "No valid ranked ads were supplied." }, { status: 400 });

    const results = [];
    for (const update of updates) {
      try {
        const current = await metaRequest(`${update.adId}?fields=id,name`);
        const tier = update.rank <= 3 ? "TOP ATTENTION" : "TEST";
        const name = `R${String(update.rank).padStart(2, "0")} | ${tier} | ${baseName(String(current.name || ""))}`;
        if (name !== current.name) {
          await metaRequest(update.adId, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ name }) });
        }
        results.push({ adId: update.adId, rank: update.rank, name, updated: name !== current.name });
      } catch (error) {
        results.push({ adId: update.adId, rank: update.rank, error: error instanceof Error ? error.message : "Rename failed." });
      }
    }
    const failed = results.filter(result => "error" in result);
    return NextResponse.json({ renamed: results.length - failed.length, failed: failed.length, results }, { status: failed.length === results.length ? 502 : 200, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Rank labels could not be applied." }, { status: 500 });
  }
}

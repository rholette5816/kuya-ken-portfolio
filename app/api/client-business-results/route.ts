import { get, put } from "@vercel/blob";
import { NextRequest, NextResponse } from "next/server";
import { AdvertisingClientConfig, getAdvertisingClientConfig, validClientSession } from "@/lib/advertising-client-config";

type BusinessResult = {
  id: string;
  business: string;
  weekStart: string;
  weekEnd: string;
  grossRevenue: number;
  transactions: number;
  customerSource: string;
  note: string;
  updatedAt: string;
};

async function requestConfig(request: NextRequest) {
  return getAdvertisingClientConfig(request.nextUrl.searchParams.get("client") || "rminds");
}

async function validClientToken(token: string, config: AdvertisingClientConfig) {
  if (validClientSession(token, config.slug)) return true;
  if (config.slug !== "rminds") return false;
  if (!/^[a-f0-9]{48}$/.test(token)) return false;
  const result = await get(`${config.storagePrefix}/${token}.json`, { access: "private", useCache: false });
  return Boolean(result?.statusCode === 200);
}

async function loadResults(config: AdvertisingClientConfig): Promise<BusinessResult[]> {
  const result = await get(`${config.storagePrefix}/business-results.json`, { access: "private", useCache: false });
  if (!result || result.statusCode !== 200 || !result.stream) return [];
  const body = JSON.parse(await new Response(result.stream).text());
  return Array.isArray(body?.results) ? body.results : [];
}

async function saveResults(config: AdvertisingClientConfig, results: BusinessResult[]) {
  await put(`${config.storagePrefix}/business-results.json`, JSON.stringify({ results, updatedAt: new Date().toISOString() }), {
    access: "private",
    contentType: "application/json",
    addRandomSuffix: false,
    allowOverwrite: true,
    cacheControlMaxAge: 60
  });
}

export async function GET(request: NextRequest) {
  const config = await requestConfig(request);
  if (!config) return NextResponse.json({ error: "Advertising client not found." }, { status: 404 });
  const token = request.nextUrl.searchParams.get("token") || "";
  if (!(await validClientToken(token, config))) return NextResponse.json({ error: "A valid private client link is required." }, { status: 401 });
  return NextResponse.json({ results: await loadResults(config) }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  const config = await requestConfig(request);
  if (!config) return NextResponse.json({ error: "Advertising client not found." }, { status: 404 });
  const token = request.nextUrl.searchParams.get("token") || "";
  if (!(await validClientToken(token, config))) return NextResponse.json({ error: "A valid private client link is required." }, { status: 401 });
  const body = await request.json().catch(() => null);
  const business = String(body?.business || "");
  const weekStart = String(body?.weekStart || "");
  const weekEnd = String(body?.weekEnd || "");
  const grossRevenue = Number(body?.grossRevenue);
  const transactions = Number(body?.transactions || 0);
  if (!new Set(config.brands.map(brand => brand.name)).has(business) || !/^\d{4}-\d{2}-\d{2}$/.test(weekStart) || !/^\d{4}-\d{2}-\d{2}$/.test(weekEnd) || weekStart > weekEnd) {
    return NextResponse.json({ error: "Choose a business and a valid weekly date range." }, { status: 400 });
  }
  if (!Number.isFinite(grossRevenue) || grossRevenue < 0) {
    return NextResponse.json({ error: "Gross revenue must be a valid non-negative number." }, { status: 400 });
  }
  const results = await loadResults(config);
  const suppliedId = typeof body?.id === "string" && /^[a-zA-Z0-9-]{1,80}$/.test(body.id) ? body.id : "";
  const existing = results.find(item => item.business === business && item.weekStart === weekStart && item.id !== suppliedId);
  if (existing) return NextResponse.json({ error: "This business already has an entry for that week." }, { status: 409 });
  const record: BusinessResult = {
    id: suppliedId || crypto.randomUUID(),
    business,
    weekStart,
    weekEnd,
    grossRevenue: Math.round(grossRevenue * 100) / 100,
    transactions,
    customerSource: String(body?.customerSource || "").trim().slice(0, 500),
    note: String(body?.note || "").trim().slice(0, 500),
    updatedAt: new Date().toISOString()
  };
  const next = [...results.filter(item => item.id !== record.id), record]
    .sort((a, b) => b.weekStart.localeCompare(a.weekStart) || a.business.localeCompare(b.business));
  await saveResults(config, next);
  return NextResponse.json({ ok: true, result: record });
}

export async function DELETE(request: NextRequest) {
  const config = await requestConfig(request);
  if (!config) return NextResponse.json({ error: "Advertising client not found." }, { status: 404 });
  const token = request.nextUrl.searchParams.get("token") || "";
  if (!(await validClientToken(token, config))) return NextResponse.json({ error: "A valid private client link is required." }, { status: 401 });
  const id = request.nextUrl.searchParams.get("id") || "";
  const results = await loadResults(config);
  const next = results.filter(item => item.id !== id);
  if (next.length === results.length) return NextResponse.json({ error: "Entry not found." }, { status: 404 });
  await saveResults(config, next);
  return NextResponse.json({ ok: true });
}

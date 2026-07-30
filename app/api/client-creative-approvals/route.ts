import { get, put } from "@vercel/blob";
import { NextRequest, NextResponse } from "next/server";
import { AdvertisingClientConfig, getAdvertisingClientConfig, validClientSession } from "@/lib/advertising-client-config";

const VALID_STATUSES = new Set(["pending", "approved", "revision", "rejected"]);

async function validClientToken(token: string, config: AdvertisingClientConfig) {
  if (validClientSession(token, config.slug)) return true;
  if (config.slug !== "rminds") return false;
  if (!/^[a-f0-9]{48}$/.test(token)) return false;
  const result = await get(`${config.storagePrefix}/${token}.json`, { access: "private", useCache: false });
  return Boolean(result?.statusCode === 200);
}

async function loadApprovals(config: AdvertisingClientConfig) {
  const result = await get(`${config.storagePrefix}/creative-approvals.json`, { access: "private", useCache: false });
  if (!result || result.statusCode !== 200 || !result.stream) return {};
  return JSON.parse(await new Response(result.stream).text());
}

export async function GET(request: NextRequest) {
  const config = await getAdvertisingClientConfig(request.nextUrl.searchParams.get("client") || "rminds");
  if (!config) return NextResponse.json({ error: "Advertising client not found." }, { status: 404 });
  const token = request.nextUrl.searchParams.get("token") || "";
  if (!(await validClientToken(token, config))) return NextResponse.json({ error: "A valid private client link is required." }, { status: 401 });
  return NextResponse.json({ approvals: await loadApprovals(config) }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  const config = await getAdvertisingClientConfig(request.nextUrl.searchParams.get("client") || "rminds");
  if (!config) return NextResponse.json({ error: "Advertising client not found." }, { status: 404 });
  const token = request.nextUrl.searchParams.get("token") || "";
  if (!(await validClientToken(token, config))) return NextResponse.json({ error: "A valid private client link is required." }, { status: 401 });
  const body = await request.json().catch(() => null);
  const creativeId = String(body?.creativeId || "");
  const status = String(body?.status || "");
  const note = String(body?.note || "").trim().slice(0, 600);
  if (!/^[a-z0-9]+-[a-f0-9]{10}$/.test(creativeId) || !VALID_STATUSES.has(status)) {
    return NextResponse.json({ error: "Invalid approval update." }, { status: 400 });
  }
  const approvals = await loadApprovals(config);
  approvals[creativeId] = { status, note, updatedAt: new Date().toISOString() };
  await put(`${config.storagePrefix}/creative-approvals.json`, JSON.stringify(approvals), { access: "private", contentType: "application/json", addRandomSuffix: false, allowOverwrite: true, cacheControlMaxAge: 60 });
  return NextResponse.json({ approval: approvals[creativeId] }, { headers: { "Cache-Control": "no-store" } });
}

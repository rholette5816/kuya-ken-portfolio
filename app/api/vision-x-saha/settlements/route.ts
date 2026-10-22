import { randomUUID } from "node:crypto";
import { get, list, put } from "@vercel/blob";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const PREFIX = "vision-x-saha/settlements/";
const headers = { "Cache-Control": "private, no-store, max-age=0", "X-Robots-Tag": "noindex, nofollow, noarchive" };
const kinds = new Set(["remittance", "expense", "ad_spend", "capital_repayment", "adjustment"]);
const statuses = new Set(["draft", "awaiting_remittance", "reconciling", "ready_for_approval", "closed"]);

type SettlementRecord = {
  id: string; cycleKey: string; kind: "remittance" | "expense" | "ad_spend" | "capital_repayment" | "adjustment"; category: string; amount: number;
  date: string; paidBy: string; reference: string; evidenceUrl: string; note: string; createdAt: string;
};
type SettlementStatus = { cycleKey: string; status: string; closedAt?: string; updatedAt: string };

function json(body: Record<string, unknown>, status = 200) { return NextResponse.json(body, { status, headers }); }
function sameOrigin(request: NextRequest) { const origin = request.headers.get("origin"); if (!origin) return true; try { return new URL(origin).host === request.nextUrl.host; } catch { return false; } }
function clean(value: unknown, max = 500) { return typeof value === "string" ? value.trim().slice(0, max) : ""; }
function cycleKey(value: unknown) { const key = clean(value, 24); return /^\d{4}-\d{2}-\d{2}$/.test(key) ? key : ""; }
function recordPath(id: string) { return `${PREFIX}records/${id}.json`; }
function statusPath(key: string) { return `${PREFIX}cycles/${key}.json`; }
async function read<T>(pathname: string): Promise<T | null> { try { const row = await get(pathname, { access: "private", useCache: false }); return row?.statusCode === 200 && row.stream ? JSON.parse(await new Response(row.stream).text()) as T : null; } catch { return null; } }

export async function GET(request: NextRequest) {
  const key = cycleKey(request.nextUrl.searchParams.get("cycle"));
  if (!key) return json({ error: "A settlement cycle is required." }, 400);
  try {
    const result = await list({ prefix: `${PREFIX}records/`, limit: 1000 });
    const records = (await Promise.all(result.blobs.map(blob => read<SettlementRecord>(blob.pathname)))).filter((row): row is SettlementRecord => Boolean(row && row.cycleKey === key)).sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));
    const status = await read<SettlementStatus>(statusPath(key));
    return json({ records, status: status || { cycleKey: key, status: "draft", updatedAt: "" } });
  } catch { return json({ error: "Settlement records could not be loaded." }, 502); }
}

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return json({ error: "Request origin is not allowed." }, 403);
  const input = await request.json().catch(() => null);
  const key = cycleKey(input?.cycleKey);
  if (!key) return json({ error: "A valid settlement cycle is required." }, 400);
  if (input?.action === "status") {
    const status = clean(input.status, 40);
    if (!statuses.has(status)) return json({ error: "Invalid settlement status." }, 400);
    const previous = await read<SettlementStatus>(statusPath(key));
    if (previous?.status === "closed") return json({ error: "A closed statement is locked. Create an adjustment in the next cycle instead." }, 409);
    const row: SettlementStatus = { cycleKey: key, status, updatedAt: new Date().toISOString(), ...(status === "closed" ? { closedAt: new Date().toISOString() } : {}) };
    await put(statusPath(key), JSON.stringify(row), { access: "private", contentType: "application/json", addRandomSuffix: false, allowOverwrite: true, cacheControlMaxAge: 0 });
    return json({ saved: true, status: row });
  }
  const kind = clean(input?.kind, 20);
  const amount = Number(input?.amount);
  const date = clean(input?.date, 10);
  const category = clean(input?.category, 80);
  if (!kinds.has(kind) || !category || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(amount) || amount <= 0 || amount > 100000000) return json({ error: "Complete the date, type, category, and valid amount." }, 400);
  const previous = await read<SettlementStatus>(statusPath(key));
  if (previous?.status === "closed") return json({ error: "A closed statement is locked. Create an adjustment in the next cycle instead." }, 409);
  const row: SettlementRecord = { id: `SET-${randomUUID().slice(0, 8).toUpperCase()}`, cycleKey: key, kind: kind as SettlementRecord["kind"], category, amount, date, paidBy: clean(input?.paidBy, 80), reference: clean(input?.reference, 120), evidenceUrl: clean(input?.evidenceUrl, 500), note: clean(input?.note, 1000), createdAt: new Date().toISOString() };
  await put(recordPath(row.id), JSON.stringify(row), { access: "private", contentType: "application/json", addRandomSuffix: false, allowOverwrite: false, cacheControlMaxAge: 0 });
  return json({ created: true, record: row }, 201);
}

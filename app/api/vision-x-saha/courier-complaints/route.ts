import { randomUUID } from "node:crypto";
import { get, list, put } from "@vercel/blob";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
const PREFIX = "vision-x-saha/courier-complaints/";
const headers = { "Cache-Control": "private, no-store, max-age=0", "X-Robots-Tag": "noindex, nofollow, noarchive" };
const statuses = new Set(["draft", "ready", "submitted", "courier_replied", "resolved", "rejected"]);

type ComplaintCase = {
  id: string; orderId: string; tracking: string; courier: string; customer: string; value: number; stage: string;
  issue: string; status: string; reference: string; internalNote: string; complaintText: string;
  createdAt: string; updatedAt: string; submittedAt: string; evidence: { messages: any[]; courierUpdates: any[]; deliveryEvents: any[]; customerReplyCount: number };
};

function json(body: Record<string, unknown>, status = 200) { return NextResponse.json(body, { status, headers }); }
function sameOrigin(request: NextRequest) { const origin = request.headers.get("origin"); if (!origin) return true; try { return new URL(origin).host === request.nextUrl.host; } catch { return false; } }
function clean(value: unknown, max = 500) { return typeof value === "string" ? value.trim().slice(0, max) : ""; }
function path(id: string) { return `${PREFIX}${id}.json`; }
async function read<T>(pathname: string): Promise<T | null> { try { const item = await get(pathname, { access: "private", useCache: false }); return item?.statusCode === 200 && item.stream ? JSON.parse(await new Response(item.stream).text()) as T : null; } catch { return null; } }
async function save(row: ComplaintCase) { await put(path(row.id), JSON.stringify(row), { access: "private", contentType: "application/json", addRandomSuffix: false, allowOverwrite: true, cacheControlMaxAge: 0 }); return row; }

function issueFor(stage: string, updates: any[]) {
  const latest = updates.at(-1) || {};
  const source = `${stage} ${latest.title || ""} ${latest.note || ""}`.toLowerCase();
  if (/failed|reject|unsuccessful|undeliver/.test(source)) return "Failed delivery disputed by customer";
  if (/return/.test(source)) return "Return started despite customer expectation";
  if (/out_for_delivery/.test(source)) return "Out for delivery requires courier follow-up";
  return "Courier delivery investigation request";
}

function draftText(row: Pick<ComplaintCase, "tracking" | "courier" | "customer" | "issue" | "evidence">) {
  const latest = row.evidence.courierUpdates.at(-1);
  const courierLine = latest ? `The latest courier record is ${clean(latest.title, 160)}${latest.note ? `: ${clean(latest.note, 240)}` : ""}.` : "The courier movement record is attached.";
  const customerLine = row.evidence.customerReplyCount ? "The customer replied through our InfoTXT record and confirmed that the Lakatan parcel was expected." : "The order confirmation and available InfoTXT conversation are attached for review.";
  return `Request for investigation for ${row.courier || "the courier"} tracking number ${row.tracking}.\n\nIssue: ${row.issue}.\n${customerLine}\n${courierLine}\n\nPlease review the delivery attempt, confirm the accurate reason, and advise the next resolution. Attached are the order record, courier timeline, and customer conversation evidence.`;
}

export async function GET() {
  try {
    const result = await list({ prefix: PREFIX, limit: 500 });
    const rows = await Promise.all(result.blobs.map(blob => read<ComplaintCase>(blob.pathname)));
    return json({ cases: rows.filter((row): row is ComplaintCase => Boolean(row)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)) });
  } catch (error) { return json({ error: error instanceof Error ? error.message : "Courier complaints could not be loaded." }, 502); }
}

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return json({ error: "Request origin is not allowed." }, 403);
  let body: any; try { body = await request.json(); } catch { return json({ error: "Invalid request." }, 400); }
  if (body?.action === "create") {
    const order = body.order || {}; const orderId = clean(order.id, 80); const tracking = clean(order.tracking, 120);
    if (!/^[A-Za-z0-9_-]{1,80}$/.test(orderId) || !tracking) return json({ error: "A tracked order is required before a complaint case can be created." }, 400);
    const activity = body.activity || {}; const messages = Array.isArray(activity.messages) ? activity.messages.slice(-30).map((m: any) => ({ direction: clean(m.direction, 20), recipient: clean(m.recipient, 20), text: clean(m.text, 1500), time: clean(m.time, 80), status: clean(m.status, 30), eventLabel: clean(m.eventLabel, 120) })) : [];
    const courierUpdates = Array.isArray(order.courierUpdates) ? order.courierUpdates.slice(-30).map((m: any) => ({ title: clean(m.title, 180), note: clean(m.note, 400), at: clean(m.at, 80) })) : [];
    const deliveryEvents = Array.isArray(activity.deliveryEvents) ? activity.deliveryEvents.slice(-20).map((m: any) => ({ type: clean(m.type, 40), attempt: Number(m.attempt || 0), occurredAt: clean(m.occurredAt, 80), courierStatus: clean(m.courierStatus, 180), courierNote: clean(m.courierNote, 400), riderName: clean(m.riderName, 120), riderPhoneMasked: clean(m.riderPhoneMasked, 40) })) : [];
    const evidence = { messages, courierUpdates, deliveryEvents, customerReplyCount: messages.filter((m: any) => m.direction === "inbound").length };
    const now = new Date().toISOString();
    const row: ComplaintCase = { id: `CC-${now.slice(0, 10).replace(/-/g, "")}-${randomUUID().slice(0, 6).toUpperCase()}`, orderId, tracking, courier: clean(order.courier, 100) || "Courier", customer: clean(order.customer, 180) || "Customer", value: Math.max(0, Number(order.value || 0)), stage: clean(order.stage, 60), issue: clean(body.issue, 180) || issueFor(clean(order.stage, 60), courierUpdates), status: "draft", reference: "", internalNote: "", complaintText: "", createdAt: now, updatedAt: now, submittedAt: "", evidence };
    row.complaintText = draftText(row);
    await save(row); return json({ created: true, case: row }, 201);
  }
  if (body?.action === "update") {
    const id = clean(body.id, 80); if (!/^CC-[A-Z0-9-]+$/.test(id)) return json({ error: "Invalid complaint case." }, 400);
    const row = await read<ComplaintCase>(path(id)); if (!row) return json({ error: "Complaint case not found." }, 404);
    const status = clean(body.status, 40); if (status && !statuses.has(status)) return json({ error: "Invalid complaint status." }, 400);
    row.status = status || row.status; row.reference = clean(body.reference, 180); row.internalNote = clean(body.internalNote, 2000); row.updatedAt = new Date().toISOString();
    if (row.status === "submitted" && !row.submittedAt) row.submittedAt = row.updatedAt;
    await save(row); return json({ saved: true, case: row });
  }
  return json({ error: "Unknown action." }, 400);
}

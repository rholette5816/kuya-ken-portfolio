import { get, put } from "@vercel/blob";
import { NextRequest, NextResponse } from "next/server";

const PATHNAME = "ralph-cimeni/billing.json";
const COOKIE_NAME = "kra_os_access";
const CONFIDENTIAL_COOKIE = "rminds_confidential_access";

const installments = [
  { id: "m1-initial", dueDate: "2026-07-20", description: "Month 1 initial installment", amount: 30000 },
  { id: "m1-final", dueDate: "2026-08-05", description: "Month 1 final installment", amount: 30000 },
  { id: "m2-initial", dueDate: "2026-08-20", description: "Month 2 initial installment", amount: 30000 },
  { id: "m2-final", dueDate: "2026-09-05", description: "Month 2 final installment", amount: 30000 },
  { id: "m3-initial", dueDate: "2026-09-20", description: "Month 3 initial installment", amount: 30000 },
  { id: "m3-final", dueDate: "2026-10-05", description: "Month 3 final installment", amount: 30000 }
];

type Payment = { id: string; paidAt: string; method: string; reference: string; note: string; confirmedAt: string; receiptPath?: string; receiptType?: string };
type BillingRecord = { payments: Payment[]; updatedAt: string | null };

async function loadBilling(): Promise<BillingRecord> {
  const result = await get(PATHNAME, { access: "private", useCache: false });
  if (!result || result.statusCode !== 200 || !result.stream) return { payments: [], updatedAt: null };
  return JSON.parse(await new Response(result.stream).text()) as BillingRecord;
}

async function saveBilling(record: BillingRecord) {
  await put(PATHNAME, JSON.stringify(record), {
    access: "private",
    contentType: "application/json",
    addRandomSuffix: false,
    allowOverwrite: true,
    cacheControlMaxAge: 60
  });
}

function canManage(request: NextRequest) {
  const token = process.env.KRA_OS_ACCESS_TOKEN;
  return Boolean(token && request.cookies.get(COOKIE_NAME)?.value === token);
}

function canView(request: NextRequest) {
  const pin = process.env.RMINDS_CONFIDENTIAL_PIN;
  return Boolean(pin && request.cookies.get(CONFIDENTIAL_COOKIE)?.value === pin);
}

export async function GET(request: NextRequest) {
  if (!canView(request)) return NextResponse.json({ error: "Access denied." }, { status: 401 });
  const billing = await loadBilling();
  return NextResponse.json({ installments, payments: billing.payments.map(payment => ({ ...payment, receiptPath: undefined, receiptType: undefined, hasReceipt: Boolean(payment.receiptPath) })), updatedAt: billing.updatedAt, canManage: canManage(request) }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  if (!canView(request)) return NextResponse.json({ error: "Access denied." }, { status: 401 });
  if (Number(request.headers.get("content-length") || 0) > 3_500_000) return NextResponse.json({ error: "Payment proof is too large." }, { status: 413 });
  const body = await request.json();
  if (!installments.some(item => item.id === body.id)) return NextResponse.json({ error: "Unknown installment." }, { status: 400 });
  const billing = await loadBilling();
  if (body.action === "receipt") {
    const match = typeof body.receipt === "string" ? body.receipt.match(/^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/) : null;
    if (!match) return NextResponse.json({ error: "Upload a JPG, PNG, or WebP screenshot." }, { status: 400 });
    const bytes = Buffer.from(match[2], "base64");
    if (!bytes.length || bytes.length > 2_400_000) return NextResponse.json({ error: "Payment proof must be smaller than 2.4 MB." }, { status: 413 });
    const extension = match[1] === "jpeg" ? "jpg" : match[1];
    const receiptPath = `ralph-cimeni/billing-receipts/${body.id}.${extension}`;
    await put(receiptPath, bytes, { access: "private", contentType: `image/${match[1]}`, addRandomSuffix: false, allowOverwrite: true, cacheControlMaxAge: 60 });
    const existing = billing.payments.find(item => item.id === body.id);
    const manilaDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
    const payment: Payment = { id: body.id, paidAt: existing?.paidAt || manilaDate, method: existing?.method || "Payment proof uploaded", reference: existing?.reference || "", note: existing?.note || "Marked paid after receipt upload.", confirmedAt: new Date().toISOString(), receiptPath, receiptType: `image/${match[1]}` };
    billing.payments = [...billing.payments.filter(item => item.id !== body.id), payment];
  } else if (!canManage(request)) {
    return NextResponse.json({ error: "Administrator login required." }, { status: 401 });
  } else if (body.action === "clear") {
    billing.payments = billing.payments.filter(payment => payment.id !== body.id);
  } else if (body.action === "paid") {
    const paidAt = typeof body.paidAt === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.paidAt) ? body.paidAt : "";
    const method = typeof body.method === "string" ? body.method.trim().slice(0, 80) : "";
    const reference = typeof body.reference === "string" ? body.reference.trim().slice(0, 120) : "";
    const note = typeof body.note === "string" ? body.note.trim().slice(0, 300) : "";
    if (!paidAt || !method) return NextResponse.json({ error: "Payment date and method are required." }, { status: 400 });
    const payment: Payment = { id: body.id, paidAt, method, reference, note, confirmedAt: new Date().toISOString() };
    billing.payments = [...billing.payments.filter(item => item.id !== body.id), payment];
  } else {
    return NextResponse.json({ error: "Unknown billing action." }, { status: 400 });
  }
  billing.updatedAt = new Date().toISOString();
  await saveBilling(billing);
  return NextResponse.json({ ok: true, paid: body.action === "receipt" });
}

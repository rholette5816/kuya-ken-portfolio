import { get } from "@vercel/blob";
import { NextRequest, NextResponse } from "next/server";

const BILLING_PATH = "ralph-cimeni/billing.json";
const CONFIDENTIAL_COOKIE = "rminds_confidential_access";

type Payment = { id: string; receiptPath?: string; receiptType?: string };
type BillingRecord = { payments: Payment[] };

function canView(request: NextRequest) {
  const pin = process.env.RMINDS_CONFIDENTIAL_PIN;
  return Boolean(pin && request.cookies.get(CONFIDENTIAL_COOKIE)?.value === pin);
}

export async function GET(request: NextRequest) {
  if (!canView(request)) return new NextResponse("Access denied.", { status: 401 });
  const id = request.nextUrl.searchParams.get("id") || "";
  if (!/^[a-z0-9-]+$/.test(id)) return new NextResponse("Invalid receipt.", { status: 400 });
  const billingResult = await get(BILLING_PATH, { access: "private", useCache: false });
  if (!billingResult || billingResult.statusCode !== 200 || !billingResult.stream) return new NextResponse("Receipt not found.", { status: 404 });
  const billing = JSON.parse(await new Response(billingResult.stream).text()) as BillingRecord;
  const payment = billing.payments.find(item => item.id === id);
  if (!payment?.receiptPath) return new NextResponse("Receipt not found.", { status: 404 });
  const receipt = await get(payment.receiptPath, { access: "private", useCache: false });
  if (!receipt || receipt.statusCode !== 200 || !receipt.stream) return new NextResponse("Receipt not found.", { status: 404 });
  return new Response(receipt.stream, { headers: { "Content-Type": payment.receiptType || "image/jpeg", "Cache-Control": "private, no-store" } });
}

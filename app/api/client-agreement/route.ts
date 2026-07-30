import { createHash, randomBytes, randomUUID } from "node:crypto";
import { get, put } from "@vercel/blob";
import { NextRequest, NextResponse } from "next/server";

const VERSION = "2026-07-18-v1";
const MAX_BODY_BYTES = 4_500_000;
const CONFIDENTIAL_COOKIE = "rminds_confidential_access";

function canView(request: NextRequest) {
  const pin = process.env.RMINDS_CONFIDENTIAL_PIN;
  return Boolean(pin && request.cookies.get(CONFIDENTIAL_COOKIE)?.value === pin);
}

type RecordData = {
  token: string;
  recordId: string;
  status: "awaiting_client" | "executed";
  agreementVersion: string;
  createdAt: string;
  signedAt?: string;
  clientName: string;
  advertiserName: string;
  advertiserSignature: string;
  advertiserId: string;
  clientId: string;
  clientSignature?: string;
  sha256?: string;
};

function image(value: unknown, kind: "signature" | "id"): string | null {
  if (typeof value !== "string") return null;
  const pattern = kind === "signature" ? /^data:image\/png;base64,[A-Za-z0-9+/=]+$/ : /^data:image\/(jpeg|png);base64,[A-Za-z0-9+/=]+$/;
  if (!pattern.test(value) || value.length > (kind === "signature" ? 700_000 : 1_600_000)) return null;
  return value;
}

function pathname(token: string) {
  return `ralph-cimeni/${token}.json`;
}

async function loadRecord(token: string): Promise<RecordData | null> {
  if (!/^[a-f0-9]{48}$/.test(token)) return null;
  const result = await get(pathname(token), { access: "private", useCache: false });
  if (!result || result.statusCode !== 200 || !result.stream) return null;
  return JSON.parse(await new Response(result.stream).text()) as RecordData;
}

async function saveRecord(record: RecordData) {
  await put(pathname(record.token), JSON.stringify(record), {
    access: "private",
    contentType: "application/json",
    addRandomSuffix: false,
    allowOverwrite: true,
    cacheControlMaxAge: 60
  });
}

export async function GET(request: NextRequest) {
  if (!canView(request)) return NextResponse.json({ error: "Access denied." }, { status: 401 });
  const record = await loadRecord(request.nextUrl.searchParams.get("token") || "");
  if (!record) return NextResponse.json({ error: "Signing request not found." }, { status: 404 });
  return NextResponse.json(record, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  if (!canView(request)) return NextResponse.json({ error: "Access denied." }, { status: 401 });
  if (Number(request.headers.get("content-length") || 0) > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Agreement submission is too large." }, { status: 413 });
  }
  const body = await request.json();
  if (body.companyWebsite) return NextResponse.json({ ok: true });
  if (body.action === "create") {
    const advertiserSignature = image(body.advertiserSignature, "signature");
    const advertiserId = image(body.advertiserId, "id");
    const clientId = image(body.clientId, "id");
    if (body.advertiserName?.trim().toLowerCase() !== "kevin rholette allego" || body.agreementVersion !== VERSION || !advertiserSignature || !advertiserId || !clientId || body.consent !== true) {
      return NextResponse.json({ error: "Kevin's signature, both IDs, and consent are required." }, { status: 400 });
    }
    const token = randomBytes(24).toString("hex");
    const record: RecordData = {
      token,
      recordId: `RCA-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${randomUUID().slice(0, 8).toUpperCase()}`,
      status: "awaiting_client",
      agreementVersion: VERSION,
      createdAt: new Date().toISOString(),
      clientName: "Rye Chintzy Cimeni",
      advertiserName: "Kevin Rholette Allego",
      advertiserSignature,
      advertiserId,
      clientId
    };
    await saveRecord(record);
    const signingUrl = `https://www.kradigital.site/clients/ralph-cimeni?sign=${token}#agreement`;
    return NextResponse.json({ ok: true, status: record.status, recordId: record.recordId, signingUrl });
  }

  if (body.action === "complete") {
    const record = await loadRecord(String(body.token || ""));
    const clientSignature = image(body.clientSignature, "signature");
    if (!record || record.status !== "awaiting_client" || body.clientName?.trim().toLowerCase() !== "rye chintzy cimeni" || !clientSignature || body.consent !== true) {
      return NextResponse.json({ error: "Rye's signing request or signature is incomplete." }, { status: 400 });
    }
    record.clientSignature = clientSignature;
    record.signedAt = new Date().toISOString();
    record.status = "executed";
    record.sha256 = createHash("sha256").update([record.recordId, record.signedAt, record.advertiserSignature, clientSignature, record.advertiserId, record.clientId].join("|")).digest("hex");
    await saveRecord(record);
    return NextResponse.json({ ok: true, record });
  }

  return NextResponse.json({ error: "Unknown agreement action." }, { status: 400 });
}

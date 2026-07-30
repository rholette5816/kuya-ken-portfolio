import { get, put } from "@vercel/blob";
import { NextRequest, NextResponse } from "next/server";

function validToken(token: string) {
  return /^[a-f0-9]{48}$/.test(token);
}

async function agreementExists(token: string) {
  if (!validToken(token)) return false;
  const result = await get(`ralph-cimeni/${token}.json`, { access: "private", useCache: false });
  return Boolean(result?.statusCode === 200);
}

async function load(token: string) {
  const result = await get(`ralph-cimeni/onboarding/${token}.json`, { access: "private", useCache: false });
  if (!result || result.statusCode !== 200 || !result.stream) return { answers: {}, status: "draft", updatedAt: null };
  return JSON.parse(await new Response(result.stream).text());
}

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token") || "";
  if (!(await agreementExists(token))) return NextResponse.json({ error: "A valid private client link is required." }, { status: 401 });
  return NextResponse.json(await load(token), { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const token = typeof body.token === "string" ? body.token : "";
  if (!(await agreementExists(token))) return NextResponse.json({ error: "A valid private client link is required." }, { status: 401 });
  if (!body.answers || typeof body.answers !== "object" || JSON.stringify(body.answers).length > 1_800_000) {
    return NextResponse.json({ error: "The onboarding submission is invalid or too large." }, { status: 400 });
  }
  const record = { answers: body.answers, status: body.status === "submitted" ? "submitted" : "draft", updatedAt: new Date().toISOString() };
  await put(`ralph-cimeni/onboarding/${token}.json`, JSON.stringify(record), { access: "private", contentType: "application/json", addRandomSuffix: false, allowOverwrite: true, cacheControlMaxAge: 60 });
  return NextResponse.json({ ok: true, status: record.status, updatedAt: record.updatedAt });
}

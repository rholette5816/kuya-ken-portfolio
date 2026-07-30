import { get, put } from "@vercel/blob";
import OpenAI from "openai";
import { NextRequest, NextResponse } from "next/server";
import { AdvertisingClientConfig, getAdvertisingClientConfig, validClientSession } from "@/lib/advertising-client-config";

async function validClientToken(token: string, config: AdvertisingClientConfig) {
  if (validClientSession(token, config.slug)) return true;
  if (config.slug !== "rminds") return false;
  if (!/^[a-f0-9]{48}$/.test(token)) return false;
  const result = await get(`${config.storagePrefix}/${token}.json`, { access: "private", useCache: false });
  return Boolean(result?.statusCode === 200);
}

async function loadLatest(config: AdvertisingClientConfig) {
  const result = await get(`${config.storagePrefix}/analysis-summary-latest.json`, { access: "private", useCache: false });
  if (!result || result.statusCode !== 200 || !result.stream) return null;
  return JSON.parse(await new Response(result.stream).text());
}

export async function GET(request: NextRequest) {
  const config = await getAdvertisingClientConfig(request.nextUrl.searchParams.get("client") || "rminds");
  if (!config) return NextResponse.json({ error: "Advertising client not found." }, { status: 404 });
  const token = request.nextUrl.searchParams.get("token") || "";
  if (!(await validClientToken(token, config))) return NextResponse.json({ error: "A valid private client link is required." }, { status: 401 });
  return NextResponse.json({ report: await loadLatest(config) }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  const config = await getAdvertisingClientConfig(request.nextUrl.searchParams.get("client") || "rminds");
  if (!config) return NextResponse.json({ error: "Advertising client not found." }, { status: 404 });
  const token = request.nextUrl.searchParams.get("token") || "";
  if (!(await validClientToken(token, config))) return NextResponse.json({ error: "A valid private client link is required." }, { status: 401 });
  if (!process.env.OPENAI_API_KEY) return NextResponse.json({ error: "OpenAI is not configured." }, { status: 503 });

  const body = await request.json().catch(() => null);
  const data = body?.data;
  if (!data || JSON.stringify(data).length > 80_000) return NextResponse.json({ error: "The analysis data is invalid or too large." }, { status: 400 });

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const instructions = `You are a senior Meta media buyer preparing a concise performance report for a Philippine multi-brand business.
Use only the supplied data. Never invent sales, revenue, actions, causes, or campaign changes.
Write in direct, plain English without marketing jargon. PHP values use the peso symbol.
Separate facts from recommendations. If data is insufficient, say so.
Classify performance using the actual objective and results supplied, not clicks alone.
Explain how spend produced attention through reach, impressions, frequency, clicks, engagement, and video activity. Clearly say that attention does not prove bookings, transactions, or revenue.
Analyze the supplied weekly gross revenue records separately from Meta results. Compare revenue with ad spend only as a directional relationship. Never claim that ads caused revenue unless the supplied data proves attribution.
Use the supplied target ad-spend percentage, target budgets, and budget differences when discussing budgeting. Treat them as planning limits, not automatic instructions to increase spend.
The "work completed this week" section must use only the supplied recorded changes. Explain that these are dashboard-recorded Meta changes when appropriate.

Return plain text with exactly these headings:
EXECUTIVE SUMMARY
WHAT WAS DONE THIS WEEK
ATTENTION AND REACH
BUSINESS RESULTS
WHAT WORKED
WHAT HAS POTENTIAL
WHAT IS NOT WORKING
BUDGET RECOMMENDATIONS
NEXT ACTIONS

Use short bullets under every heading. Include brand names and key numbers where useful. Keep the whole report under 900 words.`;

  try {
    const response = await openai.responses.create({
      model: process.env.OPENAI_ANALYSIS_MODEL || "gpt-4.1-mini",
      instructions,
      input: `Analyze this advertising data:\n${JSON.stringify(data)}`
    });
    const text = response.output_text?.trim();
    if (!text) throw new Error("OpenAI returned an empty report.");
    const report = {
      text,
      generatedAt: new Date().toISOString(),
      dateFrom: String(data.dateFrom || ""),
      dateTo: String(data.dateTo || ""),
      business: String(data.business || "Overall ad account")
    };
    await put(`${config.storagePrefix}/analysis-summary-latest.json`, JSON.stringify(report), { access: "private", contentType: "application/json", addRandomSuffix: false, allowOverwrite: true, cacheControlMaxAge: 60 });
    return NextResponse.json({ report }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "The analysis could not be generated." }, { status: 502 });
  }
}

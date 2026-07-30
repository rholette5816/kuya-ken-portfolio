import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { getAdvertisingClientConfig, publicClientConfig } from "@/lib/advertising-client-config";

export const sectionRoutes: Record<string, string> = {
  audit: "overview",
  evidence: "creatives",
  plan: "execution",
  agreement: "agreement",
  billing: "billing",
  onboarding: "onboarding",
  live: "ad-operations-structure",
  inputs: "ad-operations-inputs",
  budget: "ad-operations-budget",
  spend: "ad-operations-spending",
  analyze: "ad-operations-analysis",
  report: "ad-operations-creatives",
  approve: "ad-operations-approvals",
  log: "ad-operations-changes"
};

export async function dashboardResponse(initialRoute = "ad-operations-structure") {
  const token = process.env.RMINDS_CLIENT_SIGN_TOKEN;
  if (!token) return new Response("RMINDS dashboard access is not configured.", { status: 503 });
  const config = await getAdvertisingClientConfig("rminds");
  if (!config) return new Response("RMINDS client configuration is missing.", { status: 503 });

  const dashboardPath = path.join(process.cwd(), "public", "client-dashboards", "ralph-cimeni", "index.html");
  const dashboard = await readFile(dashboardPath, "utf8");
  const bootstrap = JSON.stringify({ token, initialRoute, basePath: "/rminds", apiClient: "rminds", config: publicClientConfig(config) }).replace(/</g, "\\u003c");
  const sessionScript = `<script>window.__CLIENT_DASHBOARD__=${bootstrap};window.__RMINDS_SIGN_TOKEN=window.__CLIENT_DASHBOARD__.token;window.__RMINDS_INITIAL_ROUTE=window.__CLIENT_DASHBOARD__.initialRoute;</script>`;
  const response = new NextResponse(dashboard.replace("</head>", `${sessionScript}</head>`), {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "private, no-store, max-age=0",
      "X-Robots-Tag": "noindex, nofollow, noarchive",
      "Referrer-Policy": "no-referrer"
    }
  });
  response.cookies.set("rminds_confidential_access", "", { path: "/", maxAge: 0 });
  return response;
}

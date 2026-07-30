import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { createClientSession, getAdvertisingClientConfig, publicClientConfig } from "@/lib/advertising-client-config";

const sectionRoutes: Record<string, string> = {
  live: "ad-operations-structure",
  inputs: "ad-operations-inputs",
  budget: "ad-operations-budget",
  spend: "ad-operations-spending",
  analyze: "ad-operations-analysis",
  report: "ad-operations-creatives",
  approve: "ad-operations-approvals",
  log: "ad-operations-changes",
  onboarding: "onboarding",
  billing: "billing",
  agreement: "agreement"
};

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest, context: { params: Promise<{ client: string; section?: string[] }> }) {
  const { client, section = [] } = await context.params;
  const config = await getAdvertisingClientConfig(client);
  if (!config) return new Response("Advertising client not found.", { status: 404 });
  const dashboardPath = path.join(process.cwd(), "public", "client-dashboards", "ralph-cimeni", "index.html");
  let dashboard = await readFile(dashboardPath, "utf8");
  const token = createClientSession(config.slug);
  const initialRoute = sectionRoutes[section[0] || "live"] || "ad-operations-structure";
  const bootstrap = {
    token,
    initialRoute,
    basePath: `/dashboards/${config.slug}`,
    apiClient: config.slug,
    config: publicClientConfig(config)
  };
  const script = `<script>window.__CLIENT_DASHBOARD__=${JSON.stringify(bootstrap).replace(/</g, "\\u003c")};window.__RMINDS_SIGN_TOKEN=window.__CLIENT_DASHBOARD__.token;window.__RMINDS_INITIAL_ROUTE=window.__CLIENT_DASHBOARD__.initialRoute;</script>`;
  const initials = config.organizationName.split(/\s+/).map(word => word[0]).join("").slice(0, 2).toUpperCase();
  dashboard = dashboard
    .replace("<title>RMINDS BUSINESSES | Growth Operations</title>", `<title>${config.organizationName} | Growth Operations</title>`)
    .replaceAll("RMINDS BUSINESSES", config.organizationName)
    .replace("Seven businesses", config.portfolioLabel)
    .replaceAll('<span class="brand-mark">RM</span>', `<span class="brand-mark">${initials}</span>`)
    .replaceAll('<div class="analysis-print-logo">RM</div>', `<div class="analysis-print-logo">${initials}</div>`)
    .replace("</head>", `${script}</head>`);
  if (!config.modules.historicalPlanning) dashboard = dashboard.replace('<details class="nav-group" open>', '<details class="nav-group" hidden>');
  if (!config.modules.agreement) dashboard = dashboard.replace('data-view="agreement"', 'data-view="agreement" hidden');
  if (!config.modules.billing) dashboard = dashboard.replace('data-view="billing"', 'data-view="billing" hidden');
  if (!config.modules.onboarding) dashboard = dashboard.replace('data-view="onboarding"', 'data-view="onboarding" hidden');
  if (!config.modules.creativeApprovals) dashboard = dashboard.replace('data-adops-nav="approvals"', 'data-adops-nav="approvals" hidden');
  return new NextResponse(dashboard, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "private, no-store, max-age=0",
      "X-Robots-Tag": "noindex, nofollow, noarchive",
      "Referrer-Policy": "no-referrer"
    }
  });
}

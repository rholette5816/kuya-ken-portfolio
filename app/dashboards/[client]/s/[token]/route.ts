import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { getAdvertisingClientConfig, publicClientConfig } from "@/lib/advertising-client-config";
import { PANEL_TABS, SHAREABLE_PANELS, resolveShare } from "@/lib/client-shares";

export const dynamic = "force-dynamic";

const PANEL_ROUTE: Record<string, string> = {
  structure: "ad-operations-structure",
  inputs: "ad-operations-inputs",
  budget: "ad-operations-budget",
  spending: "ad-operations-spending",
  analysis: "ad-operations-analysis",
  creatives: "ad-operations-creatives",
  videoranking: "ad-operations-videoranking",
  changes: "ad-operations-changes"
};

function expired(message: string) {
  return new NextResponse(
    `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">`
    + `<title>Link unavailable</title>`
    + `<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f4f6f7;`
    + `font-family:Inter,Arial,sans-serif;color:#18222b}div{max-width:420px;padding:40px;background:#fff;`
    + `border:1px solid #dbe1e5;border-radius:6px;text-align:center}h1{font-size:19px;margin:0 0 10px}`
    + `p{margin:0;color:#68747f;font-size:13px;line-height:1.6}</style>`
    + `<div><h1>This link is no longer available</h1><p>${message}</p></div>`,
    { status: 404, headers: { "Content-Type": "text/html; charset=utf-8", "X-Robots-Tag": "noindex, nofollow" } }
  );
}

export async function GET(_request: NextRequest, context: { params: Promise<{ client: string; token: string }> }) {
  const { client, token } = await context.params;
  const config = await getAdvertisingClientConfig(client);
  if (!config) return expired("The report could not be found.");

  const share = await resolveShare(config, token);
  if (!share) return expired("The person who sent it may have revoked it, or it may have expired.");

  const dashboardPath = path.join(process.cwd(), "public", "client-dashboards", "ralph-cimeni", "index.html");
  let dashboard = await readFile(dashboardPath, "utf8");

  const scopedConfig = publicClientConfig(config);
  if (share.brand) {
    scopedConfig.brands = scopedConfig.brands.filter(brand => brand.name === share.brand);
  }
  // A share recipient must never be offered modules they cannot open.
  scopedConfig.modules = { historicalPlanning: false, agreement: false, billing: false, onboarding: false, creativeApprovals: false };

  const bootstrap = {
    token: `share:${share.token}`,
    initialRoute: PANEL_ROUTE[share.panel],
    basePath: `/dashboards/${config.slug}/s/${share.token}`,
    apiClient: config.slug,
    config: scopedConfig,
    share: {
      panel: share.panel,
      panelLabel: SHAREABLE_PANELS[share.panel],
      brand: share.brand,
      from: share.from,
      to: share.to,
      label: share.label,
      view: share.view || {},
      tab: share.tab || null,
      tabAttribute: PANEL_TABS[share.panel],
      organization: config.organizationName
    }
  };

  const script = `<script>window.__CLIENT_DASHBOARD__=${JSON.stringify(bootstrap).replace(/</g, "\\u003c")};`
    + `window.__RMINDS_SIGN_TOKEN=window.__CLIENT_DASHBOARD__.token;`
    + `window.__RMINDS_INITIAL_ROUTE=window.__CLIENT_DASHBOARD__.initialRoute;`
    + `window.__SHARED_VIEW__=window.__CLIENT_DASHBOARD__.share;</script>`;

  const heading = share.brand ? `${share.brand} &middot; ${SHAREABLE_PANELS[share.panel]}` : SHAREABLE_PANELS[share.panel];

  dashboard = dashboard
    .replace("<title>RMINDS BUSINESSES | Growth Operations</title>", `<title>${config.organizationName} | ${SHAREABLE_PANELS[share.panel]}</title>`)
    .replaceAll("RMINDS BUSINESSES", config.organizationName)
    .replace("Seven businesses", config.portfolioLabel)
    .replace("Growth &amp; advertising operations", heading)
    // Strip the entire navigation server-side. Hiding it in CSS would still
    // ship the markup and the other panels' controls to the recipient.
    .replace(/<aside class="sidebar">[\s\S]*?<\/aside>/, "")
    .replace("</head>", `${script}<style>main{margin-left:0}.top-actions{display:none}</style></head>`);

  return new NextResponse(dashboard, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "private, no-store, max-age=0",
      "X-Robots-Tag": "noindex, nofollow, noarchive",
      "Referrer-Policy": "no-referrer"
    }
  });
}

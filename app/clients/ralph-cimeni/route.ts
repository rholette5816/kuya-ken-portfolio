import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

export const dynamic = "force-static";

export async function GET() {
  const dashboardPath = path.join(
    process.cwd(),
    "public",
    "client-dashboards",
    "ralph-cimeni",
    "index.html"
  );
  const dashboard = await readFile(dashboardPath, "utf8");

  const response = new NextResponse(dashboard, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=0, must-revalidate"
    }
  });
  response.cookies.set("rminds_confidential_access", "", { path: "/", maxAge: 0 });
  return response;
}

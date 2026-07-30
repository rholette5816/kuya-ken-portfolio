import { NextRequest } from "next/server";
import { dashboardResponse, sectionRoutes } from "./dashboard";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const section = request.nextUrl.searchParams.get("section") || "";
  return dashboardResponse(sectionRoutes[section] || "ad-operations-structure");
}

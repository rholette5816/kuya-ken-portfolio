import { NextRequest, NextResponse } from "next/server";
import { getAdvertisingClientConfig, validClientSession } from "@/lib/advertising-client-config";
import { SHAREABLE_PANELS, createShare, listShares, revokeShare, shareIsUsable } from "@/lib/client-shares";
import { authorizeClientRequest } from "@/lib/client-auth";

/**
 * Only a full dashboard session may mint or revoke share links. A share token
 * can never create another share, otherwise a recipient could widen their own
 * access.
 */
async function requireSession(request: NextRequest) {
  const config = await getAdvertisingClientConfig(request.nextUrl.searchParams.get("client") || "rminds");
  if (!config) return { error: NextResponse.json({ error: "Advertising client not found." }, { status: 404 }) };
  const token = request.nextUrl.searchParams.get("token") || "";
  if (token.startsWith("share:")) {
    return { error: NextResponse.json({ error: "A shared link cannot create share links." }, { status: 403 }) };
  }
  const access = await authorizeClientRequest(token, config, "client-share");
  if (!access || access.kind !== "session") {
    return { error: NextResponse.json({ error: "A valid private client link is required." }, { status: 401 }) };
  }
  return { config };
}

function shareUrl(request: NextRequest, slug: string, token: string) {
  return `${request.nextUrl.origin}/dashboards/${slug}/s/${token}`;
}

export async function GET(request: NextRequest) {
  const { config, error } = await requireSession(request);
  if (error) return error;
  const shares = (await listShares(config!)).filter(item => !item.revokedAt);
  return NextResponse.json({
    panels: SHAREABLE_PANELS,
    shares: shares.map(item => ({
      ...item,
      url: shareUrl(request, config!.slug, item.token),
      active: shareIsUsable(item)
    }))
  }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  const { config, error } = await requireSession(request);
  if (error) return error;
  let body: any = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  try {
    const record = await createShare(config!, {
      panel: body.panel,
      brand: body.brand ?? null,
      from: body.from ?? null,
      to: body.to ?? null,
      label: body.label,
      expiresInDays: body.expiresInDays ?? null
    });
    return NextResponse.json(
      { share: { ...record, url: shareUrl(request, config!.slug, record.token) } },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Could not create the link." }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest) {
  const { config, error } = await requireSession(request);
  if (error) return error;
  const token = request.nextUrl.searchParams.get("share") || "";
  const revoked = await revokeShare(config!, token);
  if (!revoked) return NextResponse.json({ error: "That link no longer exists." }, { status: 404 });
  return NextResponse.json({ revoked: true }, { headers: { "Cache-Control": "no-store" } });
}

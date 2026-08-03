import { get } from "@vercel/blob";
import { AdvertisingClientConfig, validClientSession } from "@/lib/advertising-client-config";
import { ShareRecord, resolveShare, shareAllowsEndpoint } from "@/lib/client-shares";

export const SHARE_PREFIX = "share:";

export type ClientAccess =
  | { kind: "session" }
  | { kind: "share"; share: ShareRecord };

/**
 * Authorizes a dashboard data request.
 *
 * `endpoint` is the API folder name (for example "client-video-ranking"). A
 * share token only passes when its panel is allowed to reach that endpoint,
 * so a link shared for one panel cannot be replayed against another.
 *
 * Returns null when the caller has no valid access.
 */
export async function authorizeClientRequest(
  token: string,
  config: AdvertisingClientConfig,
  endpoint: string
): Promise<ClientAccess | null> {
  if (!token) return null;

  if (token.startsWith(SHARE_PREFIX)) {
    const share = await resolveShare(config, token.slice(SHARE_PREFIX.length));
    if (!share || !shareAllowsEndpoint(share, endpoint)) return null;
    return { kind: "share", share };
  }

  if (validClientSession(token, config.slug)) return { kind: "session" };

  // Legacy long-lived private links, RMINDS only.
  if (config.slug === "rminds" && /^[a-f0-9]{48}$/.test(token)) {
    const result = await get(`${config.storagePrefix}/${token}.json`, { access: "private", useCache: false });
    if (result?.statusCode === 200) return { kind: "session" };
  }

  return null;
}

/** True when the caller must only ever see a single brand's data. */
export function scopedBrand(access: ClientAccess) {
  return access.kind === "share" ? access.share.brand : null;
}

export function scopedRange(access: ClientAccess) {
  if (access.kind !== "share") return { from: null, to: null };
  return { from: access.share.from, to: access.share.to };
}

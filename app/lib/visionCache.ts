// Tiny in-memory TTL cache with stale-while-revalidate for the Vision x Saha
// live dashboard. The dashboard polls every 20-60s, which keeps the serverless
// instance warm, so a module-level cache shares upstream fetches across polls
// and across the /live and /orders routes.
//
// Behavior:
// - Fresh (within TTL): return the cached value immediately, no upstream call.
// - Stale (past TTL): return the stale value immediately AND refresh in the
//   background, so the next poll gets fresh data without anyone waiting.
// - Cold (nothing cached): await the loader once.
//
// shouldCache lets callers skip caching failure results (e.g. a provider that
// returned connected:false), so a transient error is retried on the next poll
// instead of being pinned for the whole TTL.

type Entry<T> = { value: T; expires: number; refreshing: boolean };

const store = new Map<string, Entry<unknown>>();

export async function cached<T>(
  key: string,
  ttlMs: number,
  loader: () => Promise<T>,
  shouldCache: (value: T) => boolean = () => true
): Promise<T> {
  const now = Date.now();
  const hit = store.get(key) as Entry<T> | undefined;

  if (hit) {
    if (now < hit.expires) return hit.value;
    if (!hit.refreshing) {
      hit.refreshing = true;
      loader()
        .then(value => {
          if (shouldCache(value)) store.set(key, { value, expires: Date.now() + ttlMs, refreshing: false });
          else store.delete(key);
        })
        .catch(() => {
          hit.refreshing = false;
        });
    }
    return hit.value;
  }

  const value = await loader();
  if (shouldCache(value)) store.set(key, { value, expires: now + ttlMs, refreshing: false });
  return value;
}

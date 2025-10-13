
/**
 * Simple in-memory TTL cache with deduped inflight operations.
 * Use for hot-path API results (tickets, stats) and external data (students).
 * Adds minimal debug logs to validate runtime behavior; remove after verification.
 */

const store = new Map(); // key -> { value, expiresAt, inflight: Promise<any> | null }

function now() {
  return Date.now();
}

export function getCache(key) {
  const entry = store.get(key);
  if (!entry) return null;
  if (entry.expiresAt && entry.expiresAt <= now()) {
    // Minimal log to detect unexpected churn
    console.log("[lib/cache] EXPIRED", key);
    store.delete(key);
    return null;
  }
  return entry.value;
}

export function setCache(key, value, ttlMs) {
  const expiresAt = ttlMs ? now() + ttlMs : 0;
  store.set(key, { value, expiresAt, inflight: null });
  console.log("[lib/cache] SET", key, "ttlMs=", ttlMs);
  return value;
}

export function delCache(key) {
  store.delete(key);
  console.log("[lib/cache] DEL", key);
}

export async function wrapCache(key, ttlMs, fn) {
  const t = now();
  const entry = store.get(key);
  if (entry && (!entry.expiresAt || entry.expiresAt > t) && entry.value !== undefined && entry.value !== null) {
    console.log("[lib/cache] HIT", key);
    return entry.value;
  }
  if (entry?.inflight) {
    console.log("[lib/cache] JOIN", key);
    try {
      return await entry.inflight;
    } catch (e) {
      console.warn("[lib/cache] inflight failed; retrying", key, e?.message || e);
      // fall through and retry
    }
  }
  console.log("[lib/cache] MISS", key);
  const inflight = (async () => {
    try {
      const value = await fn();
      setCache(key, value, ttlMs);
      return value;
    } finally {
      const existing = store.get(key);
      if (existing) {
        existing.inflight = null;
      }
    }
  })();
  store.set(key, { value: entry?.value ?? null, expiresAt: entry?.expiresAt ?? 0, inflight });
  return inflight;
}

// Optional: quick stats for debugging
export function cacheStats() {
  let valid = 0;
  let expired = 0;
  const t = now();
  for (const [, v] of store) {
    if (!v.expiresAt || v.expiresAt > t) valid++;
    else expired++;
  }
  return { size: store.size, valid, expired };
}

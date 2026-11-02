import { MOBILE_RATE_LIMIT } from "./constants";

type CacheEntry = { value: unknown; expiresAt: number };

export type MobileCache = {
  get<T>(key: string, now?: number): T | undefined;
  set<T>(key: string, value: T, ttlMs: number, now?: number): void;
  run<T>(key: string, ttlMs: number, load: () => Promise<T>, now?: number): Promise<T>;
  clear(): void;
  readonly size: number;
};

/**
 * A small bounded cache for one Worker isolate. CDN caching is handled by
 * response headers and, when available, Cloudflare's Cache API. This map only
 * avoids duplicate TMDB work within a warm isolate.
 */
export function createMobileCache(maxEntries = 300): MobileCache {
  const entries = new Map<string, CacheEntry>();
  const inFlight = new Map<string, Promise<unknown>>();

  const purgeExpired = (now: number): void => {
    for (const [key, entry] of entries) {
      if (entry.expiresAt <= now) entries.delete(key);
    }
  };

  return {
    get<T>(key: string, now = Date.now()): T | undefined {
      const entry = entries.get(key);
      if (!entry) return undefined;
      if (entry.expiresAt <= now) {
        entries.delete(key);
        return undefined;
      }
      return entry.value as T;
    },

    set<T>(key: string, value: T, ttlMs: number, now = Date.now()): void {
      if (!Number.isFinite(ttlMs) || ttlMs <= 0) return;
      purgeExpired(now);
      while (entries.size >= Math.max(1, maxEntries)) {
        const oldest = entries.keys().next().value;
        if (oldest === undefined) break;
        entries.delete(oldest);
      }
      // Reinsert so the Map's insertion order acts as a simple LRU eviction order.
      entries.delete(key);
      entries.set(key, { value, expiresAt: now + ttlMs });
    },

    async run<T>(
      key: string,
      ttlMs: number,
      load: () => Promise<T>,
      now = Date.now(),
    ): Promise<T> {
      const cached = this.get<T>(key, now);
      if (cached !== undefined) return cached;

      const existing = inFlight.get(key) as Promise<T> | undefined;
      if (existing) return existing;

      const task = Promise.resolve()
        .then(load)
        .then((value) => {
          this.set(key, value, ttlMs);
          return value;
        })
        .finally(() => {
          inFlight.delete(key);
        });

      inFlight.set(key, task);
      return task;
    },

    clear(): void {
      entries.clear();
      inFlight.clear();
    },

    get size(): number {
      return entries.size;
    },
  };
}

export const mobileCache = createMobileCache(MOBILE_RATE_LIMIT.memoryMaxEntries);

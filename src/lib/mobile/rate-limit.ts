import { MOBILE_RATE_LIMIT } from "./constants";

export type HeaderReader = { get(name: string): string | null };

export type RateLimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAtSeconds: number;
  retryAfterSeconds: number;
};

export type MobileRateLimiter = {
  consume(key: string, cost?: number, now?: number): RateLimitResult;
  clear(): void;
  readonly size: number;
};

type Bucket = { tokens: number; lastMs: number };

/**
 * Cloudflare supplies CF-Connecting-IP at the edge. We deliberately do not
 * trust a caller-supplied X-Forwarded-For value as a rate-limit identity.
 */
export function clientKeyFromHeaders(headers: HeaderReader): string {
  const value = headers.get("cf-connecting-ip");
  if (!value) return "unknown";
  const safe = value.trim().slice(0, 128).replace(/[^A-Za-z0-9.:_-]/g, "");
  return safe || "unknown";
}

export function createRateLimiter(options?: {
  limit?: number;
  windowMs?: number;
  maxKeys?: number;
}): MobileRateLimiter {
  const limit = Math.max(1, options?.limit ?? MOBILE_RATE_LIMIT.limit);
  const windowMs = Math.max(1_000, options?.windowMs ?? MOBILE_RATE_LIMIT.windowMs);
  const maxKeys = Math.max(10, options?.maxKeys ?? MOBILE_RATE_LIMIT.maxKeys);
  const buckets = new Map<string, Bucket>();

  const evictOldKeys = (now: number): void => {
    if (buckets.size < maxKeys) return;
    for (const [key, bucket] of buckets) {
      if (now - bucket.lastMs > windowMs * 2) buckets.delete(key);
    }
    while (buckets.size >= maxKeys) {
      const oldest = buckets.keys().next().value;
      if (oldest === undefined) break;
      buckets.delete(oldest);
    }
  };

  return {
    consume(key: string, cost = 1, now = Date.now()): RateLimitResult {
      const requested = Math.max(1, Math.min(limit, Math.floor(cost)));
      const bucketKey = key.slice(0, 128) || "unknown";
      const bucket = buckets.get(bucketKey) ?? { tokens: limit, lastMs: now };

      const elapsed = Math.max(0, now - bucket.lastMs);
      bucket.tokens = Math.min(limit, bucket.tokens + (elapsed * limit) / windowMs);
      bucket.lastMs = now;

      const allowed = bucket.tokens >= requested;
      if (allowed) bucket.tokens -= requested;
      buckets.delete(bucketKey);
      buckets.set(bucketKey, bucket);
      evictOldKeys(now);

      const missingTokens = Math.max(0, requested - bucket.tokens);
      const retryAfterSeconds = Math.max(
        0,
        Math.ceil((missingTokens * windowMs) / limit / 1_000),
      );
      const refillMs = ((limit - bucket.tokens) * windowMs) / limit;

      return {
        allowed,
        limit,
        remaining: Math.max(0, Math.floor(bucket.tokens)),
        resetAtSeconds: Math.ceil((now + refillMs) / 1_000),
        retryAfterSeconds: allowed ? 0 : Math.max(1, retryAfterSeconds),
      };
    },

    clear(): void {
      buckets.clear();
    },

    get size(): number {
      return buckets.size;
    },
  };
}

export const mobileRateLimiter = createRateLimiter();

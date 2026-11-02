import {
  BROWSER_MAX_AGE,
  EDGE_STALE_IF_ERROR,
  EDGE_STALE_WHILE_REVALIDATE,
  MOBILE_API_KEY_HEADER,
  MOBILE_API_VERSION,
  MOBILE_CACHE_HEADER,
  MOBILE_CDN_CACHE_HEADER,
  TMDB_IMAGE_BASE_URL,
} from "./constants";
import { isMobileApiKeyEnabled, isMobileRequestAuthorized } from "./auth";
import { mobileCache } from "./cache";
import {
  badRequestError,
  clientUnauthorizedError,
  internalError,
  MobileError,
  serviceUnconfiguredError,
} from "./errors";
import { mobileRateLimiter, clientKeyFromHeaders, type RateLimitResult } from "./rate-limit";
import { getMobileTmdbToken } from "./tmdb";
import type { MobileFailure, MobileSuccess } from "./types";
import type { ValidationResult } from "./validation";

type EdgeCache = {
  match(request: Request): Promise<Response | undefined>;
  put(request: Request, response: Response): Promise<void>;
};

export type MobileEndpointOptions<P, T> = {
  parse: (params: URLSearchParams) => ValidationResult<P>;
  cacheKey: (params: P) => string;
  ttlSeconds: number | ((data: T) => number);
  rateLimitCost?: number;
  load: (params: P) => Promise<T>;
};

const RATE_HEADERS_TO_STRIP = [
  "x-ratelimit-limit",
  "x-ratelimit-remaining",
  "x-ratelimit-reset",
  "retry-after",
  MOBILE_CACHE_HEADER,
  MOBILE_CDN_CACHE_HEADER,
  "set-cookie",
];

function baseHeaders(): Headers {
  return new Headers({
    "Content-Type": "application/json; charset=utf-8",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "Allow": "GET, OPTIONS",
    "Vary": "Accept-Encoding",
  });
}

function cacheControl(ttlSeconds: number): string {
  return [
    "public",
    `max-age=${BROWSER_MAX_AGE}`,
    `s-maxage=${ttlSeconds}`,
    `stale-while-revalidate=${EDGE_STALE_WHILE_REVALIDATE}`,
    `stale-if-error=${EDGE_STALE_IF_ERROR}`,
  ].join(", ");
}

export function canonicalCacheUrl(cacheKey: string): string {
  const scope = isMobileApiKeyEnabled() ? "gated" : "public";
  const key = `mobile:${MOBILE_API_VERSION}:${scope}:${cacheKey}`;
  return `https://mobile-api.local/${encodeURIComponent(key)}`;
}

function getEdgeCache(): EdgeCache | null {
  try {
    const holder = globalThis as unknown as { caches?: { default?: EdgeCache } };
    return holder.caches?.default ?? null;
  } catch {
    return null;
  }
}

/**
 * Cloudflare Cache API and fetch() responses can have immutable headers. A
 * clone() preserves that guard, so rebuild the response before adding any
 * per-request headers.
 */
function responseWithMutableHeaders(response: Response): Response {
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: new Headers(response.headers),
  });
}

async function readEdgeCache(cacheKey: string): Promise<Response | null> {
  // A CDN cache hit would bypass the Worker-side app-key check. When the gate
  // is enabled, no shared/public cache is used at all.
  if (isMobileApiKeyEnabled()) return null;

  const cache = getEdgeCache();
  if (!cache) return null;
  try {
    const cached = await cache.match(new Request(canonicalCacheUrl(cacheKey)));
    if (!cached || !cached.ok) return null;
    if (!(cached.headers.get("content-type") ?? "").includes("application/json")) return null;
    return responseWithMutableHeaders(cached);
  } catch {
    return null;
  }
}

async function writeEdgeCache(cacheKey: string, response: Response): Promise<void> {
  if (isMobileApiKeyEnabled()) return;

  const cache = getEdgeCache();
  if (!cache || response.status !== 200) return;
  try {
    const clone = response.clone();
    const headers = new Headers(clone.headers);
    for (const header of RATE_HEADERS_TO_STRIP) headers.delete(header);
    const stored = new Response(clone.body, {
      status: clone.status,
      statusText: clone.statusText,
      headers,
    });
    await cache.put(new Request(canonicalCacheUrl(cacheKey)), stored);
  } catch {
    // A cache API failure must never turn a successful metadata response into an error.
  }
}

function applyRateHeaders(response: Response, rate: RateLimitResult): Response {
  const mutable = responseWithMutableHeaders(response);
  mutable.headers.set("X-RateLimit-Limit", String(rate.limit));
  mutable.headers.set("X-RateLimit-Remaining", String(rate.remaining));
  mutable.headers.set("X-RateLimit-Reset", String(rate.resetAtSeconds));
  if (!rate.allowed) {
    mutable.headers.set("Retry-After", String(rate.retryAfterSeconds));
  }
  return mutable;
}

export function mobileSuccessResponse<T>(
  data: T,
  ttlSeconds: number,
  cacheStatus: "MISS" | "HIT" = "MISS",
  publiclyCacheable = true,
): Response {
  const payload: MobileSuccess<T> = {
    ok: true,
    data,
    meta: {
      version: MOBILE_API_VERSION,
      imageBaseUrl: TMDB_IMAGE_BASE_URL,
      ttlSeconds,
      generatedAt: new Date().toISOString(),
    },
  };
  const headers = baseHeaders();

  if (publiclyCacheable) {
    headers.set("Cache-Control", cacheControl(ttlSeconds));
    headers.set(
      "CDN-Cache-Control",
      `public, s-maxage=${ttlSeconds}, stale-while-revalidate=${EDGE_STALE_WHILE_REVALIDATE}, stale-if-error=${EDGE_STALE_IF_ERROR}`,
    );
    headers.set(MOBILE_CDN_CACHE_HEADER, "enabled");
  } else {
    headers.set("Cache-Control", "private, no-store, no-cache, max-age=0, must-revalidate");
    headers.set("CDN-Cache-Control", "no-store");
    headers.set("Vary", `Accept-Encoding, ${MOBILE_API_KEY_HEADER}`);
    headers.set(MOBILE_CDN_CACHE_HEADER, "disabled");
  }

  headers.set(MOBILE_CACHE_HEADER, cacheStatus);
  return new Response(JSON.stringify(payload), { status: 200, headers });
}

export function mobileErrorResponse(error: MobileError): Response {
  const payload: MobileFailure = {
    ok: false,
    error: {
      code: error.code,
      message: error.message,
      retryable: error.retryable,
    },
    meta: {
      version: MOBILE_API_VERSION,
      imageBaseUrl: TMDB_IMAGE_BASE_URL,
    },
  };
  const headers = baseHeaders();
  headers.set("Cache-Control", "private, no-store, no-cache, max-age=0, must-revalidate");
  headers.set("CDN-Cache-Control", "no-store");
  headers.set(MOBILE_CACHE_HEADER, "BYPASS");
  headers.set(MOBILE_CDN_CACHE_HEADER, "disabled");
  if (error.retryable && error.retryAfterSeconds) {
    headers.set("Retry-After", String(error.retryAfterSeconds));
  }
  return new Response(JSON.stringify(payload), { status: error.status, headers });
}

export async function runMobileEndpoint<P, T>(
  request: Request,
  options: MobileEndpointOptions<P, T>,
): Promise<Response> {
  const rate = mobileRateLimiter.consume(
    clientKeyFromHeaders(request.headers),
    options.rateLimitCost ?? 1,
  );

  if (!rate.allowed) {
    const error = new MobileError(
      "client_rate_limited",
      429,
      "Too many mobile metadata requests. Please try again shortly.",
      { retryable: true, retryAfterSeconds: rate.retryAfterSeconds },
    );
    return applyRateHeaders(mobileErrorResponse(error), rate);
  }

  if (!isMobileRequestAuthorized(request)) {
    return applyRateHeaders(mobileErrorResponse(clientUnauthorizedError()), rate);
  }

  let parsed: ValidationResult<P>;
  try {
    parsed = options.parse(new URL(request.url).searchParams);
  } catch {
    return applyRateHeaders(mobileErrorResponse(badRequestError()), rate);
  }
  if (!parsed.ok) {
    return applyRateHeaders(
      mobileErrorResponse(new MobileError("bad_request", 400, parsed.error)),
      rate,
    );
  }
  const endpointParams = parsed.value;

  if (!getMobileTmdbToken()) {
    return applyRateHeaders(mobileErrorResponse(serviceUnconfiguredError()), rate);
  }

  const publiclyCacheable = !isMobileApiKeyEnabled();
  const key = `mobile:${MOBILE_API_VERSION}:${options.cacheKey(endpointParams)}`;
  const edgeHit = await readEdgeCache(key);
  if (edgeHit) {
    edgeHit.headers.set(MOBILE_CACHE_HEADER, "HIT");
    return applyRateHeaders(edgeHit, rate);
  }

  const ttlForData = (data: T): number =>
    typeof options.ttlSeconds === "function" ? options.ttlSeconds(data) : options.ttlSeconds;

  try {
    const data = await mobileCache.run(
      key,
      (value: T) => ttlForData(value) * 1_000,
      () => options.load(endpointParams),
    );
    const ttlSeconds = ttlForData(data);
    const response = mobileSuccessResponse(data, ttlSeconds, "MISS", publiclyCacheable);
    await writeEdgeCache(key, response);
    return applyRateHeaders(response, rate);
  } catch (error) {
    const mobileError = error instanceof MobileError ? error : internalError();
    return applyRateHeaders(mobileErrorResponse(mobileError), rate);
  }
}

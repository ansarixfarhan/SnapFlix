import {
  MAX_UPSTREAM_BODY_BYTES,
  TMDB_BASE_URL,
  UPSTREAM_TIMEOUT_MS,
} from "./constants";
import { MobileError } from "./errors";
import { cleanSecret, hasControlCharacters } from "./text";

/** Paths and query keys are constructed only from this module's internal callers. */
const TMDB_PATH = /^\/[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)*$/;
const TOKEN_VALUE = /^[A-Za-z0-9._~-]+$/;
const ALLOWED_QUERY_KEYS = new Set([
  "page",
  "query",
  "include_adult",
  "append_to_response",
]);

export type TmdbQueryParams = Record<string, string | number | boolean | null | undefined>;
export type TmdbRawList = {
  page?: unknown;
  results?: unknown;
  total_pages?: unknown;
  total_results?: unknown;
};
export type TmdbRawRecord = Record<string, unknown>;

type CachedRequestInit = RequestInit & { next?: { revalidate: number } };

/**
 * Strictly reads the server-only v4 read access token. Public NEXT_PUBLIC_*
 * variables, v3 API keys and website fallback credentials are never used here.
 */
export function getMobileTmdbToken(): string | null {
  const raw = process.env.TMDB_ACCESS_TOKEN?.trim();
  if (!raw) return null;
  const withoutPrefix = raw.replace(/^Bearer\s+/i, "").trim();
  const token = cleanSecret(withoutPrefix);
  if (!token || !TOKEN_VALUE.test(token)) return null;
  return token;
}

function cleanParamValue(value: string | number | boolean): string | null {
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : null;
  }
  if (value.length > 300 || hasControlCharacters(value)) return null;
  return value;
}

function buildTmdbUrl(path: string, params: TmdbQueryParams): URL {
  if (!TMDB_PATH.test(path)) {
    throw new MobileError("internal_error", 500, "The mobile metadata service could not complete the request.");
  }

  const url = new URL(`${TMDB_BASE_URL}${path}`);
  url.searchParams.set("language", "en-US");

  for (const [key, rawValue] of Object.entries(params)) {
    if (!ALLOWED_QUERY_KEYS.has(key)) {
      throw new MobileError("internal_error", 500, "The mobile metadata service could not complete the request.");
    }
    if (rawValue === null || rawValue === undefined || rawValue === "") continue;
    const value = cleanParamValue(rawValue);
    if (value === null) {
      throw new MobileError("internal_error", 500, "The mobile metadata service could not complete the request.");
    }
    url.searchParams.set(key, value);
  }

  return url;
}

function retryAfterSeconds(response: Response): number {
  const raw = response.headers.get("retry-after");
  if (!raw) return 30;
  const seconds = Number(raw);
  if (Number.isFinite(seconds) && seconds >= 1 && seconds <= 120) return Math.ceil(seconds);
  return 30;
}

export async function mobileTmdbGet<T>(
  path: string,
  params: TmdbQueryParams = {},
  revalidateSeconds = 600,
): Promise<T> {
  const token = getMobileTmdbToken();
  if (!token) throw new MobileError(
    "service_unconfigured",
    503,
    "The mobile metadata service is not configured on the server.",
  );

  const url = buildTmdbUrl(path, params);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  let response: Response;

  const init: CachedRequestInit = {
    method: "GET",
    headers: {
      accept: "application/json",
      authorization: `Bearer ${token}`,
    },
    signal: controller.signal,
    next: { revalidate: Math.max(1, Math.floor(revalidateSeconds)) },
  };

  try {
    response = await fetch(url, init);
  } catch (error) {
    const aborted = error instanceof Error && error.name === "AbortError";
    throw new MobileError(
      "upstream_unavailable",
      aborted ? 504 : 502,
      aborted
        ? "The metadata provider timed out. Please try again shortly."
        : "The metadata provider is temporarily unavailable.",
      { retryable: true, retryAfterSeconds: aborted ? 5 : 15, cause: error },
    );
  } finally {
    clearTimeout(timeout);
  }

  if (response.status === 401 || response.status === 403) {
    throw new MobileError(
      "upstream_unauthorized",
      502,
      "The metadata provider rejected the server credential.",
    );
  }
  if (response.status === 404) {
    throw new MobileError("not_found", 404, "The requested TMDB title was not found.");
  }
  if (response.status === 429) {
    throw new MobileError(
      "upstream_rate_limited",
      503,
      "The metadata provider is busy. Please try again shortly.",
      { retryable: true, retryAfterSeconds: retryAfterSeconds(response) },
    );
  }
  if (!response.ok) {
    throw new MobileError(
      "upstream_unavailable",
      502,
      "The metadata provider is temporarily unavailable.",
      { retryable: response.status >= 500, retryAfterSeconds: response.status >= 500 ? 15 : null },
    );
  }

  const declaredLength = Number(response.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > MAX_UPSTREAM_BODY_BYTES) {
    throw new MobileError("upstream_unavailable", 502, "The metadata provider returned an invalid response.");
  }

  try {
    const text = await response.text();
    if (text.length > MAX_UPSTREAM_BODY_BYTES) {
      throw new Error("TMDB response too large");
    }
    return JSON.parse(text) as T;
  } catch (error) {
    throw new MobileError(
      "upstream_unavailable",
      502,
      "The metadata provider returned an invalid response.",
      { cause: error },
    );
  }
}

export async function mobileTmdbGetList(
  path: string,
  params: TmdbQueryParams = {},
  revalidateSeconds = 600,
): Promise<TmdbRawList> {
  return mobileTmdbGet<TmdbRawList>(path, params, revalidateSeconds);
}

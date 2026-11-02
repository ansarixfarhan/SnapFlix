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
  "with_genres",
  "sort_by",
  "external_source",
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

class ResponseBodyTooLargeError extends Error {
  constructor() {
    super("TMDB response exceeded the streaming byte limit");
    this.name = "ResponseBodyTooLargeError";
  }
}

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

function isAbortError(error: unknown, signal: AbortSignal): boolean {
  if (signal.aborted) return true;
  if (!error || typeof error !== "object") return false;
  const name = (error as { name?: unknown }).name;
  return name === "AbortError" || name === "TimeoutError";
}

function timeoutError(error: unknown): MobileError {
  return new MobileError(
    "upstream_unavailable",
    504,
    "The metadata provider timed out. Please try again shortly.",
    { retryable: true, retryAfterSeconds: 5, cause: error },
  );
}

function requestFailure(error: unknown, signal: AbortSignal): MobileError {
  if (isAbortError(error, signal)) return timeoutError(error);
  return new MobileError(
    "upstream_unavailable",
    502,
    "The metadata provider is temporarily unavailable.",
    { retryable: true, retryAfterSeconds: 15, cause: error },
  );
}

function tooLargeError(): MobileError {
  return new MobileError(
    "upstream_response_too_large",
    502,
    "The metadata provider returned an oversized response.",
  );
}

function invalidResponseError(error: unknown): MobileError {
  return new MobileError(
    "upstream_unavailable",
    502,
    "The metadata provider returned an invalid response.",
    { cause: error },
  );
}

function ensureOkResponse(response: Response): void {
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
}

async function readStreamingJson<T>(
  response: Response,
  controller: AbortController,
): Promise<T> {
  const declaredLength = Number(response.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > MAX_UPSTREAM_BODY_BYTES) {
    if (response.body) {
      await response.body.cancel().catch(() => undefined);
    }
    controller.abort();
    throw new ResponseBodyTooLargeError();
  }

  const body = response.body;
  if (!body) return JSON.parse("") as T;

  const reader = body.getReader();
  const decoder = new TextDecoder();
  let totalBytes = 0;
  let text = "";

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;

      if (totalBytes + value.byteLength > MAX_UPSTREAM_BODY_BYTES) {
        await reader.cancel().catch(() => undefined);
        controller.abort();
        throw new ResponseBodyTooLargeError();
      }

      totalBytes += value.byteLength;
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
    return JSON.parse(text) as T;
  } finally {
    try {
      reader.releaseLock();
    } catch {
      // The stream may already be released when an abort/cancel wins the race.
    }
  }
}

export async function mobileTmdbGet<T>(
  path: string,
  params: TmdbQueryParams = {},
  revalidateSeconds = 600,
  timeoutMs: number = UPSTREAM_TIMEOUT_MS,
): Promise<T> {
  const token = getMobileTmdbToken();
  if (!token) throw new MobileError(
    "service_unconfigured",
    503,
    "The mobile metadata service is not configured on the server.",
  );

  const url = buildTmdbUrl(path, params);
  const effectiveTimeoutMs = Number.isFinite(timeoutMs) && timeoutMs > 0
    ? Math.min(2_147_483_647, Math.max(1, Math.floor(timeoutMs)))
    : UPSTREAM_TIMEOUT_MS;
  const controller = new AbortController();
  // This timer deliberately covers the whole response, including body reads.
  const timeout = setTimeout(() => controller.abort(), effectiveTimeoutMs);

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
    let response: Response;
    try {
      response = await fetch(url, init);
    } catch (error) {
      throw requestFailure(error, controller.signal);
    }

    ensureOkResponse(response);
    return await readStreamingJson<T>(response, controller);
  } catch (error) {
    if (error instanceof MobileError) throw error;
    if (error instanceof ResponseBodyTooLargeError) throw tooLargeError();
    if (isAbortError(error, controller.signal)) throw timeoutError(error);
    throw invalidResponseError(error);
  } finally {
    clearTimeout(timeout);
  }
}

export async function mobileTmdbGetList(
  path: string,
  params: TmdbQueryParams = {},
  revalidateSeconds = 600,
  timeoutMs: number = UPSTREAM_TIMEOUT_MS,
): Promise<TmdbRawList> {
  return mobileTmdbGet<TmdbRawList>(path, params, revalidateSeconds, timeoutMs);
}

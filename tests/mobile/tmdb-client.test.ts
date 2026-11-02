import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";

import { MAX_UPSTREAM_BODY_BYTES } from "../../src/lib/mobile/constants";
import { MobileError } from "../../src/lib/mobile/errors";
import { getMobileTmdbToken, mobileTmdbGet } from "../../src/lib/mobile/tmdb";

const VALID_TOKEN = "test_access_token_1234567890";
const originalFetch = globalThis.fetch;
const originalToken = process.env.TMDB_ACCESS_TOKEN;
const originalPublicToken = process.env.NEXT_PUBLIC_TMDB_ACCESS_TOKEN;

type CapturedRequest = { url: URL; init: Record<string, any> };

function jsonResponse(payload: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "content-type": "application/json" },
    ...init,
  });
}

function restoreEnv(): void {
  if (originalToken === undefined) delete process.env.TMDB_ACCESS_TOKEN;
  else process.env.TMDB_ACCESS_TOKEN = originalToken;
  if (originalPublicToken === undefined) delete process.env.NEXT_PUBLIC_TMDB_ACCESS_TOKEN;
  else process.env.NEXT_PUBLIC_TMDB_ACCESS_TOKEN = originalPublicToken;
}

beforeEach(() => {
  restoreEnv();
  process.env.TMDB_ACCESS_TOKEN = VALID_TOKEN;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  restoreEnv();
});

test("only TMDB_ACCESS_TOKEN is accepted; public and v3-style fallbacks are ignored", async () => {
  delete process.env.TMDB_ACCESS_TOKEN;
  process.env.NEXT_PUBLIC_TMDB_ACCESS_TOKEN = "public_token_1234567890";

  let calls = 0;
  globalThis.fetch = (async () => {
    calls += 1;
    return jsonResponse({ ok: true });
  }) as typeof fetch;

  assert.equal(getMobileTmdbToken(), null);
  await assert.rejects(
    mobileTmdbGet("/movie/1", {}, 60),
    (error: unknown) => error instanceof MobileError && error.code === "service_unconfigured",
  );
  assert.equal(calls, 0);
});

test("Bearer prefixes are normalized and placeholder values are rejected", () => {
  process.env.TMDB_ACCESS_TOKEN = `Bearer ${VALID_TOKEN}`;
  assert.equal(getMobileTmdbToken(), VALID_TOKEN);

  process.env.TMDB_ACCESS_TOKEN = "your_tmdb_access_token_placeholder";
  assert.equal(getMobileTmdbToken(), null);
});

test("upstream requests are fixed, credentialed and cache-aware", async () => {
  const capturedRequests: CapturedRequest[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    capturedRequests.push({
      url: new URL(String(input)),
      init: (init ?? {}) as Record<string, any>,
    });
    return jsonResponse({ id: 11 });
  }) as typeof fetch;

  const data = await mobileTmdbGet<{ id: number }>(
    "/movie/11",
    { page: 2, include_adult: false },
    300,
  );

  assert.equal(data.id, 11);
  assert.equal(capturedRequests.length, 1);
  const captured = capturedRequests[0];
  assert.equal(captured.url.origin, "https://api.themoviedb.org");
  assert.equal(captured.url.pathname, "/3/movie/11");
  assert.equal(captured.url.searchParams.get("language"), "en-US");
  assert.equal(captured.url.searchParams.get("page"), "2");
  assert.equal(captured.url.searchParams.get("include_adult"), "false");
  assert.equal(captured.url.searchParams.has("api_key"), false);
  assert.equal(captured.init.headers.authorization, `Bearer ${VALID_TOKEN}`);
  assert.equal(captured.init.next.revalidate, 300);
});

test("arbitrary upstream paths and query keys cannot be injected", async () => {
  let calls = 0;
  globalThis.fetch = (async () => {
    calls += 1;
    return jsonResponse({});
  }) as typeof fetch;

  await assert.rejects(
    mobileTmdbGet("/movie/1?api_key=abc", {}, 60),
    (error: unknown) => error instanceof MobileError && error.code === "internal_error",
  );
  await assert.rejects(
    mobileTmdbGet("/movie/1", { api_key: "abc" }, 60),
    (error: unknown) => error instanceof MobileError && error.code === "internal_error",
  );
  assert.equal(calls, 0);
});

test("upstream status codes become safe, retryable client errors", async () => {
  globalThis.fetch = (async () =>
    new Response("{}", {
      status: 429,
      headers: { "retry-after": "12", "content-type": "application/json" },
    })) as typeof fetch;

  await assert.rejects(
    mobileTmdbGet("/movie/1", {}, 60),
    (error: unknown) =>
      error instanceof MobileError &&
      error.code === "upstream_rate_limited" &&
      error.status === 503 &&
      error.retryAfterSeconds === 12,
  );
});

test("network aborts are reported as upstream timeouts", async () => {
  globalThis.fetch = (async () => {
    const error = new DOMException("aborted", "AbortError");
    throw error;
  }) as typeof fetch;

  await assert.rejects(
    mobileTmdbGet("/movie/1", {}, 60),
    (error: unknown) =>
      error instanceof MobileError &&
      error.code === "upstream_unavailable" &&
      error.status === 504 &&
      error.retryable === true,
  );
});

test("discover and find query keys are allowlisted and passed upstream safely", async () => {
  const capturedUrls: URL[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    capturedUrls.push(new URL(String(input)));
    return jsonResponse({ page: 1, results: [] });
  }) as typeof fetch;

  await mobileTmdbGet(
    "/discover/movie",
    { page: 2, include_adult: false, with_genres: "12,28", sort_by: "vote_average.desc" },
    600,
  );
  await mobileTmdbGet("/find/tt1234567", { external_source: "imdb_id" }, 600);

  assert.equal(capturedUrls.length, 2);
  assert.equal(capturedUrls[0].pathname, "/3/discover/movie");
  assert.equal(capturedUrls[0].searchParams.get("with_genres"), "12,28");
  assert.equal(capturedUrls[0].searchParams.get("sort_by"), "vote_average.desc");
  assert.equal(capturedUrls[0].searchParams.get("include_adult"), "false");
  assert.equal(capturedUrls[1].pathname, "/3/find/tt1234567");
  assert.equal(capturedUrls[1].searchParams.get("external_source"), "imdb_id");
});

test("timeout stays active until the response body has been read", async () => {
  const encoder = new TextEncoder();
  globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    const signal = init?.signal as AbortSignal | undefined;
    const body = new ReadableStream<Uint8Array>({
      start(streamController) {
        const timer = setTimeout(() => {
          streamController.enqueue(encoder.encode('{"id":1}'));
          streamController.close();
        }, 80);
        const abort = () => {
          clearTimeout(timer);
          streamController.error(new DOMException("aborted", "AbortError"));
        };
        if (signal?.aborted) abort();
        else signal?.addEventListener("abort", abort, { once: true });
      },
    });
    return new Response(body, {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;

  await assert.rejects(
    mobileTmdbGet("/movie/1", {}, 60, 25),
    (error: unknown) =>
      error instanceof MobileError &&
      error.code === "upstream_unavailable" &&
      error.status === 504 &&
      error.retryable === true &&
      /timed out/i.test(error.message),
  );
});

test("streaming byte cap cancels an oversized response before JSON parsing", async () => {
  let cancelled = false;
  let secondChunkSent = false;
  const body = new ReadableStream<Uint8Array>({
    start(streamController) {
      streamController.enqueue(new Uint8Array(MAX_UPSTREAM_BODY_BYTES));
    },
    pull(streamController) {
      if (!secondChunkSent) {
        secondChunkSent = true;
        streamController.enqueue(new Uint8Array(1));
      }
    },
    cancel() {
      cancelled = true;
    },
  });

  globalThis.fetch = (async () =>
    new Response(body, {
      status: 200,
      headers: { "content-type": "application/json" },
    })) as typeof fetch;

  await assert.rejects(
    mobileTmdbGet("/movie/1", {}, 60, 1_000),
    (error: unknown) =>
      error instanceof MobileError &&
      error.code === "upstream_response_too_large" &&
      error.status === 502 &&
      error.retryable === false,
  );
  assert.equal(secondChunkSent, true);
  assert.equal(cancelled, true);
});

test("an oversized declared content-length is rejected before streaming", async () => {
  globalThis.fetch = (async () =>
    new Response(new Uint8Array(0), {
      status: 200,
      headers: {
        "content-type": "application/json",
        "content-length": String(MAX_UPSTREAM_BODY_BYTES + 1),
      },
    })) as typeof fetch;

  await assert.rejects(
    mobileTmdbGet("/movie/1", {}, 60),
    (error: unknown) =>
      error instanceof MobileError &&
      error.code === "upstream_response_too_large" &&
      error.status === 502 &&
      error.retryable === false,
  );
});

test("Story and Discover query keys are allowlisted and passed upstream safely", async () => {
  const capturedUrls: URL[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    capturedUrls.push(new URL(String(input)));
    return jsonResponse({ page: 1, results: [] });
  }) as typeof fetch;

  await mobileTmdbGet(
    "/discover/tv",
    {
      page: 1,
      include_adult: false,
      with_genres: "16",
      with_original_language: "ja",
      with_origin_country: "JP",
      with_keywords: "210024",
      without_keywords: "158718|155477",
      sort_by: "first_air_date.desc",
    },
    600,
  );
  await mobileTmdbGet("/movie/77/images", { include_image_language: "en,null" }, 600);

  assert.equal(capturedUrls.length, 2);
  assert.equal(capturedUrls[0].searchParams.get("with_original_language"), "ja");
  assert.equal(capturedUrls[0].searchParams.get("with_origin_country"), "JP");
  assert.equal(capturedUrls[0].searchParams.get("with_keywords"), "210024");
  assert.equal(capturedUrls[0].searchParams.get("without_keywords"), "158718|155477");
  assert.equal(capturedUrls[0].searchParams.get("sort_by"), "first_air_date.desc");
  assert.equal(capturedUrls[1].pathname, "/3/movie/77/images");
  assert.equal(capturedUrls[1].searchParams.get("include_image_language"), "en,null");
});

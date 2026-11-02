import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";

import { GET as detailsGET } from "../../src/app/api/mobile/v1/details/route";
import { GET as searchGET } from "../../src/app/api/mobile/v1/search/route";
import { mobileCache } from "../../src/lib/mobile/cache";
import { MOBILE_API_KEY_HEADER } from "../../src/lib/mobile/constants";
import { mobileRateLimiter } from "../../src/lib/mobile/rate-limit";

const VALID_TOKEN = "integration_access_token_123456";
const APP_KEY = "integration_mobile_app_key_123456";
const originalFetch = globalThis.fetch;
const originalCaches = (globalThis as any).caches;
const originalToken = process.env.TMDB_ACCESS_TOKEN;
const originalPublicToken = process.env.NEXT_PUBLIC_TMDB_ACCESS_TOKEN;
const originalAppKey = process.env.MOBILE_API_KEY;

type FetchCall = { url: URL; init?: RequestInit };
type StoredResponse = { body: string; status: number; headers: Headers };

/**
 * Cloudflare's Cache API returns responses whose headers are immutable. A
 * `clone()` keeps that guard, so each cached response returned here rejects
 * `set`/`append`/`delete` exactly as the Worker runtime does.
 */
function immutableResponse(
  body: string,
  status: number,
  sourceHeaders: Headers,
): Response {
  const response = new Response(body, {
    status,
    headers: new Headers(sourceHeaders),
  });
  const immutableHeaders = new Proxy(response.headers, {
    get(target, property, receiver) {
      if (
        property === "set" ||
        property === "append" ||
        property === "delete"
      ) {
        return () => {
          throw new TypeError("Can't modify immutable headers.");
        };
      }
      const value = Reflect.get(target, property, receiver);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
  Object.defineProperty(response, "headers", {
    value: immutableHeaders,
    configurable: true,
  });
  Object.defineProperty(response, "clone", {
    value: () => immutableResponse(body, status, sourceHeaders),
    configurable: true,
  });
  return response;
}

class ImmutableEdgeCache {
  private readonly store = new Map<string, StoredResponse>();

  async match(request: Request): Promise<Response | undefined> {
    const cached = this.store.get(request.url);
    if (!cached) return undefined;
    return immutableResponse(cached.body, cached.status, cached.headers);
  }

  async put(request: Request, response: Response): Promise<void> {
    this.store.set(request.url, {
      body: await response.text(),
      status: response.status,
      headers: new Headers(response.headers),
    });
  }

  clear(): void {
    this.store.clear();
  }

  get size(): number {
    return this.store.size;
  }
}

let fetchCalls: FetchCall[] = [];
let edgeCache = new ImmutableEdgeCache();
let ipCounter = 0;

function jsonResponse(payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

function installFetch(
  handler: (url: URL, init?: RequestInit) => Response | Promise<Response>,
): void {
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    fetchCalls.push({ url, init });
    return handler(url, init);
  }) as typeof fetch;
}

function mobileRequest(path: string, headers: Record<string, string> = {}): Request {
  const ip = `198.51.100.${(ipCounter++ % 200) + 1}`;
  return new Request(`https://snapflix.test${path}`, {
    headers: { "cf-connecting-ip": ip, ...headers },
  });
}

function restoreEnv(): void {
  if (originalToken === undefined) delete process.env.TMDB_ACCESS_TOKEN;
  else process.env.TMDB_ACCESS_TOKEN = originalToken;
  if (originalPublicToken === undefined) delete process.env.NEXT_PUBLIC_TMDB_ACCESS_TOKEN;
  else process.env.NEXT_PUBLIC_TMDB_ACCESS_TOKEN = originalPublicToken;
  if (originalAppKey === undefined) delete process.env.MOBILE_API_KEY;
  else process.env.MOBILE_API_KEY = originalAppKey;
}

function movieDetailsPayload(id: number): Record<string, unknown> {
  return {
    id,
    title: "A Story of Derry",
    original_title: "A Story of Derry",
    overview: "A historical horror story set before the events of It.",
    release_date: "2026-10-31",
    poster_path: "/poster.jpg",
    backdrop_path: "/backdrop.jpg",
    vote_average: 6.6,
    vote_count: 39,
    genres: [{ id: 18, name: "Drama" }],
    credits: { cast: [], crew: [] },
    videos: { results: [] },
    images: {
      backdrops: [{ file_path: "/backdrop.jpg", width: 1280, height: 720 }],
      posters: [],
      logos: [{ file_path: "/logo.png", width: 1200, height: 600 }],
    },
    keywords: { results: [] },
    recommendations: { results: [] },
    similar: { results: [] },
    external_ids: { imdb_id: "tt50389959" },
    reviews: {
      page: 1,
      results: [
        {
          id: "review1",
          author: "Sejian",
          author_details: { name: "", username: "Sejian", rating: 4 },
          content: "Short review.",
          created_at: "2026-11-02T08:26:21Z",
          url: "https://www.themoviedb.org/review/review1",
        },
      ],
      total_pages: 1,
      total_results: 1,
    },
    release_dates: {
      results: [
        {
          iso_3166_1: "US",
          release_dates: [
            {
              certification: "R",
              descriptors: [],
              iso_639_1: "",
              note: "HBO Max",
              release_date: "2026-10-31T00:00:00.000Z",
              type: 4,
            },
          ],
        },
      ],
    },
    runtime: 30,
    budget: 0,
    revenue: 0,
    belongs_to_collection: null,
  };
}

function tvDetailsPayload(id: number): Record<string, unknown> {
  return {
    id,
    name: "The Gilded Age",
    original_name: "The Gilded Age",
    overview: "New money and old money collide in 1880s New York.",
    first_air_date: "2022-01-24",
    last_air_date: "2026-11-01",
    poster_path: "/poster.jpg",
    backdrop_path: "/backdrop.jpg",
    vote_average: 7.7,
    vote_count: 285,
    genres: [{ id: 18, name: "Drama" }],
    created_by: [{ id: 10747, name: "Julian Fellowes" }],
    production_countries: [
      { iso_3166_1: "US", name: "United States of America" },
      { iso_3166_1: "GB", name: "United Kingdom" },
    ],
    number_of_seasons: 4,
    number_of_episodes: 33,
    episode_run_time: [],
    in_production: true,
    networks: [{ id: 49, name: "HBO" }],
    seasons: [
      {
        id: 108018,
        name: "Season 1",
        season_number: 1,
        episode_count: 9,
        air_date: "2022-01-24",
        poster_path: "/season1.jpg",
      },
    ],
    credits: { cast: [], crew: [] },
    videos: { results: [] },
    images: {
      backdrops: [{ file_path: "/backdrop.jpg", width: 1280, height: 720 }],
      posters: [],
      logos: [],
    },
    keywords: { results: [] },
    recommendations: { results: [] },
    similar: { results: [] },
    external_ids: { imdb_id: "tt4406178" },
    episode_groups: { results: [] },
    reviews: {
      page: 1,
      results: [
        {
          id: "review2",
          author: "Martin Oaks",
          author_details: { name: "Martin Oaks", username: "martinrobles", rating: null },
          content: "Aristocratic sobriety.",
          created_at: "2026-10-17T18:00:12Z",
          url: "https://www.themoviedb.org/review/review2",
        },
      ],
      total_pages: 1,
      total_results: 1,
    },
    content_ratings: {
      results: [
        { iso_3166_1: "US", rating: "TV-14", descriptors: [] },
        { iso_3166_1: "GB", rating: "15", descriptors: [] },
      ],
    },
    next_episode_to_air: null,
    last_episode_to_air: {
      id: 7726958,
      name: "Ring the Bells",
      overview: "Season four begins.",
      air_date: "2026-11-01",
      episode_number: 1,
      season_number: 4,
      runtime: 56,
      still_path: "/still.jpg",
    },
  };
}

beforeEach(() => {
  restoreEnv();
  process.env.TMDB_ACCESS_TOKEN = VALID_TOKEN;
  delete process.env.NEXT_PUBLIC_TMDB_ACCESS_TOKEN;
  delete process.env.MOBILE_API_KEY;
  mobileCache.clear();
  mobileRateLimiter.clear();
  edgeCache = new ImmutableEdgeCache();
  (globalThis as any).caches = { default: edgeCache };
  fetchCalls = [];
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalCaches === undefined) delete (globalThis as any).caches;
  else (globalThis as any).caches = originalCaches;
  restoreEnv();
});

test("Details edge-cache HITs return valid JSON for both reported TMDB IDs", async () => {
  installFetch((url) => {
    if (url.pathname === "/3/movie/1813355") {
      const append = url.searchParams.get("append_to_response") ?? "";
      assert.match(append, /images/);
      assert.match(append, /release_dates/);
      return jsonResponse(movieDetailsPayload(1813355));
    }
    if (url.pathname === "/3/tv/81723") {
      const append = url.searchParams.get("append_to_response") ?? "";
      assert.match(append, /episode_groups/);
      assert.match(append, /content_ratings/);
      return jsonResponse(tvDetailsPayload(81723));
    }
    throw new Error(`Unexpected upstream path: ${url.pathname}`);
  });

  const cases = [
    {
      path: "/api/mobile/v1/details?mediaType=movie&id=1813355",
      id: 1813355,
      mediaType: "movie",
    },
    {
      path: "/api/mobile/v1/details?mediaType=tv&id=81723",
      id: 81723,
      mediaType: "tv",
    },
  ];

  for (const item of cases) {
    const miss = await detailsGET(mobileRequest(item.path));
    const missBody = await miss.json();
    assert.equal(miss.status, 200);
    assert.equal(miss.headers.get("x-mobile-cache"), "MISS");
    assert.equal(missBody.ok, true);
    assert.equal(missBody.data.id, item.id);
    assert.equal(missBody.data.mediaType, item.mediaType);
  }
  assert.equal(fetchCalls.length, 2);
  assert.equal(edgeCache.size, 2);

  fetchCalls = [];
  for (const item of cases) {
    const hit = await detailsGET(mobileRequest(item.path));
    const hitBody = await hit.json();

    assert.equal(hit.status, 200, `expected cached ${item.mediaType} details to stay 200`);
    assert.equal(hit.headers.get("x-mobile-cache"), "HIT");
    assert.match(hit.headers.get("x-ratelimit-limit") ?? "", /^\d+$/);
    assert.match(hit.headers.get("x-ratelimit-remaining") ?? "", /^\d+$/);
    assert.match(hit.headers.get("x-ratelimit-reset") ?? "", /^\d+$/);
    assert.equal(hitBody.ok, true);
    assert.equal(hitBody.data.id, item.id);
    assert.equal(hitBody.data.mediaType, item.mediaType);
    assert.equal(hitBody.meta.version, "v1");
  }
  assert.equal(fetchCalls.length, 0, "a cache HIT must not call TMDB again");
});

test("Search edge-cache HITs also survive immutable Cloudflare headers", async () => {
  installFetch(() =>
    jsonResponse({
      page: 1,
      total_pages: 1,
      total_results: 1,
      results: [
        {
          id: 1813355,
          title: "A Story of Derry",
          media_type: "movie",
          poster_path: "/poster.jpg",
        },
      ],
    }),
  );

  const path = "/api/mobile/v1/search?q=derry&type=multi";
  const miss = await searchGET(mobileRequest(path));
  assert.equal(miss.status, 200);
  assert.equal(miss.headers.get("x-mobile-cache"), "MISS");
  await miss.json();
  assert.equal(fetchCalls.length, 1);
  assert.equal(edgeCache.size, 1);

  fetchCalls = [];
  const hit = await searchGET(mobileRequest(path));
  const hitBody = await hit.json();

  assert.equal(hit.status, 200);
  assert.equal(hit.headers.get("x-mobile-cache"), "HIT");
  assert.equal(hitBody.ok, true);
  assert.equal(hitBody.data.results[0].id, 1813355);
  assert.equal(fetchCalls.length, 0);
});

test("App-key gated Details still bypass the shared cache and stay no-store", async () => {
  process.env.MOBILE_API_KEY = APP_KEY;
  installFetch(() => jsonResponse(movieDetailsPayload(1813355)));

  const response = await detailsGET(
    mobileRequest("/api/mobile/v1/details?mediaType=movie&id=1813355", {
      [MOBILE_API_KEY_HEADER]: APP_KEY,
    }),
  );
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.match(response.headers.get("cache-control") ?? "", /no-store/);
  assert.equal(response.headers.get("cdn-cache-control"), "no-store");
  assert.equal(response.headers.get("x-mobile-cdn-cache"), "disabled");
  assert.equal(response.headers.get("vary"), `Accept-Encoding, ${MOBILE_API_KEY_HEADER}`);
  assert.equal(edgeCache.size, 0, "gated responses must not be written to a public edge cache");
  assert.equal(fetchCalls.length, 1);
});

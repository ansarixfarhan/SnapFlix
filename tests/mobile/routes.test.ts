import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";

import { GET as detailsGET } from "../../src/app/api/mobile/v1/details/route";
import { GET as discoverGET } from "../../src/app/api/mobile/v1/discover/route";
import { GET as episodeGroupGET } from "../../src/app/api/mobile/v1/episode-groups/route";
import { GET as episodesGET } from "../../src/app/api/mobile/v1/episodes/route";
import { GET as findGET } from "../../src/app/api/mobile/v1/find/route";
import { GET as findPathGET } from "../../src/app/api/mobile/v1/find/[imdbId]/route";
import { GET as genresGET } from "../../src/app/api/mobile/v1/genres/route";
import { GET as homeGET } from "../../src/app/api/mobile/v1/home/route";
import { GET as listGET } from "../../src/app/api/mobile/v1/list/route";
import { GET as lookupGET } from "../../src/app/api/mobile/v1/lookup/route";
import { GET as searchGET } from "../../src/app/api/mobile/v1/search/route";
import { mobileCache } from "../../src/lib/mobile/cache";
import { mobileRateLimiter } from "../../src/lib/mobile/rate-limit";

const VALID_TOKEN = "integration_access_token_123456";
const originalFetch = globalThis.fetch;
const originalCaches = (globalThis as any).caches;
const originalToken = process.env.TMDB_ACCESS_TOKEN;
const originalPublicToken = process.env.NEXT_PUBLIC_TMDB_ACCESS_TOKEN;
const originalAppKey = process.env.MOBILE_API_KEY;

type FetchCall = { url: URL; init?: RequestInit };

class FakeEdgeCache {
  private readonly store = new Map<
    string,
    { body: string; status: number; headers: Headers }
  >();

  async match(request: Request): Promise<Response | undefined> {
    const cached = this.store.get(request.url);
    if (!cached) return undefined;
    return new Response(cached.body, {
      status: cached.status,
      headers: cached.headers,
    });
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
let edgeCache = new FakeEdgeCache();
let ipCounter = 0;

function jsonResponse(payload: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers({ "content-type": "application/json" });
  if (init.headers) {
    for (const [key, value] of new Headers(init.headers)) headers.set(key, value);
  }
  return new Response(JSON.stringify(payload), { ...init, status: init.status ?? 200, headers });
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

beforeEach(() => {
  restoreEnv();
  process.env.TMDB_ACCESS_TOKEN = VALID_TOKEN;
  delete process.env.MOBILE_API_KEY;
  mobileCache.clear();
  mobileRateLimiter.clear();
  edgeCache = new FakeEdgeCache();
  (globalThis as any).caches = { default: edgeCache };
  fetchCalls = [];
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalCaches === undefined) delete (globalThis as any).caches;
  else (globalThis as any).caches = originalCaches;
  restoreEnv();
});

test("home returns hero and fixed rows with cacheable, cookie-free JSON", async () => {
  installFetch((url) => {
    const mediaType = url.pathname.includes("/tv/") ? "tv" : "movie";
    return jsonResponse({
      page: 1,
      total_pages: 2,
      total_results: 40,
      results: [
        {
          id: 101,
          name: "Trending Show",
          title: "Trending Movie",
          media_type: mediaType,
          backdrop_path: "/backdrop.jpg",
          poster_path: "/poster.jpg",
          overview: "Overview",
          first_air_date: "2024-01-01",
          release_date: "2024-01-01",
          vote_average: 8.2,
        },
      ],
    });
  });

  const response = await homeGET(mobileRequest("/api/mobile/v1/home?content=tv&page=1"));
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.data.content, "tv");
  assert.equal(body.data.rows.length, 5);
  assert.equal(body.data.hero.length, 1);
  assert.equal(body.data.partial, false);
  assert.deepEqual(body.data.failedRows, []);
  assert.equal(body.data.rows[0].results[0].mediaType, "tv");
  assert.match(body.data.rows[0].endpoint, /\/api\/mobile\/v1\/list\?content=tv/);
  assert.equal("streams" in body.data, false);
  assert.equal(fetchCalls.length, 5);
  assert.match(response.headers.get("cache-control") ?? "", /s-maxage=600/);
  assert.match(response.headers.get("cdn-cache-control") ?? "", /s-maxage=600/);
  assert.equal(response.headers.get("x-mobile-cdn-cache"), "enabled");
  assert.equal(response.headers.get("x-mobile-cache"), "MISS");
  assert.equal(response.headers.get("access-control-allow-origin"), null);
  assert.equal(response.headers.get("set-cookie"), null);

  for (const call of fetchCalls) {
    assert.equal(call.url.searchParams.get("language"), "en-US");
    assert.equal(call.url.searchParams.has("api_key"), false);
    assert.equal(
      (call.init?.headers as Record<string, string>).authorization,
      `Bearer ${VALID_TOKEN}`,
    );
  }
});

test("mobile endpoints do not fall back to a public token", async () => {
  delete process.env.TMDB_ACCESS_TOKEN;
  process.env.NEXT_PUBLIC_TMDB_ACCESS_TOKEN = "public_token_1234567890";
  installFetch(() => jsonResponse({ id: 1 }));

  const response = await detailsGET(mobileRequest("/api/mobile/v1/details?mediaType=movie&id=1"));
  const body = await response.json();

  assert.equal(response.status, 503);
  assert.equal(body.ok, false);
  assert.equal(body.error.code, "service_unconfigured");
  assert.equal(fetchCalls.length, 0);
});

test("search filters non-media results and validates input before upstream calls", async () => {
  installFetch(() =>
    jsonResponse({
      page: 1,
      total_pages: 1,
      total_results: 3,
      results: [
        { id: 1, title: "Batman", media_type: "movie", poster_path: "/batman.jpg" },
        { id: 2, name: "Batman Series", media_type: "tv" },
        { id: 3, name: "A Person", media_type: "person" },
      ],
    }),
  );

  const response = await searchGET(mobileRequest("/api/mobile/v1/search?q=%20batman%20&type=multi"));
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.data.query, "batman");
  assert.equal(body.data.results.length, 2);
  assert.deepEqual(
    body.data.results.map((item: { mediaType: string }) => item.mediaType),
    ["movie", "tv"],
  );
  assert.equal(fetchCalls[0].url.pathname, "/3/search/multi");
  assert.equal(fetchCalls[0].url.searchParams.get("include_adult"), "false");

  const invalid = await searchGET(mobileRequest("/api/mobile/v1/search?q=&type=multi"));
  assert.equal(invalid.status, 400);
  assert.equal((await invalid.json()).error.code, "bad_request");
  assert.equal(fetchCalls.length, 1);

  const unknown = await searchGET(
    mobileRequest("/api/mobile/v1/search?q=batman&append_to_response=credits"),
  );
  assert.equal(unknown.status, 400);
});

test("details include normalized seasons, episode endpoints and group hints", async () => {
  installFetch((url) => {
    assert.equal(url.pathname, "/3/tv/777");
    assert.match(url.searchParams.get("append_to_response") ?? "", /episode_groups/);
    return jsonResponse({
      id: 777,
      name: "Example Show",
      original_name: "Example Show",
      overview: "A series",
      first_air_date: "2020-01-01",
      poster_path: "/poster.jpg",
      backdrop_path: "/backdrop.jpg",
      vote_average: 8.1,
      genres: [{ id: 18, name: "Drama" }],
      credits: { cast: [{ id: 9, name: "Actor", character: "Lead" }], crew: [] },
      videos: { results: [{ id: "v1", key: "abc", site: "YouTube", type: "Trailer" }] },
      images: { backdrops: [{ file_path: "/backdrop.jpg", width: 1280, height: 720 }], posters: [] },
      keywords: { results: [{ id: 1, name: "anime" }] },
      recommendations: { results: [] },
      similar: { results: [] },
      external_ids: { imdb_id: "tt123" },
      seasons: [
        {
          id: 900,
          name: "Season 1",
          season_number: 1,
          episode_count: 12,
          air_date: "2020-01-01",
          poster_path: "/season.jpg",
        },
      ],
      episode_groups: {
        results: [
          {
            id: "group123",
            name: "Seasons",
            type: 6,
            group_count: 2,
            episode_count: 24,
          },
        ],
      },
    });
  });

  const response = await detailsGET(
    mobileRequest("/api/mobile/v1/details?mediaType=tv&id=777"),
  );
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.data.id, 777);
  assert.equal(body.data.mediaType, "tv");
  assert.equal(body.data.tv.seasons.length, 1);
  assert.equal(
    body.data.tv.seasons[0].episodesEndpoint,
    "/api/mobile/v1/episodes?tvId=777&season=1",
  );
  assert.equal(body.data.tv.recommendedEpisodeGroupId, "group123");
  assert.equal(body.data.tv.episodeGroups[0].endpoint, "/api/mobile/v1/episode-groups?groupId=group123");
  assert.equal(body.data.externalIds.imdbId, "tt123");
  assert.equal(body.meta.imageBaseUrl, "https://image.tmdb.org/t/p/");
});

test("episodes return playback-ready numbers and reject invalid seasons", async () => {
  installFetch((url) => {
    assert.equal(url.pathname, "/3/tv/42/season/2");
    return jsonResponse({
      id: 800,
      name: "Season 2",
      air_date: "2021-01-01",
      poster_path: "/season2.jpg",
      episodes: [
        {
          id: 1,
          name: "Pilot",
          overview: "Start",
          season_number: 2,
          episode_number: 1,
          air_date: "2021-01-01",
          runtime: 44,
          still_path: "/e1.jpg",
        },
        {
          id: 2,
          name: "Second",
          season_number: 2,
          episode_number: 2,
          air_date: "2021-01-08",
          runtime: 42,
        },
      ],
    });
  });

  const response = await episodesGET(
    mobileRequest("/api/mobile/v1/episodes?tvId=42&season=2"),
  );
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.data.totalEpisodes, 2);
  assert.equal(body.data.episodes[1].episodeNumber, 2);
  assert.equal(body.data.episodes[1].tmdbSeasonNumber, 2);
  assert.equal(body.data.episodes[1].tmdbEpisodeNumber, 2);

  const invalid = await episodesGET(
    mobileRequest("/api/mobile/v1/episodes?tvId=42&season=1000"),
  );
  assert.equal(invalid.status, 400);
  assert.equal(fetchCalls.length, 1);
});

test("episode groups preserve the existing season-group ordering logic", async () => {
  installFetch((url) => {
    assert.equal(url.pathname, "/3/tv/episode_group/group123");
    return jsonResponse({
      id: "group123",
      name: "Seasons",
      description: "Alternate order",
      type: 6,
      group_count: 2,
      episode_count: 2,
      tv_id: 42,
      groups: [
        {
          id: "g1",
          name: "Season 1",
          order: 1,
          episodes: [
            {
              id: 11,
              name: "First",
              season_number: 1,
              episode_number: 1,
              order: 0,
              air_date: "2020-01-01",
            },
          ],
        },
        {
          id: "g2",
          name: "Season 2",
          order: 2,
          episodes: [
            {
              id: 12,
              name: "Next",
              season_number: 1,
              episode_number: 2,
              order: 0,
              air_date: "2020-01-08",
            },
          ],
        },
      ],
    });
  });

  const response = await episodeGroupGET(
    mobileRequest("/api/mobile/v1/episode-groups?groupId=group123"),
  );
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.data.tvId, 42);
  assert.equal(body.data.seasons.length, 2);
  assert.equal(body.data.seasons[0].seasonNumber, 1);
  assert.equal(body.data.seasons[1].seasonNumber, 2);
  assert.equal(body.data.seasons[1].episodes[0].tmdbSeasonNumber, 1);
  assert.equal(body.data.seasons[1].episodes[0].tmdbEpisodeNumber, 2);
  assert.equal(body.data.seasons[1].episodes[0].absoluteEpisodeNumber, 2);
});

test("Cloudflare Cache API responses are reused when the in-isolate cache is cold", async () => {
  installFetch(() =>
    jsonResponse({
      page: 1,
      total_pages: 1,
      total_results: 1,
      results: [{ id: 55, title: "Popular", poster_path: "/p.jpg" }],
    }),
  );

  const path = "/api/mobile/v1/list?content=movie&collection=popular&page=1";
  const first = await listGET(mobileRequest(path));
  assert.equal(first.status, 200);
  assert.equal(first.headers.get("x-mobile-cache"), "MISS");

  mobileCache.clear();
  mobileRateLimiter.clear();
  const second = await listGET(mobileRequest(path));
  assert.equal(second.status, 200);
  assert.equal(second.headers.get("x-mobile-cache"), "HIT");
  assert.equal((await second.json()).ok, true);
  assert.equal(fetchCalls.length, 1);
});

test("optional app key is enforced and disables public CDN/Worker caching", async () => {
  const key = "local-app-secret-1234567890";
  process.env.MOBILE_API_KEY = key;
  installFetch(() =>
    jsonResponse({
      page: 1,
      total_pages: 1,
      total_results: 1,
      results: [{ id: 66, title: "Gated" }],
    }),
  );

  const path = "/api/mobile/v1/list?content=movie&collection=top_rated&page=1";
  const unauthorized = await listGET(mobileRequest(path));
  assert.equal(unauthorized.status, 401);
  assert.equal((await unauthorized.json()).error.code, "client_unauthorized");
  assert.equal(fetchCalls.length, 0);

  mobileRateLimiter.clear();
  const authorized = await listGET(
    mobileRequest(path, { "x-snapflix-mobile-key": key }),
  );
  assert.equal(authorized.status, 200);
  assert.match(authorized.headers.get("cache-control") ?? "", /private.*no-store/);
  assert.equal(authorized.headers.get("cdn-cache-control"), "no-store");
  assert.equal(authorized.headers.get("x-mobile-cdn-cache"), "disabled");
  assert.doesNotMatch(authorized.headers.get("cache-control") ?? "", /s-maxage/);
  assert.equal(edgeCache.size, 0);
  assert.equal(fetchCalls.length, 1);

  mobileRateLimiter.clear();
  const unauthorizedAfterCache = await listGET(mobileRequest(path));
  assert.equal(unauthorizedAfterCache.status, 401);
  assert.equal(fetchCalls.length, 1);
});

test("upstream rate limits are surfaced without caching the error", async () => {
  installFetch(() =>
    new Response("{}", {
      status: 429,
      headers: { "retry-after": "9", "content-type": "application/json" },
    }),
  );

  const response = await detailsGET(
    mobileRequest("/api/mobile/v1/details?mediaType=movie&id=555"),
  );
  const body = await response.json();

  assert.equal(response.status, 503);
  assert.equal(body.error.code, "upstream_rate_limited");
  assert.equal(body.error.retryable, true);
  assert.equal(response.headers.get("retry-after"), "9");
  assert.match(response.headers.get("cache-control") ?? "", /no-store/);
  assert.equal(response.headers.get("x-mobile-cache"), "BYPASS");
});

test("home returns partial rows when one TMDB row fails", async () => {
  installFetch((url) => {
    if (url.pathname === "/3/trending/tv/day") {
      return new Response("{}", {
        status: 500,
        headers: { "content-type": "application/json" },
      });
    }
    return jsonResponse({
      page: 1,
      total_pages: 1,
      total_results: 1,
      results: [
        {
          id: 301,
          name: "Available Show",
          backdrop_path: "/backdrop.jpg",
          poster_path: "/poster.jpg",
          first_air_date: "2024-01-01",
        },
      ],
    });
  });

  const response = await homeGET(mobileRequest("/api/mobile/v1/home?content=tv&page=1"));
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.data.rows.length, 4);
  assert.equal(body.data.partial, true);
  assert.equal(body.data.failedRows.length, 1);
  assert.equal(body.data.failedRows[0].id, "trending_day");
  assert.equal(body.data.failedRows[0].retryable, true);
  assert.match(response.headers.get("cache-control") ?? "", /s-maxage=30/);
  assert.equal(response.headers.get("x-mobile-cdn-cache"), "enabled");
});

test("genre Discover returns normalized and TMDB-compatible fields", async () => {
  installFetch((url) => {
    assert.equal(url.pathname, "/3/discover/movie");
    assert.equal(url.searchParams.get("with_genres"), "12,28");
    assert.equal(url.searchParams.get("sort_by"), "vote_average.desc");
    assert.equal(url.searchParams.get("include_adult"), "false");
    assert.equal(url.searchParams.get("page"), "2");
    assert.equal(url.searchParams.get("language"), "en-US");
    return jsonResponse({
      page: 2,
      total_pages: 3,
      total_results: 60,
      results: [
        {
          id: 77,
          title: "Action Drama",
          poster_path: "/ad.jpg",
          release_date: "2022-01-01",
          vote_average: 7.8,
          genre_ids: [12, 28],
          media_type: "movie",
        },
      ],
    });
  });

  const response = await discoverGET(
    mobileRequest(
      "/api/mobile/v1/discover?mediaType=movie&with_genres=28,12&sort_by=vote_average.desc&page=2",
    ),
  );
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(body.data.genres, [12, 28]);
  assert.equal(body.data.with_genres, "12,28");
  assert.equal(body.data.sortBy, "vote_average.desc");
  assert.equal(body.data.sort_by, "vote_average.desc");
  assert.equal(body.data.total_pages, 3);
  assert.equal(body.data.totalResults, 60);
  assert.equal(body.data.nextPage, 3);
  assert.match(body.data.endpoint, /\/api\/mobile\/v1\/discover\?/);
  assert.equal(body.data.results[0].mediaType, "movie");
});

test("genre list supports the mobile type alias", async () => {
  installFetch((url) => {
    assert.equal(url.pathname, "/3/genre/tv/list");
    return jsonResponse({
      genres: [
        { id: 18, name: "Drama" },
        { id: 10765, name: "Sci-Fi & Fantasy" },
      ],
    });
  });

  const response = await genresGET(mobileRequest("/api/mobile/v1/genres?type=tv"));
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.data.content, "tv");
  assert.equal(body.data.media_type, "tv");
  assert.equal(body.data.genres.length, 2);
  assert.equal(body.data.tmdb.genres.length, 2);
});

test("IMDb lookup supports query, alias and path-style compatibility routes", async () => {
  installFetch((url) => {
    assert.match(url.pathname, /^\/3\/find\/tt\d+$/);
    assert.equal(url.searchParams.get("external_source"), "imdb_id");
    assert.equal(url.searchParams.get("language"), "en-US");
    return jsonResponse({
      movie_results: [
        {
          id: 101,
          title: "Movie",
          poster_path: "/m.jpg",
          release_date: "2020-01-01",
          vote_average: 7.5,
          genre_ids: [18],
          media_type: "movie",
          original_language: "en",
        },
      ],
      tv_results: [
        {
          id: 202,
          name: "Show",
          poster_path: "/s.jpg",
          first_air_date: "2021-01-01",
          media_type: "tv",
        },
      ],
      tv_episode_results: [],
      tv_season_results: [],
      person_results: [{ id: 999, name: "Person", media_type: "person" }],
    });
  });

  const response = await findGET(
    mobileRequest("/api/mobile/v1/find?imdb_id=1234567&mediaType=movie"),
  );
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.data.imdbId, "tt1234567");
  assert.equal(body.data.external_source, "imdb_id");
  assert.equal(body.data.requestedMediaType, "movie");
  assert.equal(body.data.mediaType, "movie");
  assert.equal(body.data.tmdbId, 101);
  assert.equal(body.data.match.posterPath, "/m.jpg");
  assert.equal(body.data.movie_results[0].poster_path, "/m.jpg");
  assert.equal(body.data.results.length, 1);
  assert.equal(body.data.tv_results.length, 1);
  assert.equal(body.data.person_results.length, 0);

  const lookupAlias = await lookupGET(
    mobileRequest("/api/mobile/v1/lookup?imdbId=tt1234567"),
  );
  assert.equal(lookupAlias.status, 200);

  const pathAlias = await findPathGET(
    mobileRequest("/api/mobile/v1/find/tt7654321"),
    { params: Promise.resolve({ imdbId: "tt7654321" }) },
  );
  assert.equal(pathAlias.status, 200);
  assert.equal((await pathAlias.json()).data.imdbId, "tt7654321");
});

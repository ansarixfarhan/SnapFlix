/** Shared, fixed limits for the mobile metadata API. */
export const MOBILE_API_VERSION = "v1";
export const MOBILE_API_PREFIX = `/api/mobile/${MOBILE_API_VERSION}`;
export const TMDB_BASE_URL = "https://api.themoviedb.org/3";
export const TMDB_IMAGE_BASE_URL = "https://image.tmdb.org/t/p/";

export const MAX_SEARCH_LENGTH = 120;
export const MAX_PAGE = 500;
export const MAX_TMDB_ID = 999_999_999;
export const MAX_SEASON_NUMBER = 999;
export const MAX_GROUP_ID_LENGTH = 64;
export const MAX_UPSTREAM_BODY_BYTES = 4_000_000;
export const UPSTREAM_TIMEOUT_MS = 8_000;
export const MAX_GENRE_IDS = 10;
export const MAX_GENRE_ID = 9_999;
export const MAX_FIND_RESULTS_PER_TYPE = 20;

export const HOME_ROW_LIMIT = 20;
export const HERO_LIMIT = 5;
export const CAST_LIMIT = 20;
export const CREW_LIMIT = 20;
export const VIDEO_LIMIT = 15;
export const IMAGE_LIMIT = 12;
export const KEYWORD_LIMIT = 20;
export const RECOMMENDATION_LIMIT = 12;

export const DEFAULT_SORT_BY = "popularity.desc";
export const VALID_SORT_BY = [
  "popularity.desc",
  "popularity.asc",
  "release_date.desc",
  "release_date.asc",
  "vote_average.desc",
  "vote_average.asc",
  "original_title.asc",
  "original_title.desc",
] as const;
export type MobileDiscoverSortBy = (typeof VALID_SORT_BY)[number];

/** HTTP cache TTLs (seconds). The in-isolate data cache uses the same values. */
export const MOBILE_CACHE_TTL = {
  home: 600,
  partialHome: 30,
  list: 600,
  search: 300,
  details: 1_800,
  episodes: 1_800,
  episodeGroup: 86_400,
  discover: 600,
  genres: 86_400,
  find: 86_400,
} as const;

export const EDGE_STALE_WHILE_REVALIDATE = 300;
export const EDGE_STALE_IF_ERROR = 600;
export const BROWSER_MAX_AGE = 60;

/** Per-isolate request budget. Cloudflare WAF/rate-limiting is the global layer. */
export const MOBILE_RATE_LIMIT = {
  limit: 60,
  windowMs: 60_000,
  maxKeys: 4_096,
  memoryMaxEntries: 300,
} as const;

export const MOBILE_API_KEY_HEADER = "x-snapflix-mobile-key";
export const MOBILE_CACHE_HEADER = "x-mobile-cache";
export const MOBILE_CDN_CACHE_HEADER = "x-mobile-cdn-cache";

export const MOVIE_APPEND_TO_RESPONSE =
  "images,videos,credits,keywords,recommendations,similar,external_ids";
export const TV_APPEND_TO_RESPONSE =
  "images,videos,credits,keywords,recommendations,similar,external_ids,episode_groups";

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
export const MAX_KEYWORD_IDS = 10;
export const MAX_KEYWORD_ID = 9_999_999;
export const MAX_COUNTRY_CODES = 5;
export const MAX_FIND_RESULTS_PER_TYPE = 20;
export const MAX_REVIEWS = 5;
export const MAX_CERTIFICATIONS = 30;
export const MAX_COLLECTION_PARTS = 50;

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
  "first_air_date.desc",
  "first_air_date.asc",
  "primary_release_date.desc",
  "primary_release_date.asc",
  "vote_average.desc",
  "vote_average.asc",
  "vote_count.desc",
  "vote_count.asc",
  "original_title.asc",
  "original_title.desc",
] as const;
export type MobileDiscoverSortBy = (typeof VALID_SORT_BY)[number];

export const VALID_ORIGINAL_LANGUAGES = [
  "ja",
  "ko",
  "en",
  "zh",
  "hi",
  "es",
  "fr",
  "de",
  "it",
  "pt",
  "th",
  "id",
] as const;
export const VALID_ORIGIN_COUNTRIES = [
  "JP",
  "KR",
  "US",
  "GB",
  "IN",
  "CN",
  "TW",
  "HK",
  "TH",
  "FR",
  "DE",
  "ES",
  "IT",
] as const;

/**
 * Fixed Discover presets used by the mobile app. Explicit client filters always
 * win; presets only fill values the client did not provide.
 */
export const DISCOVER_PRESETS = {
  none: {
    defaultContent: "movie",
    genreIds: [],
    withGenres: "",
    originalLanguage: null,
    originCountry: null,
    keywords: "",
    withoutKeywords: "",
  },
  anime: {
    defaultContent: "tv",
    genreIds: [16],
    withGenres: "16",
    originalLanguage: "ja",
    originCountry: "JP",
    keywords: "210024",
    withoutKeywords: "158718|155477",
  },
  korean: {
    defaultContent: "tv",
    genreIds: [],
    withGenres: "",
    originalLanguage: "ko",
    originCountry: "KR",
    keywords: "",
    withoutKeywords: "",
  },
  kdrama: {
    defaultContent: "tv",
    genreIds: [18],
    withGenres: "18",
    originalLanguage: "ko",
    originCountry: "KR",
    keywords: "",
    withoutKeywords: "",
  },
} as const;
export type MobileDiscoverPreset = keyof typeof DISCOVER_PRESETS;
export const DISCOVER_PRESET_VALUES = Object.keys(DISCOVER_PRESETS) as MobileDiscoverPreset[];

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
  titleLogos: 86_400,
  collection: 86_400,
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
export const TMDB_LOGO_LANGUAGES = "en,null";

export const MOVIE_APPEND_TO_RESPONSE =
  "images,videos,credits,keywords,recommendations,similar,external_ids,reviews,release_dates";
export const TV_APPEND_TO_RESPONSE =
  "images,videos,credits,keywords,recommendations,similar,external_ids,episode_groups,reviews,content_ratings";

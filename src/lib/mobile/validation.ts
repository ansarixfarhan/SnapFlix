import {
  MAX_GROUP_ID_LENGTH,
  MAX_PAGE,
  MAX_SEARCH_LENGTH,
  MAX_SEASON_NUMBER,
  MAX_TMDB_ID,
  MOBILE_API_PREFIX,
} from "./constants";
import { cleanText, hasControlCharacters, safeGroupId } from "./text";
import type {
  MediaType,
  MobileCollection,
  MobileSearchType,
} from "./types";

export type QueryLike = {
  get(name: string): string | null;
  getAll(name: string): string[];
  keys(): Iterable<string>;
};

export type ValidationResult<T> = { ok: true; value: T } | { ok: false; error: string };

export type HomeParams = { content: MediaType; page: number };
export type ListParams = { content: MediaType; collection: MobileCollection; page: number };
export type SearchParams = { q: string; type: MobileSearchType; page: number };
export type DetailsParams = { mediaType: MediaType; id: number };
export type EpisodesParams = { tvId: number; season: number };
export type EpisodeGroupParams = { groupId: string };

export type MobileTmdbRequest = {
  path: string;
  params: Record<string, string | number | boolean>;
};

const INVALID_PARAMS = "Unknown, duplicate or unsupported query parameter.";
const INVALID_PAGE = "Page must be an integer between 1 and 500.";
const INVALID_MEDIA_TYPE = "mediaType must be either movie or tv.";
const INVALID_ID = "A valid TMDB id is required.";
const INVALID_SEASON = "Season must be an integer between 0 and 999.";

const MEDIA_TYPES: readonly MediaType[] = ["movie", "tv"];
const SEARCH_TYPES: readonly MobileSearchType[] = ["multi", "movie", "tv"];

export const HOME_COLLECTIONS: Record<
  MediaType,
  { id: MobileCollection; title: string }[]
> = {
  movie: [
    { id: "trending_day", title: "Today's Trending Movies" },
    { id: "trending_week", title: "This Week's Trending Movies" },
    { id: "popular", title: "Popular Movies" },
    { id: "now_playing", title: "Now Playing Movies" },
    { id: "upcoming", title: "Upcoming Movies" },
    { id: "top_rated", title: "Top Rated Movies" },
  ],
  tv: [
    { id: "trending_day", title: "Today's Trending TV Shows" },
    { id: "trending_week", title: "This Week's Trending TV Shows" },
    { id: "popular", title: "Popular TV Shows" },
    { id: "on_the_air", title: "On The Air TV Shows" },
    { id: "top_rated", title: "Top Rated TV Shows" },
  ],
};

export const COLLECTION_PATHS: Record<
  MediaType,
  Partial<Record<MobileCollection, string>>
> = {
  movie: {
    trending_day: "/trending/movie/day",
    trending_week: "/trending/movie/week",
    popular: "/movie/popular",
    now_playing: "/movie/now_playing",
    upcoming: "/movie/upcoming",
    top_rated: "/movie/top_rated",
  },
  tv: {
    trending_day: "/trending/tv/day",
    trending_week: "/trending/tv/week",
    popular: "/tv/popular",
    on_the_air: "/tv/on_the_air",
    top_rated: "/tv/top_rated",
  },
};

const COLLECTION_TITLES: Record<MediaType, Partial<Record<MobileCollection, string>>> = {
  movie: Object.fromEntries(HOME_COLLECTIONS.movie.map((item) => [item.id, item.title])),
  tv: Object.fromEntries(HOME_COLLECTIONS.tv.map((item) => [item.id, item.title])),
};

export function validateAllowedParams(
  params: QueryLike,
  allowed: readonly string[],
): string | null {
  const allowedSet = new Set(allowed);
  const keys = [...new Set(params.keys())];

  if (keys.length > allowed.length) return INVALID_PARAMS;
  for (const key of keys) {
    if (!allowedSet.has(key)) return INVALID_PARAMS;
    if (params.getAll(key).length > 1) return INVALID_PARAMS;
  }
  return null;
}

function one(params: QueryLike, name: string): string | null {
  const values = params.getAll(name);
  return values.length === 0 ? null : values[0];
}

function parseInteger(
  raw: string | null,
  options: {
    defaultValue?: number;
    min: number;
    max: number;
    required?: boolean;
    errorMessage: string;
  },
): ValidationResult<number> {
  if (raw === null || raw === "") {
    if (options.required || options.defaultValue === undefined) {
      return { ok: false, error: options.errorMessage };
    }
    return { ok: true, value: options.defaultValue };
  }
  if (raw.length > 10 || !/^\d+$/.test(raw)) return { ok: false, error: options.errorMessage };
  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed) || parsed < options.min || parsed > options.max) {
    return { ok: false, error: options.errorMessage };
  }
  return { ok: true, value: parsed };
}

function parseMediaType(raw: string | null, required = false): ValidationResult<MediaType> {
  if (raw === null || raw === "") {
    if (required) return { ok: false, error: INVALID_MEDIA_TYPE };
    return { ok: true, value: "movie" };
  }
  if (!MEDIA_TYPES.includes(raw as MediaType)) return { ok: false, error: INVALID_MEDIA_TYPE };
  return { ok: true, value: raw as MediaType };
}

function parseSearchType(raw: string | null): ValidationResult<MobileSearchType> {
  if (raw === null || raw === "") return { ok: true, value: "multi" };
  if (!SEARCH_TYPES.includes(raw as MobileSearchType)) {
    return { ok: false, error: "type must be multi, movie or tv." };
  }
  return { ok: true, value: raw as MobileSearchType };
}

function parseCollection(
  raw: string | null,
  content: MediaType,
): ValidationResult<MobileCollection> {
  if (raw === null || raw === "") return { ok: false, error: "A valid collection is required." };
  if (!COLLECTION_PATHS[content][raw as MobileCollection]) {
    return { ok: false, error: "That collection is not available for this content type." };
  }
  return { ok: true, value: raw as MobileCollection };
}

export function parseHomeParams(params: QueryLike): ValidationResult<HomeParams> {
  const paramsError = validateAllowedParams(params, ["content", "page"]);
  if (paramsError) return { ok: false, error: paramsError };

  const content = parseMediaType(one(params, "content"));
  if (!content.ok) return content;
  const page = parseInteger(one(params, "page"), {
    defaultValue: 1,
    min: 1,
    max: MAX_PAGE,
    errorMessage: INVALID_PAGE,
  });
  if (!page.ok) return page;
  return { ok: true, value: { content: content.value, page: page.value } };
}

export function parseListParams(params: QueryLike): ValidationResult<ListParams> {
  const paramsError = validateAllowedParams(params, ["content", "collection", "page"]);
  if (paramsError) return { ok: false, error: paramsError };

  const content = parseMediaType(one(params, "content"));
  if (!content.ok) return content;
  const collection = parseCollection(one(params, "collection"), content.value);
  if (!collection.ok) return collection;
  const page = parseInteger(one(params, "page"), {
    defaultValue: 1,
    min: 1,
    max: MAX_PAGE,
    errorMessage: INVALID_PAGE,
  });
  if (!page.ok) return page;
  return {
    ok: true,
    value: { content: content.value, collection: collection.value, page: page.value },
  };
}

export function parseSearchParams(params: QueryLike): ValidationResult<SearchParams> {
  const paramsError = validateAllowedParams(params, ["q", "type", "page"]);
  if (paramsError) return { ok: false, error: paramsError };

  const rawQuery = one(params, "q");
  if (
    rawQuery === null ||
    rawQuery.length > MAX_SEARCH_LENGTH * 4 ||
    Array.from(rawQuery.trim()).length > MAX_SEARCH_LENGTH ||
    hasControlCharacters(rawQuery)
  ) {
    return { ok: false, error: "q must be a search string of at most 120 characters." };
  }
  const q = cleanText(rawQuery, MAX_SEARCH_LENGTH);
  if (!q) return { ok: false, error: "q must be a non-empty search string." };

  const type = parseSearchType(one(params, "type"));
  if (!type.ok) return type;
  const page = parseInteger(one(params, "page"), {
    defaultValue: 1,
    min: 1,
    max: MAX_PAGE,
    errorMessage: INVALID_PAGE,
  });
  if (!page.ok) return page;
  return { ok: true, value: { q, type: type.value, page: page.value } };
}

export function parseDetailsParams(params: QueryLike): ValidationResult<DetailsParams> {
  const paramsError = validateAllowedParams(params, ["mediaType", "id"]);
  if (paramsError) return { ok: false, error: paramsError };

  const mediaType = parseMediaType(one(params, "mediaType"), true);
  if (!mediaType.ok) return mediaType;
  const id = parseInteger(one(params, "id"), {
    required: true,
    min: 1,
    max: MAX_TMDB_ID,
    errorMessage: INVALID_ID,
  });
  if (!id.ok) return id;
  return { ok: true, value: { mediaType: mediaType.value, id: id.value } };
}

export function parseEpisodesParams(params: QueryLike): ValidationResult<EpisodesParams> {
  const paramsError = validateAllowedParams(params, ["tvId", "season"]);
  if (paramsError) return { ok: false, error: paramsError };

  const tvId = parseInteger(one(params, "tvId"), {
    required: true,
    min: 1,
    max: MAX_TMDB_ID,
    errorMessage: INVALID_ID,
  });
  if (!tvId.ok) return tvId;
  const season = parseInteger(one(params, "season"), {
    required: true,
    min: 0,
    max: MAX_SEASON_NUMBER,
    errorMessage: INVALID_SEASON,
  });
  if (!season.ok) return season;
  return { ok: true, value: { tvId: tvId.value, season: season.value } };
}

export function parseEpisodeGroupParams(params: QueryLike): ValidationResult<EpisodeGroupParams> {
  const paramsError = validateAllowedParams(params, ["groupId"]);
  if (paramsError) return { ok: false, error: paramsError };

  const raw = one(params, "groupId");
  if (raw === null || raw.length > MAX_GROUP_ID_LENGTH || hasControlCharacters(raw)) {
    return { ok: false, error: "A valid episode group id is required." };
  }
  const groupId = safeGroupId(raw);
  if (!groupId) return { ok: false, error: "A valid episode group id is required." };
  return { ok: true, value: { groupId } };
}

export function collectionRequest(
  content: MediaType,
  collection: MobileCollection,
  page: number,
): MobileTmdbRequest | null {
  const path = COLLECTION_PATHS[content][collection];
  if (!path) return null;
  return { path, params: { page } };
}

export function collectionTitle(content: MediaType, collection: MobileCollection): string {
  return COLLECTION_TITLES[content][collection] ?? "TMDB Collection";
}

export function buildListEndpoint(
  content: MediaType,
  collection: MobileCollection,
  page: number,
): string {
  const query = new URLSearchParams({ content, collection, page: String(page) });
  return `${MOBILE_API_PREFIX}/list?${query.toString()}`;
}

export function buildSearchEndpoint(q: string, type: MobileSearchType, page: number): string {
  const query = new URLSearchParams({ q, type, page: String(page) });
  return `${MOBILE_API_PREFIX}/search?${query.toString()}`;
}

export function buildEpisodesEndpoint(tvId: number, season: number): string {
  const query = new URLSearchParams({ tvId: String(tvId), season: String(season) });
  return `${MOBILE_API_PREFIX}/episodes?${query.toString()}`;
}

export function buildEpisodeGroupEndpoint(groupId: string): string {
  const query = new URLSearchParams({ groupId });
  return `${MOBILE_API_PREFIX}/episode-groups?${query.toString()}`;
}

export const homeCacheKey = ({ content, page }: HomeParams): string =>
  `home:${content}:${page}`;
export const listCacheKey = ({ content, collection, page }: ListParams): string =>
  `list:${content}:${collection}:${page}`;
export const searchCacheKey = ({ q, type, page }: SearchParams): string =>
  `search:${type}:${q.toLocaleLowerCase("en-US")}:${page}`;
export const detailsCacheKey = ({ mediaType, id }: DetailsParams): string =>
  `details:${mediaType}:${id}`;
export const episodesCacheKey = ({ tvId, season }: EpisodesParams): string =>
  `episodes:${tvId}:${season}`;
export const episodeGroupCacheKey = ({ groupId }: EpisodeGroupParams): string =>
  `episode-group:${groupId}`;

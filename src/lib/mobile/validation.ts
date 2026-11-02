import {
  DEFAULT_SORT_BY,
  DISCOVER_PRESETS,
  DISCOVER_PRESET_VALUES,
  MAX_COUNTRY_CODES,
  MAX_GENRE_ID,
  MAX_GENRE_IDS,
  MAX_GROUP_ID_LENGTH,
  MAX_KEYWORD_ID,
  MAX_KEYWORD_IDS,
  MAX_PAGE,
  MAX_SEARCH_LENGTH,
  MAX_SEASON_NUMBER,
  MAX_TMDB_ID,
  MOBILE_API_PREFIX,
  VALID_ORIGINAL_LANGUAGES,
  VALID_ORIGIN_COUNTRIES,
  VALID_SORT_BY,
  type MobileDiscoverPreset,
  type MobileDiscoverSortBy,
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
export type DiscoverParams = {
  content: MediaType;
  preset: MobileDiscoverPreset;
  genreIds: number[];
  withGenres: string;
  sortBy: MobileDiscoverSortBy;
  page: number;
  originalLanguage: string | null;
  originCountry: string | null;
  keywordIds: number[];
  keywords: string;
  withoutKeywordIds: number[];
  withoutKeywords: string;
};
export type TitleLogoParams = { mediaType: MediaType; id: number };
export type CollectionParams = { collectionId: number };
export type GenresParams = { content: MediaType };
export type FindParams = {
  imdbId: string;
  mediaType: MobileSearchType;
  externalSource: "imdb_id";
};

export type MobileTmdbRequest = {
  path: string;
  params: Record<string, string | number | boolean>;
};

const INVALID_PARAMS = "Unknown, duplicate or unsupported query parameter.";
const INVALID_PAGE = "Page must be an integer between 1 and 500.";
const INVALID_MEDIA_TYPE = "mediaType must be either movie or tv.";
const INVALID_ID = "A valid TMDB id is required.";
const INVALID_SEASON = "Season must be an integer between 0 and 999.";
const INVALID_GENRES = "Genres must be a short list of numeric TMDB genre ids.";
const INVALID_SORT = "sortBy must be one of the supported TMDB sort values.";
const INVALID_PRESET = "filter must be one of: none, anime, korean, kdrama.";
const INVALID_LANGUAGE = "originalLanguage must be one of the supported language codes.";
const INVALID_COUNTRY = "originCountry must be one of the supported country codes.";
const INVALID_KEYWORDS = "Keywords must be a short list of numeric TMDB keyword ids.";
const INVALID_IMDB_ID = "A valid IMDb title id is required.";

const MEDIA_TYPES: readonly MediaType[] = ["movie", "tv"];
const SEARCH_TYPES: readonly MobileSearchType[] = ["multi", "movie", "tv"];
const DISCOVER_PARAM_NAMES = [
  "content",
  "mediaType",
  "type",
  "genres",
  "with_genres",
  "genre",
  "page",
  "sortBy",
  "sort_by",
  "sort",
  "preset",
  "filter",
  "category",
  "originalLanguage",
  "with_original_language",
  "originCountry",
  "with_origin_country",
  "keywords",
  "with_keywords",
  "excludeKeywords",
  "without_keywords",
] as const;
const TITLE_LOGO_PARAM_NAMES = ["mediaType", "content", "type", "id"] as const;
const COLLECTION_PARAM_NAMES = ["collectionId", "collection_id", "id"] as const;
const FIND_PARAM_NAMES = [
  "imdbId",
  "imdb_id",
  "externalId",
  "id",
  "externalSource",
  "external_source",
  "content",
  "mediaType",
  "type",
] as const;

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
  allowRepeated: readonly string[] = [],
): string | null {
  const allowedSet = new Set(allowed);
  const repeatedSet = new Set(allowRepeated);
  const keys = [...new Set(params.keys())];

  if (keys.length > allowed.length) return INVALID_PARAMS;
  for (const key of keys) {
    if (!allowedSet.has(key)) return INVALID_PARAMS;
    if (!repeatedSet.has(key) && params.getAll(key).length > 1) return INVALID_PARAMS;
  }
  return null;
}

function one(params: QueryLike, name: string): string | null {
  const values = params.getAll(name);
  return values.length === 0 ? null : values[0];
}

function aliasValues(params: QueryLike, names: readonly string[]): string[] {
  const values: string[] = [];
  for (const name of names) {
    for (const raw of params.getAll(name)) {
      const value = raw.trim();
      if (value) values.push(value);
    }
  }
  return values;
}

function parseAliasEnum(
  params: QueryLike,
  names: readonly string[],
  allowed: readonly string[],
  defaultValue: string,
  errorMessage: string,
): ValidationResult<string> {
  const values = aliasValues(params, names);
  if (values.length === 0) return { ok: true, value: defaultValue };

  const unique = [...new Set(values.map((value) => value.toLowerCase()))];
  if (unique.length !== 1 || !allowed.includes(unique[0])) {
    return { ok: false, error: errorMessage };
  }
  return { ok: true, value: unique[0] };
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

function parseGenres(params: QueryLike): { ids: number[]; withGenres: string } | null {
  const values = aliasValues(params, ["genres", "with_genres", "genre"]);
  if (values.length === 0) return { ids: [], withGenres: "" };

  const usesComma = values.some((value) => value.includes(","));
  const usesPipe = values.some((value) => value.includes("|"));
  if (usesComma && usesPipe) return null;
  const separator = usesPipe ? "|" : ",";
  const ids: number[] = [];

  for (const value of values) {
    if (value.length > 200 || hasControlCharacters(value)) return null;
    for (const part of value.split(/[,\|]/)) {
      const trimmed = part.trim();
      if (!/^\d{1,6}$/.test(trimmed)) return null;
      const parsed = Number(trimmed);
      if (parsed < 1 || parsed > MAX_GENRE_ID) return null;
      ids.push(parsed);
    }
  }

  const unique = [...new Set(ids)].sort((a, b) => a - b);
  if (unique.length > MAX_GENRE_IDS) return null;
  return { ids: unique, withGenres: unique.join(separator) };
}

function parseSortBy(params: QueryLike): MobileDiscoverSortBy | null {
  const values = aliasValues(params, ["sortBy", "sort_by", "sort"]);
  if (values.length === 0) return DEFAULT_SORT_BY as MobileDiscoverSortBy;
  const unique = [...new Set(values)];
  if (unique.length !== 1) return null;
  if (!(VALID_SORT_BY as readonly string[]).includes(unique[0])) return null;
  return unique[0] as MobileDiscoverSortBy;
}

function parseNumericList(
  params: QueryLike,
  names: readonly string[],
  maxId: number,
  maxCount: number,
): { ids: number[]; value: string } | null {
  const values = aliasValues(params, names);
  if (values.length === 0) return { ids: [], value: "" };

  const usesComma = values.some((value) => value.includes(","));
  const usesPipe = values.some((value) => value.includes("|"));
  if (usesComma && usesPipe) return null;
  const separator = usesPipe ? "|" : ",";
  const ids: number[] = [];

  for (const value of values) {
    if (value.length > 200 || hasControlCharacters(value)) return null;
    for (const part of value.split(/[,\|]/)) {
      const trimmed = part.trim();
      if (!/^\d{1,7}$/.test(trimmed)) return null;
      const parsed = Number(trimmed);
      if (parsed < 1 || parsed > maxId) return null;
      ids.push(parsed);
    }
  }

  const unique = [...new Set(ids)].sort((a, b) => a - b);
  if (unique.length > maxCount) return null;
  return { ids: unique, value: unique.join(separator) };
}

function parseOriginalLanguage(params: QueryLike): string | null {
  const values = aliasValues(params, ["originalLanguage", "with_original_language"]);
  if (values.length === 0) return null;
  const unique = [...new Set(values.map((value) => value.toLowerCase()))];
  if (unique.length !== 1) return INVALID_LANGUAGE;
  if (!(VALID_ORIGINAL_LANGUAGES as readonly string[]).includes(unique[0])) return INVALID_LANGUAGE;
  return unique[0];
}

function parseOriginCountry(params: QueryLike): string | null {
  const values = aliasValues(params, ["originCountry", "with_origin_country"]);
  if (values.length === 0) return null;
  const unique = [...new Set(values.map((value) => value.toUpperCase()))];
  if (unique.length !== 1 || unique[0].length > MAX_COUNTRY_CODES * 3) return INVALID_COUNTRY;
  const codes = unique[0].split(/[,\|]/).map((code) => code.trim());
  if (
    codes.length > MAX_COUNTRY_CODES ||
    codes.some((code) => !(VALID_ORIGIN_COUNTRIES as readonly string[]).includes(code))
  ) {
    return INVALID_COUNTRY;
  }
  return codes.join(",");
}

function parsePreset(params: QueryLike): MobileDiscoverPreset | null {
  const rawAliases = aliasValues(params, ["content", "mediaType", "type"]);
  const presetFromAliases = rawAliases.filter((value) =>
    DISCOVER_PRESET_VALUES.includes(value.toLowerCase() as MobileDiscoverPreset),
  );
  const values = [
    ...aliasValues(params, ["preset", "filter", "category"]),
    ...presetFromAliases,
  ];
  if (values.length === 0) return "none";

  const normalized = values.map((value) => {
    const lower = value.toLowerCase();
    return lower === "all" ? "none" : lower;
  });
  const unique = [...new Set(normalized)];
  if (unique.length !== 1 || !DISCOVER_PRESET_VALUES.includes(unique[0] as MobileDiscoverPreset)) {
    return null;
  }
  return unique[0] as MobileDiscoverPreset;
}

function parseDiscoverContent(
  params: QueryLike,
  preset: MobileDiscoverPreset,
): MediaType | null {
  const rawValues = aliasValues(params, ["content", "mediaType", "type"]);
  const mediaValues = rawValues
    .map((value) => value.toLowerCase())
    .filter(
      (value) =>
        value !== "all" && !DISCOVER_PRESET_VALUES.includes(value as MobileDiscoverPreset),
    );
  if (mediaValues.length === 0) return DISCOVER_PRESETS[preset].defaultContent as MediaType;

  const unique = [...new Set(mediaValues)];
  if (unique.length !== 1 || !MEDIA_TYPES.includes(unique[0] as MediaType)) return null;
  return unique[0] as MediaType;
}

function splitNumericString(value: string): number[] {
  if (!value) return [];
  return value
    .split(/[,\|]/)
    .map((part) => Number(part.trim()))
    .filter((id) => Number.isSafeInteger(id) && id > 0);
}

function normalizeImdbId(raw: string): string | null {
  const value = raw.trim();
  if (/^tt\d{7,10}$/i.test(value)) return value.toLowerCase();
  if (/^\d{7,10}$/.test(value)) return `tt${value}`;
  return null;
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

export function parseDiscoverParams(params: QueryLike): ValidationResult<DiscoverParams> {
  const paramsError = validateAllowedParams(params, DISCOVER_PARAM_NAMES, [
    "genres",
    "with_genres",
    "genre",
    "keywords",
    "with_keywords",
    "excludeKeywords",
    "without_keywords",
  ]);
  if (paramsError) return { ok: false, error: paramsError };

  const preset = parsePreset(params);
  if (!preset) return { ok: false, error: INVALID_PRESET };
  const content = parseDiscoverContent(params, preset);
  if (!content) return { ok: false, error: INVALID_MEDIA_TYPE };

  const page = parseInteger(one(params, "page"), {
    defaultValue: 1,
    min: 1,
    max: MAX_PAGE,
    errorMessage: INVALID_PAGE,
  });
  if (!page.ok) return page;

  const genres = parseGenres(params);
  if (!genres) return { ok: false, error: INVALID_GENRES };
  const sortBy = parseSortBy(params);
  if (!sortBy) return { ok: false, error: INVALID_SORT };

  const language = parseOriginalLanguage(params);
  if (language === INVALID_LANGUAGE) return { ok: false, error: INVALID_LANGUAGE };
  const country = parseOriginCountry(params);
  if (country === INVALID_COUNTRY) return { ok: false, error: INVALID_COUNTRY };
  const keywords = parseNumericList(
    params,
    ["keywords", "with_keywords"],
    MAX_KEYWORD_ID,
    MAX_KEYWORD_IDS,
  );
  if (!keywords) return { ok: false, error: INVALID_KEYWORDS };
  const withoutKeywords = parseNumericList(
    params,
    ["excludeKeywords", "without_keywords"],
    MAX_KEYWORD_ID,
    MAX_KEYWORD_IDS,
  );
  if (!withoutKeywords) return { ok: false, error: INVALID_KEYWORDS };

  const presetConfig = DISCOVER_PRESETS[preset];
  const resolvedGenres = genres.withGenres || presetConfig.withGenres;
  const resolvedGenreIds = genres.ids.length > 0 ? genres.ids : [...presetConfig.genreIds];
  const resolvedLanguage = language ?? presetConfig.originalLanguage;
  const resolvedCountry = country ?? presetConfig.originCountry;
  const resolvedKeywords = keywords.value || presetConfig.keywords;
  const resolvedKeywordIds =
    keywords.ids.length > 0 ? keywords.ids : splitNumericString(presetConfig.keywords);
  const resolvedWithoutKeywords = withoutKeywords.value || presetConfig.withoutKeywords;
  const resolvedWithoutKeywordIds =
    withoutKeywords.ids.length > 0
      ? withoutKeywords.ids
      : splitNumericString(presetConfig.withoutKeywords);

  return {
    ok: true,
    value: {
      content,
      preset,
      genreIds: resolvedGenreIds,
      withGenres: resolvedGenres,
      sortBy,
      page: page.value,
      originalLanguage: resolvedLanguage || null,
      originCountry: resolvedCountry || null,
      keywordIds: resolvedKeywordIds,
      keywords: resolvedKeywords,
      withoutKeywordIds: resolvedWithoutKeywordIds,
      withoutKeywords: resolvedWithoutKeywords,
    },
  };
}

export function parseTitleLogoParams(params: QueryLike): ValidationResult<TitleLogoParams> {
  const paramsError = validateAllowedParams(params, TITLE_LOGO_PARAM_NAMES);
  if (paramsError) return { ok: false, error: paramsError };

  const mediaType = parseAliasEnum(
    params,
    ["mediaType", "content", "type"],
    MEDIA_TYPES,
    "",
    INVALID_MEDIA_TYPE,
  );
  if (!mediaType.ok || !mediaType.value) return { ok: false, error: INVALID_MEDIA_TYPE };
  const id = parseInteger(one(params, "id"), {
    required: true,
    min: 1,
    max: MAX_TMDB_ID,
    errorMessage: INVALID_ID,
  });
  if (!id.ok) return id;
  return { ok: true, value: { mediaType: mediaType.value as MediaType, id: id.value } };
}

export function parseCollectionParams(params: QueryLike): ValidationResult<CollectionParams> {
  const paramsError = validateAllowedParams(params, COLLECTION_PARAM_NAMES);
  if (paramsError) return { ok: false, error: paramsError };

  const ids = aliasValues(params, COLLECTION_PARAM_NAMES);
  if (ids.length !== 1) return { ok: false, error: INVALID_ID };
  const collectionId = parseInteger(ids[0], {
    required: true,
    min: 1,
    max: MAX_TMDB_ID,
    errorMessage: INVALID_ID,
  });
  if (!collectionId.ok) return collectionId;
  return { ok: true, value: { collectionId: collectionId.value } };
}

export function parseGenresParams(params: QueryLike): ValidationResult<GenresParams> {
  const paramsError = validateAllowedParams(params, ["content", "mediaType", "type"]);
  if (paramsError) return { ok: false, error: paramsError };

  const content = parseAliasEnum(
    params,
    ["content", "mediaType", "type"],
    MEDIA_TYPES,
    "movie",
    INVALID_MEDIA_TYPE,
  );
  if (!content.ok) return content;
  return { ok: true, value: { content: content.value as MediaType } };
}

export function parseFindParams(
  params: QueryLike,
  pathImdbId?: string,
): ValidationResult<FindParams> {
  const paramsError = validateAllowedParams(params, FIND_PARAM_NAMES);
  if (paramsError) return { ok: false, error: paramsError };

  const rawIds = aliasValues(params, ["imdbId", "imdb_id", "externalId", "id"]);
  if (pathImdbId !== undefined && pathImdbId !== null && pathImdbId.trim()) {
    rawIds.push(pathImdbId.trim());
  }
  if (rawIds.length === 0) return { ok: false, error: INVALID_IMDB_ID };

  const normalizedIds = rawIds.map(normalizeImdbId);
  if (normalizedIds.some((id) => id === null)) return { ok: false, error: INVALID_IMDB_ID };
  const uniqueIds = [...new Set(normalizedIds as string[])];
  if (uniqueIds.length !== 1) return { ok: false, error: INVALID_IMDB_ID };

  const sources = aliasValues(params, ["externalSource", "external_source"]);
  if (sources.some((source) => source !== "imdb_id")) {
    return { ok: false, error: "Only externalSource=imdb_id is supported." };
  }

  const mediaType = parseAliasEnum(
    params,
    ["content", "mediaType", "type"],
    SEARCH_TYPES,
    "multi",
    "type must be multi, movie or tv.",
  );
  if (!mediaType.ok) return mediaType;

  return {
    ok: true,
    value: {
      imdbId: uniqueIds[0],
      mediaType: mediaType.value as MobileSearchType,
      externalSource: "imdb_id",
    },
  };
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

export function buildDiscoverEndpoint(
  params: DiscoverParams,
  page: number = params.page,
): string {
  const query = new URLSearchParams({
    content: params.content,
    sortBy: params.sortBy,
    page: String(page),
  });
  if (params.preset !== "none") query.set("filter", params.preset);
  if (params.withGenres) query.set("genres", params.withGenres);
  if (params.originalLanguage) query.set("originalLanguage", params.originalLanguage);
  if (params.originCountry) query.set("originCountry", params.originCountry);
  if (params.keywords) query.set("keywords", params.keywords);
  if (params.withoutKeywords) query.set("excludeKeywords", params.withoutKeywords);
  return `${MOBILE_API_PREFIX}/discover?${query.toString()}`;
}

export function buildTitleLogosEndpoint(mediaType: MediaType, id: number): string {
  const query = new URLSearchParams({ mediaType, id: String(id) });
  return `${MOBILE_API_PREFIX}/title-logos?${query.toString()}`;
}

export function buildCollectionEndpoint(collectionId: number): string {
  const query = new URLSearchParams({ collectionId: String(collectionId) });
  return `${MOBILE_API_PREFIX}/collection?${query.toString()}`;
}

export function buildGenresEndpoint(content: MediaType): string {
  const query = new URLSearchParams({ content });
  return `${MOBILE_API_PREFIX}/genres?${query.toString()}`;
}

export function buildFindEndpoint(imdbId: string, mediaType: MobileSearchType): string {
  const query = new URLSearchParams({ imdbId });
  if (mediaType !== "multi") query.set("mediaType", mediaType);
  return `${MOBILE_API_PREFIX}/find?${query.toString()}`;
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
export const discoverCacheKey = ({
  content,
  preset,
  withGenres,
  sortBy,
  page,
  originalLanguage,
  originCountry,
  keywords,
  withoutKeywords,
}: DiscoverParams): string =>
  [
    "discover",
    content,
    preset,
    withGenres || "all",
    sortBy,
    page,
    originalLanguage || "any",
    originCountry || "any",
    keywords || "none",
    withoutKeywords || "none",
  ].join(":");
export const titleLogoCacheKey = ({ mediaType, id }: TitleLogoParams): string =>
  `title-logos:${mediaType}:${id}`;
export const collectionCacheKey = ({ collectionId }: CollectionParams): string =>
  `collection:${collectionId}`;
export const genresCacheKey = ({ content }: GenresParams): string => `genres:${content}`;
export const findCacheKey = ({ imdbId, mediaType }: FindParams): string =>
  `find:${imdbId}:${mediaType}`;

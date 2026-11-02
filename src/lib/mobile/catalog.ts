import {
  HERO_LIMIT,
  HOME_ROW_LIMIT,
  MAX_PAGE,
  MOBILE_CACHE_TTL,
  MOVIE_APPEND_TO_RESPONSE,
  TMDB_LOGO_LANGUAGES,
  TV_APPEND_TO_RESPONSE,
} from "./constants";
import { mobileCache } from "./cache";
import { internalError, MobileError } from "./errors";
import {
  normalizeCollectionResponse,
  normalizeDetails,
  normalizeEpisodeGroup,
  normalizeEpisodes,
  normalizeFindResponse,
  normalizeGenres,
  normalizeListPage,
  normalizeTitleLogoResponse,
} from "./normalize";
import { mobileTmdbGet, mobileTmdbGetList, type TmdbRawList } from "./tmdb";
import type { RawRecord } from "./text";
import type {
  MediaType,
  MobileCollection,
  MobileCollectionResponse,
  MobileDetails,
  MobileDiscoverResponse,
  MobileEpisodeGroupResponse,
  MobileEpisodesResponse,
  MobileFindResponse,
  MobileGenreListResponse,
  MobileHomeFailure,
  MobileHomeResponse,
  MobileHomeRow,
  MobileListPage,
  MobileListResponse,
  MobileSearchResponse,
  MobileTitleLogoResponse,
} from "./types";
import {
  buildDiscoverEndpoint,
  buildListEndpoint,
  buildSearchEndpoint,
  collectionRequest,
  collectionTitle,
  HOME_COLLECTIONS,
  type CollectionParams,
  type DetailsParams,
  type DiscoverParams,
  type EpisodeGroupParams,
  type EpisodesParams,
  type FindParams,
  type GenresParams,
  type HomeParams,
  type ListParams,
  type SearchParams,
  type TitleLogoParams,
} from "./validation";

function nextPage(page: number, totalPages: number): number | null {
  const candidate = page + 1;
  return page < totalPages && candidate <= MAX_PAGE ? candidate : null;
}

function toPublicRowError(error: unknown): MobileError {
  return error instanceof MobileError
    ? error
    : internalError();
}

async function collectionPage(
  content: MediaType,
  collection: MobileCollection,
  page: number,
): Promise<MobileListPage> {
  const request = collectionRequest(content, collection, page);
  if (!request) throw internalError();

  return mobileCache.run(
    `collection:${content}:${collection}:${page}`,
    MOBILE_CACHE_TTL.list * 1_000,
    async () => {
      const raw: TmdbRawList = await mobileTmdbGetList(
        request.path,
        request.params,
        MOBILE_CACHE_TTL.list,
      );
      return normalizeListPage(raw, content);
    },
  );
}

function buildHomeRow(
  spec: { id: MobileCollection; title: string },
  content: MediaType,
  page: number,
  list: MobileListPage,
): MobileHomeRow {
  const followingPage = nextPage(list.page, list.totalPages);
  return {
    id: spec.id,
    title: spec.title,
    ...list,
    results: list.results.slice(0, HOME_ROW_LIMIT),
    nextPage: followingPage,
    endpoint: followingPage ? buildListEndpoint(content, spec.id, followingPage) : null,
  };
}

export async function getMobileHome(params: HomeParams): Promise<MobileHomeResponse> {
  const specs = HOME_COLLECTIONS[params.content];
  const settled = await Promise.allSettled(
    specs.map((spec) => collectionPage(params.content, spec.id, params.page)),
  );

  const rows: MobileHomeRow[] = [];
  const failedRows: MobileHomeFailure[] = [];

  settled.forEach((result, index) => {
    const spec = specs[index];
    if (result.status === "fulfilled") {
      rows.push(buildHomeRow(spec, params.content, params.page, result.value));
      return;
    }

    const error = toPublicRowError(result.reason);
    failedRows.push({
      id: spec.id,
      title: spec.title,
      code: error.code,
      message: error.message,
      retryable: error.retryable,
    });
  });

  // If every row failed, keep the original upstream status/error for the client.
  if (rows.length === 0) {
    throw toPublicRowError((settled[0] as PromiseRejectedResult).reason);
  }

  const firstRow = rows[0]?.results ?? [];
  const withBackdrops = firstRow.filter((item) => item.backdropPath !== null);
  const hero = (withBackdrops.length > 0 ? withBackdrops : firstRow).slice(0, HERO_LIMIT);

  return {
    content: params.content,
    page: params.page,
    featuredCollection: rows[0]?.id ?? null,
    hero,
    rows,
    partial: failedRows.length > 0,
    failedRows,
  };
}

export async function getMobileList(params: ListParams): Promise<MobileListResponse> {
  const list = await collectionPage(params.content, params.collection, params.page);
  const followingPage = nextPage(list.page, list.totalPages);

  return {
    content: params.content,
    collection: params.collection,
    title: collectionTitle(params.content, params.collection),
    ...list,
    results: list.results.slice(0, HOME_ROW_LIMIT),
    nextPage: followingPage,
    endpoint: followingPage
      ? buildListEndpoint(params.content, params.collection, followingPage)
      : null,
  };
}

export async function getMobileSearch(params: SearchParams): Promise<MobileSearchResponse> {
  const path = params.type === "multi" ? "/search/multi" : `/search/${params.type}`;
  const raw = await mobileTmdbGetList(
    path,
    {
      query: params.q,
      page: params.page,
      include_adult: false,
    },
    MOBILE_CACHE_TTL.search,
  );
  const list = normalizeListPage(raw, params.type === "multi" ? undefined : params.type);
  const followingPage = nextPage(list.page, list.totalPages);

  return {
    query: params.q,
    type: params.type,
    ...list,
    results: list.results.slice(0, HOME_ROW_LIMIT),
    nextPage: followingPage,
    endpoint: followingPage ? buildSearchEndpoint(params.q, params.type, followingPage) : null,
  };
}

export async function getMobileDiscover(
  params: DiscoverParams,
): Promise<MobileDiscoverResponse> {
  const raw = await mobileTmdbGetList(
    `/discover/${params.content}`,
    {
      page: params.page,
      include_adult: false,
      sort_by: params.sortBy,
      with_genres: params.withGenres || undefined,
      with_original_language: params.originalLanguage || undefined,
      with_origin_country: params.originCountry || undefined,
      with_keywords: params.keywords || undefined,
      without_keywords: params.withoutKeywords || undefined,
    },
    MOBILE_CACHE_TTL.discover,
  );
  const list = normalizeListPage(raw, params.content);
  const followingPage = nextPage(list.page, list.totalPages);

  return {
    content: params.content,
    mediaType: params.content,
    media_type: params.content,
    preset: params.preset,
    filter: params.preset,
    genres: params.genreIds,
    genre_ids: params.genreIds,
    with_genres: params.withGenres,
    sortBy: params.sortBy,
    sort_by: params.sortBy,
    originalLanguage: params.originalLanguage,
    with_original_language: params.originalLanguage,
    originCountry: params.originCountry,
    with_origin_country: params.originCountry,
    keywords: params.keywords,
    with_keywords: params.keywords,
    withoutKeywords: params.withoutKeywords,
    without_keywords: params.withoutKeywords,
    filters: {
      preset: params.preset,
      genres: params.genreIds,
      originalLanguage: params.originalLanguage,
      originCountry: params.originCountry,
      keywords: params.keywordIds,
      withoutKeywords: params.withoutKeywordIds,
    },
    ...list,
    total_pages: list.totalPages,
    total_results: list.totalResults,
    results: list.results.slice(0, HOME_ROW_LIMIT),
    nextPage: followingPage,
    endpoint: followingPage ? buildDiscoverEndpoint(params, followingPage) : null,
  };
}

export async function getMobileGenres(
  params: GenresParams,
): Promise<MobileGenreListResponse> {
  const raw = await mobileTmdbGet<RawRecord>(
    `/genre/${params.content}/list`,
    {},
    MOBILE_CACHE_TTL.genres,
  );
  const genres = normalizeGenres(raw.genres);

  return {
    content: params.content,
    mediaType: params.content,
    media_type: params.content,
    genres,
    totalGenres: genres.length,
    tmdb: { genres },
  };
}

export async function getMobileDetails(params: DetailsParams): Promise<MobileDetails> {
  const append =
    params.mediaType === "movie" ? MOVIE_APPEND_TO_RESPONSE : TV_APPEND_TO_RESPONSE;
  const raw = await mobileTmdbGet<RawRecord>(
    `/${params.mediaType}/${params.id}`,
    {
      append_to_response: append,
      include_image_language: TMDB_LOGO_LANGUAGES,
    },
    MOBILE_CACHE_TTL.details,
  );
  return normalizeDetails(raw, params.mediaType);
}

export async function getMobileEpisodes(params: EpisodesParams): Promise<MobileEpisodesResponse> {
  const raw = await mobileTmdbGet<RawRecord>(
    `/tv/${params.tvId}/season/${params.season}`,
    {},
    MOBILE_CACHE_TTL.episodes,
  );
  return normalizeEpisodes(raw, params.tvId, params.season);
}

export async function getMobileEpisodeGroup(
  params: EpisodeGroupParams,
): Promise<MobileEpisodeGroupResponse> {
  const raw = await mobileTmdbGet<RawRecord>(
    `/tv/episode_group/${params.groupId}`,
    {},
    MOBILE_CACHE_TTL.episodeGroup,
  );
  return normalizeEpisodeGroup(raw, params.groupId);
}

export async function getMobileFind(params: FindParams): Promise<MobileFindResponse> {
  const raw = await mobileTmdbGet<RawRecord>(
    `/find/${params.imdbId}`,
    { external_source: params.externalSource },
    MOBILE_CACHE_TTL.find,
  );
  return normalizeFindResponse(raw, params);
}

export async function getMobileTitleLogos(
  params: TitleLogoParams,
): Promise<MobileTitleLogoResponse> {
  const raw = await mobileTmdbGet<RawRecord>(
    `/${params.mediaType}/${params.id}/images`,
    { include_image_language: TMDB_LOGO_LANGUAGES },
    MOBILE_CACHE_TTL.titleLogos,
  );
  return normalizeTitleLogoResponse(raw, params);
}

export async function getMobileCollection(
  params: CollectionParams,
): Promise<MobileCollectionResponse> {
  const raw = await mobileTmdbGet<RawRecord>(
    `/collection/${params.collectionId}`,
    {},
    MOBILE_CACHE_TTL.collection,
  );
  return normalizeCollectionResponse(raw, params);
}

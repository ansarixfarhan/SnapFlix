import {
  HERO_LIMIT,
  HOME_ROW_LIMIT,
  MAX_PAGE,
  MOBILE_CACHE_TTL,
  MOVIE_APPEND_TO_RESPONSE,
  TV_APPEND_TO_RESPONSE,
} from "./constants";
import { mobileCache } from "./cache";
import { MobileError } from "./errors";
import {
  normalizeDetails,
  normalizeEpisodeGroup,
  normalizeEpisodes,
  normalizeListPage,
} from "./normalize";
import { mobileTmdbGet, mobileTmdbGetList, type TmdbRawList } from "./tmdb";
import type { RawRecord } from "./text";
import type {
  MediaType,
  MobileCollection,
  MobileDetails,
  MobileEpisodeGroupResponse,
  MobileEpisodesResponse,
  MobileHomeResponse,
  MobileListPage,
  MobileListResponse,
  MobileSearchResponse,
} from "./types";
import {
  buildListEndpoint,
  buildSearchEndpoint,
  collectionRequest,
  collectionTitle,
  HOME_COLLECTIONS,
  type DetailsParams,
  type EpisodeGroupParams,
  type EpisodesParams,
  type HomeParams,
  type ListParams,
  type SearchParams,
} from "./validation";

function nextPage(page: number, totalPages: number): number | null {
  const candidate = page + 1;
  return page < totalPages && candidate <= MAX_PAGE ? candidate : null;
}

async function collectionPage(
  content: MediaType,
  collection: MobileCollection,
  page: number,
): Promise<MobileListPage> {
  const request = collectionRequest(content, collection, page);
  if (!request) {
    throw new MobileError("internal_error", 500, "The mobile metadata service could not complete the request.");
  }

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

export async function getMobileHome(params: HomeParams): Promise<MobileHomeResponse> {
  const specs = HOME_COLLECTIONS[params.content];
  const pages = await Promise.all(
    specs.map((spec) => collectionPage(params.content, spec.id, params.page)),
  );

  const rows = specs.map((spec, index) => {
    const list = pages[index];
    const followingPage = nextPage(list.page, list.totalPages);
    return {
      id: spec.id,
      title: spec.title,
      ...list,
      results: list.results.slice(0, HOME_ROW_LIMIT),
      nextPage: followingPage,
      endpoint: followingPage
        ? buildListEndpoint(params.content, spec.id, followingPage)
        : null,
    };
  });

  const firstRow = rows[0]?.results ?? [];
  const withBackdrops = firstRow.filter((item) => item.backdropPath !== null);
  const hero = (withBackdrops.length > 0 ? withBackdrops : firstRow).slice(0, HERO_LIMIT);

  return {
    content: params.content,
    page: params.page,
    featuredCollection: specs[0]?.id ?? null,
    hero,
    rows,
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

export async function getMobileDetails(params: DetailsParams): Promise<MobileDetails> {
  const append =
    params.mediaType === "movie" ? MOVIE_APPEND_TO_RESPONSE : TV_APPEND_TO_RESPONSE;
  const raw = await mobileTmdbGet<RawRecord>(
    `/${params.mediaType}/${params.id}`,
    { append_to_response: append },
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

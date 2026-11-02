/**
 * Public response contracts for the separate SnapFlix mobile metadata API.
 *
 * These types are intentionally independent from the website's TMDB client and
 * provider/stream-resolver payloads. Mobile clients get small, predictable
 * metadata objects; playback remains the app's existing responsibility.
 */

import type { MobileDiscoverSortBy } from "./constants";

export type MediaType = "movie" | "tv";
export type MobileSearchType = MediaType | "multi";

export type MobileCollection =
  | "trending_day"
  | "trending_week"
  | "popular"
  | "now_playing"
  | "on_the_air"
  | "upcoming"
  | "top_rated";

export type MobileErrorCode =
  | "bad_request"
  | "client_unauthorized"
  | "client_rate_limited"
  | "service_unconfigured"
  | "upstream_unauthorized"
  | "not_found"
  | "upstream_rate_limited"
  | "upstream_unavailable"
  | "internal_error";

export type MobileImage = {
  path: string | null;
  width: number;
  height: number;
  aspectRatio: number;
  voteAverage: number;
  language: string;
};

export type MobileVideo = {
  id: string;
  name: string;
  key: string;
  site: string;
  type: string;
  official: boolean;
  publishedAt: string;
};

export type MobileCastMember = {
  id: number;
  name: string;
  character: string;
  profilePath: string | null;
  order: number;
  popularity: number;
};

export type MobileCrewMember = {
  id: number;
  name: string;
  job: string;
  department: string;
  profilePath: string | null;
  popularity: number;
};

export type MobileKeyword = { id: number; name: string };
export type MobileGenre = { id: number; name: string };
export type MobileCompany = { id: number; name: string; logoPath: string | null; country: string };
export type MobileSpokenLanguage = { name: string; englishName: string; code: string };

export type MobileExternalIds = {
  imdbId: string;
  tvdbId: string;
  tvrageId: string;
  wikidataId: string;
  facebookId: string;
  instagramId: string;
  twitterId: string;
};

export type MobileCard = {
  id: number;
  mediaType: MediaType;
  title: string;
  originalTitle: string;
  posterPath: string | null;
  backdropPath: string | null;
  overview: string;
  releaseDate: string;
  voteAverage: number;
  voteCount: number;
  popularity: number;
  genreIds: number[];
  adult: boolean;
  originalLanguage: string;
};

export type MobileListPage = {
  page: number;
  totalPages: number;
  totalResults: number;
  results: MobileCard[];
};

export type MobileHomeRow = MobileListPage & {
  id: MobileCollection;
  title: string;
  nextPage: number | null;
  endpoint: string | null;
};

export type MobileHomeFailure = {
  id: MobileCollection;
  title: string;
  code: MobileErrorCode;
  message: string;
  retryable: boolean;
};

export type MobileHomeResponse = {
  content: MediaType;
  page: number;
  featuredCollection: MobileCollection | null;
  hero: MobileCard[];
  rows: MobileHomeRow[];
  partial: boolean;
  failedRows: MobileHomeFailure[];
};

export type MobileListResponse = MobileListPage & {
  content: MediaType;
  collection: MobileCollection;
  title: string;
  nextPage: number | null;
  endpoint: string | null;
};

export type MobileSearchResponse = MobileListPage & {
  query: string;
  type: MobileSearchType;
  nextPage: number | null;
  endpoint: string | null;
};

export type MobileGenreListResponse = {
  content: MediaType;
  mediaType: MediaType;
  media_type: MediaType;
  genres: MobileGenre[];
  totalGenres: number;
  tmdb: { genres: MobileGenre[] };
};

export type MobileDiscoverResponse = MobileListPage & {
  content: MediaType;
  mediaType: MediaType;
  media_type: MediaType;
  genres: number[];
  genre_ids: number[];
  with_genres: string;
  sortBy: MobileDiscoverSortBy;
  sort_by: MobileDiscoverSortBy;
  total_pages: number;
  total_results: number;
  nextPage: number | null;
  endpoint: string | null;
};

/**
 * A find result carries both the normalized camelCase DTO and TMDB-style
 * snake_case aliases, so older mobile clients can read either shape.
 */
export type MobileFindCard = MobileCard & {
  media_type: MediaType;
  name: string;
  original_title: string;
  original_name: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: string;
  first_air_date: string;
  vote_average: number;
  vote_count: number;
  genre_ids: number[];
  original_language: string;
};

export type MobileFindResponse = {
  imdbId: string;
  externalSource: "imdb_id";
  external_source: "imdb_id";
  requestedMediaType: MobileSearchType;
  mediaType: MediaType | null;
  tmdbId: number | null;
  match: MobileFindCard | null;
  results: MobileFindCard[];
  movie_results: MobileFindCard[];
  tv_results: MobileFindCard[];
  tv_episode_results: MobileFindCard[];
  tv_season_results: MobileFindCard[];
  person_results: MobileFindCard[];
};

export type MobileEpisode = {
  id: number;
  name: string;
  overview: string;
  seasonNumber: number;
  episodeNumber: number;
  airDate: string;
  runtime: number | null;
  stillPath: string | null;
  voteAverage: number;
  voteCount: number;
  productionCode: string;
  tmdbSeasonNumber: number | null;
  tmdbEpisodeNumber: number | null;
  absoluteEpisodeNumber: number | null;
};

export type MobileSeason = {
  id: number;
  name: string;
  seasonNumber: number;
  episodeCount: number;
  airDate: string;
  posterPath: string | null;
  overview: string;
  voteAverage: number;
  episodesEndpoint: string;
};

export type MobileEpisodeGroupSummary = {
  id: string;
  name: string;
  type: number;
  groupCount: number;
  episodeCount: number;
  endpoint: string;
};

export type MobileCredits = {
  cast: MobileCastMember[];
  crew: MobileCrewMember[];
};

export type MobileImages = {
  backdrops: MobileImage[];
  posters: MobileImage[];
};

export type MobileDetails = {
  id: number;
  mediaType: MediaType;
  title: string;
  originalTitle: string;
  tagline: string;
  overview: string;
  posterPath: string | null;
  backdropPath: string | null;
  releaseDate: string;
  status: string;
  adult: boolean;
  originalLanguage: string;
  voteAverage: number;
  voteCount: number;
  popularity: number;
  genres: MobileGenre[];
  productionCompanies: MobileCompany[];
  spokenLanguages: MobileSpokenLanguage[];
  credits: MobileCredits;
  videos: MobileVideo[];
  images: MobileImages;
  keywords: MobileKeyword[];
  recommendations: MobileCard[];
  similar: MobileCard[];
  externalIds: MobileExternalIds;
  movie?: {
    budget: number;
    revenue: number;
    runtime: number | null;
    imdbId: string;
  };
  tv?: {
    firstAirDate: string;
    lastAirDate: string;
    numberOfSeasons: number;
    numberOfEpisodes: number;
    episodeRunTime: number[];
    inProduction: boolean;
    networks: MobileCompany[];
    seasons: MobileSeason[];
    episodeGroups: MobileEpisodeGroupSummary[];
    recommendedEpisodeGroupId: string | null;
    recommendedEpisodeGroupEndpoint: string | null;
    nextEpisodeToAir: MobileEpisode | null;
    lastEpisodeToAir: MobileEpisode | null;
  };
};

export type MobileEpisodesResponse = {
  tvId: number;
  seasonNumber: number;
  name: string;
  overview: string;
  posterPath: string | null;
  airDate: string;
  totalEpisodes: number;
  episodes: MobileEpisode[];
};

export type MobileResolvedSeason = {
  id: string;
  name: string;
  seasonNumber: number;
  episodeCount: number;
  airDate: string;
  overview: string;
  episodes: MobileEpisode[];
};

export type MobileEpisodeGroupResponse = {
  groupId: string;
  name: string;
  description: string;
  type: number;
  groupCount: number;
  episodeCount: number;
  tvId: number | null;
  seasons: MobileResolvedSeason[];
};

export type MobileMeta = {
  version: string;
  imageBaseUrl: string;
  ttlSeconds: number;
  generatedAt: string;
};

export type MobileSuccess<T> = {
  ok: true;
  data: T;
  meta: MobileMeta;
};

export type MobileFailure = {
  ok: false;
  error: {
    code: MobileErrorCode;
    message: string;
    retryable: boolean;
  };
  meta: {
    version: string;
    imageBaseUrl: string;
  };
};

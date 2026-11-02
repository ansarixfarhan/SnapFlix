import {
  CAST_LIMIT,
  CREW_LIMIT,
  IMAGE_LIMIT,
  KEYWORD_LIMIT,
  MAX_PAGE,
  MAX_SEASON_NUMBER,
  MAX_TMDB_ID,
  RECOMMENDATION_LIMIT,
  TMDB_IMAGE_BASE_URL,
  VIDEO_LIMIT,
} from "./constants";
import { MobileError } from "./errors";
import {
  asBoolean,
  asInteger,
  asNumber,
  asNumberArray,
  asRecord,
  asRecordArray,
  asRounded,
  cleanText,
  safeDate,
  safeGroupId,
  safeImagePath,
  type RawRecord,
} from "./text";
import type { TmdbRawList } from "./tmdb";
import type {
  MediaType,
  MobileCard,
  MobileCastMember,
  MobileCompany,
  MobileCrewMember,
  MobileDetails,
  MobileEpisode,
  MobileEpisodeGroupResponse,
  MobileEpisodeGroupSummary,
  MobileEpisodesResponse,
  MobileExternalIds,
  MobileGenre,
  MobileImage,
  MobileKeyword,
  MobileListPage,
  MobileResolvedSeason,
  MobileSeason,
  MobileSpokenLanguage,
  MobileVideo,
} from "./types";
import {
  buildEpisodeGroupEndpoint,
  buildEpisodesEndpoint,
} from "./validation";
import {
  getSeasonGroupIdToSplit,
  resolveGroupToSeasons,
  type ResolvedSeason,
} from "../../utils/seasonResolver";

const scalarText = (value: unknown, maxLength: number): string =>
  cleanText(typeof value === "number" || typeof value === "boolean" ? String(value) : value, maxLength);

function positiveId(value: unknown): number | null {
  const parsed = asNumber(value, Number.NaN);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > MAX_TMDB_ID) return null;
  return parsed;
}

function optionalInteger(value: unknown, max = 9_999): number | null {
  const parsed = asNumber(value, Number.NaN);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > max) return null;
  return Math.trunc(parsed);
}

export function normalizeCard(raw: RawRecord, hint?: MediaType): MobileCard | null {
  const explicitType = raw.media_type;
  const mediaType: MediaType | undefined =
    explicitType === "movie" || explicitType === "tv" ? explicitType : hint;
  if (!mediaType) return null;

  const id = positiveId(raw.id);
  if (id === null) return null;

  const title = scalarText(raw.title ?? raw.name ?? raw.original_title ?? raw.original_name, 300);
  const originalTitle = scalarText(raw.original_title ?? raw.original_name ?? raw.title ?? raw.name, 300);

  return {
    id,
    mediaType,
    title: title || "Untitled",
    originalTitle: originalTitle || title || "Untitled",
    posterPath: safeImagePath(raw.poster_path),
    backdropPath: safeImagePath(raw.backdrop_path),
    overview: scalarText(raw.overview, 1_200),
    releaseDate: safeDate(raw.release_date ?? raw.first_air_date),
    voteAverage: asRounded(raw.vote_average, 0, 0, 10),
    voteCount: asInteger(raw.vote_count, 0, 0, 1_000_000_000),
    popularity: asRounded(raw.popularity, 0, 0, 1_000_000_000_000),
    genreIds: asNumberArray(raw.genre_ids),
    adult: asBoolean(raw.adult),
    originalLanguage: scalarText(raw.original_language, 20),
  };
}

export function normalizeCards(value: unknown, hint?: MediaType): MobileCard[] {
  const seen = new Set<string>();
  const cards: MobileCard[] = [];
  for (const raw of asRecordArray(value)) {
    const card = normalizeCard(raw, hint);
    if (!card) continue;
    const key = `${card.mediaType}:${card.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    cards.push(card);
  }
  return cards;
}

export function normalizeListPage(raw: TmdbRawList, hint?: MediaType): MobileListPage {
  const results = normalizeCards(raw.results, hint);
  return {
    page: asInteger(raw.page, 1, 1, MAX_PAGE),
    totalPages: asInteger(raw.total_pages, 1, 1, MAX_PAGE),
    totalResults: asInteger(raw.total_results, results.length, 0, 1_000_000_000),
    results,
  };
}

function normalizeImageArray(value: unknown): MobileImage[] {
  return asRecordArray(value)
    .slice(0, IMAGE_LIMIT)
    .map((raw) => ({
      path: safeImagePath(raw.file_path),
      width: asInteger(raw.width, 0, 0, 20_000),
      height: asInteger(raw.height, 0, 0, 20_000),
      aspectRatio: asRounded(raw.aspect_ratio, 0, 0, 100),
      voteAverage: asRounded(raw.vote_average, 0, 0, 10),
      language: scalarText(raw.iso_639_1, 20),
    }));
}

function normalizeVideoArray(value: unknown): MobileVideo[] {
  return asRecordArray(value)
    .slice(0, VIDEO_LIMIT)
    .map((raw) => ({
      id: scalarText(raw.id, 100),
      name: scalarText(raw.name, 300),
      key: scalarText(raw.key, 100),
      site: scalarText(raw.site, 50),
      type: scalarText(raw.type, 50),
      official: asBoolean(raw.official),
      publishedAt: scalarText(raw.published_at, 40),
    }));
}

function normalizeCast(value: unknown): MobileCastMember[] {
  return asRecordArray(value)
    .slice(0, CAST_LIMIT)
    .map((raw) => ({
      id: positiveId(raw.id) ?? 0,
      name: scalarText(raw.name, 200),
      character: scalarText(raw.character, 300),
      profilePath: safeImagePath(raw.profile_path),
      order: asInteger(raw.order, 0, 0, 10_000),
      popularity: asRounded(raw.popularity, 0, 0, 1_000_000),
    }));
}

function normalizeCrew(value: unknown): MobileCrewMember[] {
  return asRecordArray(value)
    .slice(0, CREW_LIMIT)
    .map((raw) => ({
      id: positiveId(raw.id) ?? 0,
      name: scalarText(raw.name, 200),
      job: scalarText(raw.job, 200),
      department: scalarText(raw.department, 200),
      profilePath: safeImagePath(raw.profile_path),
      popularity: asRounded(raw.popularity, 0, 0, 1_000_000),
    }));
}

function normalizeGenres(value: unknown): MobileGenre[] {
  return asRecordArray(value)
    .slice(0, 30)
    .map((raw) => ({
      id: asInteger(raw.id, 0, 0, MAX_TMDB_ID),
      name: scalarText(raw.name, 100),
    }));
}

function normalizeCompanies(value: unknown): MobileCompany[] {
  return asRecordArray(value)
    .slice(0, 20)
    .map((raw) => ({
      id: asInteger(raw.id, 0, 0, MAX_TMDB_ID),
      name: scalarText(raw.name, 200),
      logoPath: safeImagePath(raw.logo_path),
      country: scalarText(raw.origin_country, 20),
    }));
}

function normalizeSpokenLanguages(value: unknown): MobileSpokenLanguage[] {
  return asRecordArray(value)
    .slice(0, 20)
    .map((raw) => ({
      name: scalarText(raw.name, 100),
      englishName: scalarText(raw.english_name, 100),
      code: scalarText(raw.iso_639_1, 20),
    }));
}

function normalizeKeywords(value: unknown): MobileKeyword[] {
  const record = asRecord(value);
  const items = Array.isArray(record.keywords) ? record.keywords : record.results;
  return asRecordArray(items)
    .slice(0, KEYWORD_LIMIT)
    .map((raw) => ({
      id: asInteger(raw.id, 0, 0, MAX_TMDB_ID),
      name: scalarText(raw.name, 100),
    }));
}

function normalizeExternalIds(raw: RawRecord): MobileExternalIds {
  const ids = asRecord(raw.external_ids);
  return {
    imdbId: scalarText(ids.imdb_id ?? raw.imdb_id, 50),
    tvdbId: scalarText(ids.tvdb_id, 50),
    tvrageId: scalarText(ids.tvrage_id, 50),
    wikidataId: scalarText(ids.wikidata_id, 50),
    facebookId: scalarText(ids.facebook_id, 100),
    instagramId: scalarText(ids.instagram_id, 100),
    twitterId: scalarText(ids.twitter_id, 100),
  };
}

function normalizeEpisode(raw: RawRecord): MobileEpisode | null {
  const id = positiveId(raw.id);
  if (id === null) return null;
  const seasonNumber = asInteger(raw.season_number, 0, 0, MAX_SEASON_NUMBER);
  const episodeNumber = asInteger(raw.episode_number, 0, 0, 9_999);
  const runtime = optionalInteger(raw.runtime, 10_000);

  return {
    id,
    name: scalarText(raw.name, 300) || `Episode ${episodeNumber}`,
    overview: scalarText(raw.overview, 1_500),
    seasonNumber,
    episodeNumber,
    airDate: safeDate(raw.air_date),
    runtime: runtime !== null && runtime > 0 ? runtime : null,
    stillPath: safeImagePath(raw.still_path),
    voteAverage: asRounded(raw.vote_average, 0, 0, 10),
    voteCount: asInteger(raw.vote_count, 0, 0, 1_000_000_000),
    productionCode: scalarText(raw.production_code, 100),
    tmdbSeasonNumber: optionalInteger(raw.tmdb_season_number) ?? seasonNumber,
    tmdbEpisodeNumber: optionalInteger(raw.tmdb_episode_number) ?? episodeNumber,
    absoluteEpisodeNumber: optionalInteger(raw.absolute_episode_number, 1_000_000),
  };
}

function normalizeSeason(raw: RawRecord, tvId: number): MobileSeason {
  const seasonNumber = asInteger(raw.season_number, 0, 0, MAX_SEASON_NUMBER);
  return {
    id: asInteger(raw.id, 0, 0, MAX_TMDB_ID),
    name: scalarText(raw.name, 200) || `Season ${seasonNumber}`,
    seasonNumber,
    episodeCount: asInteger(raw.episode_count, 0, 0, 10_000),
    airDate: safeDate(raw.air_date),
    posterPath: safeImagePath(raw.poster_path),
    overview: scalarText(raw.overview, 1_000),
    voteAverage: asRounded(raw.vote_average, 0, 0, 10),
    episodesEndpoint: buildEpisodesEndpoint(tvId, seasonNumber),
  };
}

function normalizeEpisodeGroupSummaries(value: unknown): MobileEpisodeGroupSummary[] {
  const container = asRecord(value);
  const items = Array.isArray(container.results)
    ? container.results
    : Array.isArray(value)
      ? value
      : [];

  return asRecordArray(items)
    .slice(0, 20)
    .map((raw) => {
      const id = safeGroupId(scalarText(raw.id, 64));
      if (!id) return null;
      return {
        id,
        name: scalarText(raw.name, 200),
        type: asInteger(raw.type, 0, 0, 100),
        groupCount: asInteger(raw.group_count, 0, 0, 1_000),
        episodeCount: asInteger(raw.episode_count, 0, 0, 100_000),
        endpoint: buildEpisodeGroupEndpoint(id),
      };
    })
    .filter((item): item is MobileEpisodeGroupSummary => item !== null);
}

export function normalizeDetails(raw: RawRecord, mediaType: MediaType): MobileDetails {
  const id = positiveId(raw.id);
  if (id === null) {
    throw new MobileError("not_found", 404, "The requested TMDB title was not found.");
  }

  const credits = asRecord(raw.credits);
  const videos = asRecord(raw.videos);
  const images = asRecord(raw.images);
  const recommendations = asRecord(raw.recommendations);
  const similar = asRecord(raw.similar);
  const externalIds = normalizeExternalIds(raw);
  const title = scalarText(raw.title ?? raw.name ?? raw.original_title ?? raw.original_name, 300);

  const base: MobileDetails = {
    id,
    mediaType,
    title: title || "Untitled",
    originalTitle:
      scalarText(raw.original_title ?? raw.original_name ?? raw.title ?? raw.name, 300) || title || "Untitled",
    tagline: scalarText(raw.tagline, 300),
    overview: scalarText(raw.overview, 3_000),
    posterPath: safeImagePath(raw.poster_path),
    backdropPath: safeImagePath(raw.backdrop_path),
    releaseDate: safeDate(raw.release_date ?? raw.first_air_date),
    status: scalarText(raw.status, 100),
    adult: asBoolean(raw.adult),
    originalLanguage: scalarText(raw.original_language, 20),
    voteAverage: asRounded(raw.vote_average, 0, 0, 10),
    voteCount: asInteger(raw.vote_count, 0, 0, 1_000_000_000),
    popularity: asRounded(raw.popularity, 0, 0, 1_000_000_000_000),
    genres: normalizeGenres(raw.genres),
    productionCompanies: normalizeCompanies(raw.production_companies),
    spokenLanguages: normalizeSpokenLanguages(raw.spoken_languages),
    credits: {
      cast: normalizeCast(credits.cast),
      crew: normalizeCrew(credits.crew),
    },
    videos: normalizeVideoArray(videos.results),
    images: {
      backdrops: normalizeImageArray(images.backdrops),
      posters: normalizeImageArray(images.posters),
    },
    keywords: normalizeKeywords(raw.keywords),
    recommendations: normalizeCards(recommendations.results, mediaType).slice(0, RECOMMENDATION_LIMIT),
    similar: normalizeCards(similar.results, mediaType).slice(0, RECOMMENDATION_LIMIT),
    externalIds,
  };

  if (mediaType === "movie") {
    const runtime = optionalInteger(raw.runtime, 10_000);
    return {
      ...base,
      movie: {
        budget: asInteger(raw.budget, 0, 0, 1_000_000_000_000),
        revenue: asInteger(raw.revenue, 0, 0, 1_000_000_000_000),
        runtime: runtime !== null && runtime > 0 ? runtime : null,
        imdbId: externalIds.imdbId,
      },
    };
  }

  const groupId = safeGroupId(scalarText(getSeasonGroupIdToSplit(raw), 64));
  const seasons = asRecordArray(raw.seasons)
    .map((season) => normalizeSeason(season, id))
    .sort((a, b) => a.seasonNumber - b.seasonNumber);

  return {
    ...base,
    tv: {
      firstAirDate: safeDate(raw.first_air_date),
      lastAirDate: safeDate(raw.last_air_date),
      numberOfSeasons: asInteger(raw.number_of_seasons, 0, 0, 1_000),
      numberOfEpisodes: asInteger(raw.number_of_episodes, 0, 0, 100_000),
      episodeRunTime: asNumberArray(raw.episode_run_time),
      inProduction: asBoolean(raw.in_production),
      networks: normalizeCompanies(raw.networks),
      seasons,
      episodeGroups: normalizeEpisodeGroupSummaries(raw.episode_groups),
      recommendedEpisodeGroupId: groupId,
      recommendedEpisodeGroupEndpoint: groupId ? buildEpisodeGroupEndpoint(groupId) : null,
      nextEpisodeToAir: raw.next_episode_to_air
        ? normalizeEpisode(asRecord(raw.next_episode_to_air))
        : null,
      lastEpisodeToAir: raw.last_episode_to_air
        ? normalizeEpisode(asRecord(raw.last_episode_to_air))
        : null,
    },
  };
}

export function normalizeEpisodes(
  raw: RawRecord,
  tvId: number,
  seasonNumber: number,
): MobileEpisodesResponse {
  const episodes = asRecordArray(raw.episodes)
    .map((episode) => normalizeEpisode(episode))
    .filter((episode): episode is MobileEpisode => episode !== null)
    .sort((a, b) => a.episodeNumber - b.episodeNumber);

  return {
    tvId,
    seasonNumber,
    name: scalarText(raw.name, 200) || `Season ${seasonNumber}`,
    overview: scalarText(raw.overview, 1_500),
    posterPath: safeImagePath(raw.poster_path),
    airDate: safeDate(raw.air_date),
    totalEpisodes: episodes.length,
    episodes,
  };
}

export function normalizeEpisodeGroup(
  raw: RawRecord,
  groupId: string,
): MobileEpisodeGroupResponse {
  const resolved: ResolvedSeason[] = resolveGroupToSeasons(raw);
  const seasons: MobileResolvedSeason[] = resolved.map((season) => {
    const seasonNumber = asInteger(season.season_number, 0, 0, MAX_SEASON_NUMBER);
    const episodes = asRecordArray(season.episodes as unknown)
      .map((episode) => normalizeEpisode(episode))
      .filter((episode): episode is MobileEpisode => episode !== null)
      .sort((a, b) => a.episodeNumber - b.episodeNumber);

    return {
      id: scalarText(season.id, 100) || `group-${seasonNumber}`,
      name: scalarText(season.name, 200) || `Season ${seasonNumber}`,
      seasonNumber,
      episodeCount: episodes.length,
      airDate: safeDate(season.air_date),
      overview: scalarText(season.overview, 1_500),
      episodes,
    };
  });

  return {
    groupId,
    name: scalarText(raw.name, 200),
    description: scalarText(raw.description, 2_000),
    type: asInteger(raw.type, 0, 0, 100),
    groupCount: asInteger(raw.group_count, seasons.length, 0, 1_000),
    episodeCount: asInteger(raw.episode_count, 0, 0, 100_000),
    tvId: positiveId(raw.tv_id),
    seasons,
  };
}

/** Included in the API meta so mobile clients never need a separate config call. */
export const MOBILE_IMAGE_BASE_URL = TMDB_IMAGE_BASE_URL;

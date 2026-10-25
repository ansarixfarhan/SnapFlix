import { Episode } from "tmdb-ts/dist/types/tv-episode";
import { Season } from "tmdb-ts";

export interface ResolvedEpisode extends Episode {
  tmdb_season_number?: number;
  tmdb_episode_number?: number;
  absolute_episode_number?: number;
}

export interface ResolvedSeason extends Omit<Season, "air_date" | "poster_path"> {
  air_date?: string;
  poster_path?: string | null;
  vote_average?: number;
  episodes?: ResolvedEpisode[];
}

/**
 * Finds the most suitable episode group (e.g. "Seasons", "Broadcast", "Arcs")
 * that splits a continuous run into human-friendly seasons.
 */
export function findBestEpisodeGroup(episodeGroups: any): { id: string; name: string; group_count: number } | null {
  const groups: any[] = episodeGroups?.results || [];
  if (!groups || groups.length === 0) return null;

  // 1. Priority: Official "Seasons" group (type 6) with multiple groups
  const type6 = groups.find((g) => g.type === 6 && g.group_count > 1);
  if (type6) return type6;

  // 2. Named "Seasons"
  const namedSeasons = groups.find(
    (g) => g.name?.toLowerCase().trim() === "seasons" && g.group_count > 1
  );
  if (namedSeasons) return namedSeasons;

  // 3. Name contains "season"
  const containsSeason = groups.find(
    (g) => g.name?.toLowerCase().includes("season") && g.group_count > 1
  );
  if (containsSeason) return containsSeason;

  // 4. Broadcast / Arcs / Parts (type 4 or 5)
  const broadcastOrArcs = groups.find(
    (g) => (g.type === 4 || g.type === 5) && g.group_count > 1
  );
  if (broadcastOrArcs) return broadcastOrArcs;

  return null;
}

/**
 * Determines whether a TV show needs its seasons divided via episode groups.
 */
export function getSeasonGroupIdToSplit(tvShow: any): string | null {
  if (!tvShow) return null;
  const rawSeasons: any[] = (tvShow.seasons || []).filter((s: any) => s.season_number > 0);
  const bestGroup = findBestEpisodeGroup(tvShow.episode_groups);

  if (!bestGroup) return null;

  // If TMDB only lists 1 regular season, but the group has multiple seasons, split it!
  if (rawSeasons.length <= 1 && bestGroup.group_count > 1) {
    return bestGroup.id;
  }

  // Or if group count is significantly larger than raw seasons (e.g. 1 raw season vs 3-4 group seasons)
  if (bestGroup.group_count > rawSeasons.length) {
    return bestGroup.id;
  }

  return null;
}

/**
 * Converts TMDB Episode Group payload into an array of clean ResolvedSeason objects.
 */
export function resolveGroupToSeasons(groupData: any): ResolvedSeason[] {
  if (!groupData?.groups || !Array.isArray(groupData.groups)) return [];

  const now = Date.now();
  const sortedRawGroups = [...groupData.groups].sort((a: any, b: any) => (a.order || 0) - (b.order || 0));

  const resolved: ResolvedSeason[] = [];

  for (let i = 0; i < sortedRawGroups.length; i++) {
    const g = sortedRawGroups[i];
    const isSpecial = g.name?.toLowerCase().includes("special");
    
    // Determine season number (0 for Specials, otherwise order or 1-based index)
    let sNum = typeof g.order === "number" ? g.order : i + 1;
    if (isSpecial) {
      sNum = 0;
    } else if (sNum === 0) {
      // If specials was 0, shift regular to 1
      sNum = i === 0 ? 1 : i;
    }

    const rawEpisodes: any[] = g.episodes || [];
    const resolvedEpisodes: ResolvedEpisode[] = rawEpisodes.map((ep: any, epIdx: number) => {
      const relEpNum = typeof ep.order === "number" ? ep.order + 1 : epIdx + 1;
      return {
        ...ep,
        tmdb_season_number: ep.season_number,
        tmdb_episode_number: ep.episode_number,
        season_number: sNum,
        episode_number: relEpNum,
        absolute_episode_number: ep.episode_number,
      };
    });

    // Check first released episode date
    const firstEp = resolvedEpisodes[0];

    resolved.push({
      id: g.id || `group-${sNum}`,
      season_number: sNum,
      name: g.name || (sNum === 0 ? "Specials" : `Season ${sNum}`),
      episode_count: resolvedEpisodes.length,
      air_date: firstEp?.air_date || undefined,
      overview: g.description || "",
      poster_path: null,
      vote_average: 0,
      episodes: resolvedEpisodes,
    });
  }

  // Ensure Specials (season 0) is first or last, and regular seasons are ordered 1, 2, 3...
  return resolved.sort((a, b) => a.season_number - b.season_number);
}

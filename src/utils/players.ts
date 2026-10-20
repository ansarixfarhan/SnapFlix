import { PlayersProps } from "@/types";

/**
 * Generates a list of movie players with their respective titles and source URLs.
 * Uses SnapFlix Native Web Player.
 */
export const getMoviePlayers = (id: string | number, startAt?: number): PlayersProps[] => {
  return [
    {
      title: "SnapFlix Native",
      source: `/watch/movie/${id}`,
      recommended: true,
      fast: true,
      ads: false,
      resumable: true,
    },
  ];
};

/**
 * Generates a list of TV show players with their respective titles and source URLs.
 * Uses SnapFlix Native Web Player.
 */
export const getTvShowPlayers = (
  id: string | number,
  season: number,
  episode: number,
  startAt?: number,
): PlayersProps[] => {
  return [
    {
      title: "SnapFlix Native",
      source: `/watch/tv/${id}/${season}/${episode}`,
      recommended: true,
      fast: true,
      ads: false,
      resumable: true,
    },
  ];
};

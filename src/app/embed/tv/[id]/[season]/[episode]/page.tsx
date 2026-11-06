"use client";

import { use, useState, useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { tmdb } from "@/api/tmdb";
import { getTvDetails } from "@/actions/catalog";
import { getImageUrl } from "@/utils/movies";
import NativeWebPlayer from "@/components/player/NativeWebPlayer";
import type { Params } from "@/types";

export default function EmbedTvPage({
  params,
}: Params<{ id: string; season: string; episode: string }>) {
  const { id, season: initialSeason, episode: initialEpisode } = use(params);

  const [currentSeason, setCurrentSeason] = useState(Number(initialSeason) || 1);
  const [currentEpisode, setCurrentEpisode] = useState(Number(initialEpisode) || 1);

  // Fetch series details
  const { data: tvDetails } = useQuery({
    queryKey: ["embed-tv-details", id],
    queryFn: async () => {
      const serverResult = await getTvDetails(Number(id));
      if ("data" in serverResult) return serverResult.data;
      try {
        const res = await tmdb.tvShows.details(Number(id));
        return res || null;
      } catch (e) {
        return null;
      }
    },
    staleTime: 1000 * 60 * 60,
  });

  // Fetch episode list for current season
  const { data: seasonData } = useQuery({
    queryKey: ["embed-season-details", id, currentSeason],
    queryFn: async () => {
      try {
        const res = await tmdb.tvShows.season(Number(id), currentSeason);
        return res || null;
      } catch (e) {
        return null;
      }
    },
    staleTime: 1000 * 60 * 60,
  });

  const seriesName = tvDetails?.name || tvDetails?.original_name || "TV Show";
  const releaseYear = tvDetails?.first_air_date
    ? new Date(tvDetails.first_air_date).getFullYear()
    : undefined;

  const episodesList = seasonData?.episodes || [];
  const currentEpisodeData = episodesList.find(
    (e) => e.episode_number === currentEpisode
  );
  const hasNextEpisode = episodesList.some(
    (e) => e.episode_number === currentEpisode + 1
  );

  const handleSelectEpisode = useCallback(
    (seasonNum: number, episodeNum: number) => {
      setCurrentSeason(seasonNum);
      setCurrentEpisode(episodeNum);
      const newUrl = `/embed/tv/${id}/${seasonNum}/${episodeNum}`;
      window.history.replaceState(window.history.state, "", newUrl);
    },
    [id]
  );

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-black select-none">
      {/* Main Full-Bleed Video Player */}
      <div className="relative w-full h-full">
        <NativeWebPlayer
          tmdbId={Number(id)}
          title={seriesName}
          year={releaseYear}
          type="tv"
          season={currentSeason}
          episode={currentEpisode}
          episodeTitle={currentEpisodeData?.name}
          episodes={episodesList}
          hasNextEpisode={hasNextEpisode}
          onNextEpisode={() => handleSelectEpisode(currentSeason, currentEpisode + 1)}
          onSelectEpisode={handleSelectEpisode}
          originalLanguage={(tvDetails as any)?.original_language}
          backdropUrl={getImageUrl(
            currentEpisodeData?.still_path || tvDetails?.backdrop_path,
            "backdrop"
          )}
          backdropPath={
            currentEpisodeData?.still_path || tvDetails?.backdrop_path || undefined
          }
          posterPath={tvDetails?.poster_path || undefined}
          overview={currentEpisodeData?.overview || tvDetails?.overview}
        />
      </div>
    </div>
  );
}


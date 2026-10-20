"use client";

import { usePlayerEvents, type UnifiedPlayerEventData } from "@/hooks/usePlayerEvents";
import { siteConfig } from "@/config/site";
import { Params } from "@/types";
import { tmdb } from "@/api/tmdb";
import { useQuery } from "@tanstack/react-query";
import { Button, Select, SelectItem, Chip } from "@heroui/react";
import { useDocumentTitle } from "@mantine/hooks";
import { NextPage } from "next";
import { useRouter } from "next/navigation";
import { use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { IoArrowBack } from "react-icons/io5";
import { FaPlay, FaForwardStep } from "react-icons/fa6";
import { getImageUrl } from "@/utils/movies";
import { cn } from "@/utils/helpers";
import BookmarkButton from "@/components/ui/button/BookmarkButton";
import ShareButton from "@/components/ui/button/ShareButton";
import type { SavedMovieDetails } from "@/types/movie";
import NativeWebPlayer from "@/components/player/NativeWebPlayer";

const WatchTvPage: NextPage<
  Params<{ id: string; season: string; episode: string }>
> = ({ params }) => {
  const { id, season: initialSeason, episode: initialEpisode } = use(params);
  const router = useRouter();

  // Active episode states
  const [currentSeason, setCurrentSeason] = useState(Number(initialSeason) || 1);
  const [currentEpisode, setCurrentEpisode] = useState(Number(initialEpisode) || 1);
  const [playerSeason, setPlayerSeason] = useState(Number(initialSeason) || 1);
  const [playerEpisode, setPlayerEpisode] = useState(Number(initialEpisode) || 1);

  // Season selected in bottom episodes list
  const [selectedSeason, setSelectedSeason] = useState(Number(initialSeason) || 1);

  // Fullscreen state
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch series details
  const { data: tvDetails } = useQuery({
    queryKey: ["tv-details", id],
    queryFn: async () => {
      try {
        const res = await tmdb.tvShows.details(Number(id));
        return res || null;
      } catch (e) {
        return null;
      }
    },
    staleTime: 1000 * 60 * 60,
  });

  // Fetch season episodes for currently selected season
  const { data: seasonData } = useQuery({
    queryKey: ["tv-season-episodes", id, selectedSeason],
    queryFn: async () => {
      try {
        const res = await tmdb.tvShows.season(Number(id), selectedSeason);
        return res || null;
      } catch (e) {
        return null;
      }
    },
    staleTime: 1000 * 60 * 60,
  });

  const seriesName = tvDetails?.name || tvDetails?.original_name || "TV Series";
  const seasonsList = useMemo(() => {
    return (tvDetails?.seasons || []).filter((s) => s.season_number > 0);
  }, [tvDetails?.seasons]);

  const episodesList = seasonData?.episodes || [];
  const currentEpisodeData = episodesList.find(
    (e) => e.episode_number === currentEpisode && selectedSeason === currentSeason
  );

  useEffect(() => {
    setCurrentSeason(Number(initialSeason) || 1);
    setCurrentEpisode(Number(initialEpisode) || 1);
    setPlayerSeason(Number(initialSeason) || 1);
    setPlayerEpisode(Number(initialEpisode) || 1);
    setSelectedSeason(Number(initialSeason) || 1);
  }, [initialSeason, initialEpisode]);

  const resetTimer = useCallback(() => {
    setShowControls(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setShowControls(false);
    }, 2500);
  }, []);

  const handleBack = useCallback(() => {
    if (window.history.length > 1) {
      router.back();
    } else {
      router.push(`/tv/${id}`);
    }
  }, [router, id]);

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", handleFsChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFsChange);
    };
  }, []);

  useEffect(() => {
    resetTimer();

    const handleInteraction = () => {
      resetTimer();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      resetTimer();
      if (
        e.key === "Escape" ||
        e.key === "Backspace" ||
        e.key === "BrowserBack" ||
        e.key === "GoBack" ||
        e.keyCode === 10009 ||
        e.keyCode === 461
      ) {
        handleBack();
      }
    };

    window.addEventListener("mousemove", handleInteraction, { passive: true });
    window.addEventListener("touchstart", handleInteraction, { passive: true });
    window.addEventListener("pointerdown", handleInteraction, { passive: true });
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("mousemove", handleInteraction);
      window.removeEventListener("touchstart", handleInteraction);
      window.removeEventListener("pointerdown", handleInteraction);
      window.removeEventListener("keydown", handleKeyDown);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [resetTimer, handleBack]);

  // When user taps an episode card
  const handleSelectEpisode = useCallback(
    (seasonNum: number, episodeNum: number) => {
      setPlayerSeason(seasonNum);
      setPlayerEpisode(episodeNum);
      setCurrentSeason(seasonNum);
      setCurrentEpisode(episodeNum);
      setSelectedSeason(seasonNum);

      const newUrl = `/watch/tv/${id}/${seasonNum}/${episodeNum}`;
      window.history.replaceState(window.history.state, "", newUrl);
      document.title = `Watch ${seriesName} S${seasonNum}E${episodeNum} | ${siteConfig.name}`;
    },
    [id, seriesName]
  );

  // When player autoplays next episode
  const handleEpisodeChange = useCallback(
    (data: UnifiedPlayerEventData) => {
      const nextSeason = Number(data.season) || 1;
      const nextEpisode = Number(data.episode) || 1;

      if (nextSeason !== currentSeason || nextEpisode !== currentEpisode) {
        setCurrentSeason(nextSeason);
        setCurrentEpisode(nextEpisode);
        setSelectedSeason(nextSeason);

        const newUrl = `/watch/tv/${id}/${nextSeason}/${nextEpisode}`;
        window.history.replaceState(window.history.state, "", newUrl);
        document.title = `Watch ${seriesName} S${nextSeason}E${nextEpisode} | ${siteConfig.name}`;
      }
    },
    [id, currentSeason, currentEpisode, seriesName]
  );

  usePlayerEvents({
    mediaId: id,
    mediaType: "tv",
    saveHistory: true,
    metadata: { season: currentSeason, episode: currentEpisode },
    onEpisodeChange: handleEpisodeChange,
  });

  useDocumentTitle(`Watch ${seriesName} S${currentSeason}E${currentEpisode} | ${siteConfig.name}`);

  const bookmarkData: SavedMovieDetails = {
    type: "tv",
    adult: (tvDetails as any)?.adult || false,
    backdrop_path: tvDetails?.backdrop_path || "",
    id: Number(id),
    poster_path: tvDetails?.poster_path || "",
    release_date: tvDetails?.first_air_date || "",
    title: seriesName,
    vote_average: tvDetails?.vote_average || 8.0,
    saved_date: new Date().toISOString(),
  };

  const releaseYear = tvDetails?.first_air_date
    ? new Date(tvDetails.first_air_date).getFullYear()
    : 2025;

  const hasNextEpisode = episodesList.some((e) => e.episode_number === currentEpisode + 1);

  return (
    <div className="flex flex-col lg:flex-row h-[100dvh] w-full overflow-hidden bg-black select-none">
      {/* 1. TOP VIDEO PLAYER WINDOW (16:9 Aspect Video in Portrait, Fullscreen on Rotation, Cinema Mode on Desktop) */}
      <div
        className={cn(
          "relative bg-black transition-all duration-300 overflow-hidden shrink-0 player-responsive-video",
          isFullscreen
            ? "fixed inset-0 w-full h-[100dvh] z-[9999]"
            : "w-full aspect-video lg:aspect-auto lg:flex-1 lg:h-full z-30 shadow-2xl lg:border-r border-white/10"
        )}
      >
        {/* Native Web Player */}
        <NativeWebPlayer
          tmdbId={Number(id)}
          title={seriesName}
          year={releaseYear}
          type="tv"
          season={playerSeason}
          episode={playerEpisode}
          episodeTitle={currentEpisodeData?.name}
          episodes={episodesList}
          hasNextEpisode={hasNextEpisode}
          onNextEpisode={() => handleSelectEpisode(currentSeason, currentEpisode + 1)}
          onSelectEpisode={handleSelectEpisode}
          originalLanguage={(tvDetails as any)?.original_language}
          onBack={handleBack}
        />
      </div>

      {/* 2. DETAILS & EPISODES (Scrollable in Portrait, Sidebar on Desktop, hidden in Landscape) */}
      {!isFullscreen && (
        <div className="flex-1 lg:flex-none lg:w-[380px] xl:w-[440px] 2xl:w-[480px] overflow-y-auto w-full bg-[#0c0c0e] text-white px-4 sm:px-6 pt-3 sm:pt-4 pb-20 lg:pb-8 space-y-4 sm:space-y-5 player-responsive-details">
          {/* Title & Active Episode Header */}
          <div className="space-y-1.5 border-b border-white/10 pb-3">
            <h1 className="text-lg sm:text-xl font-extrabold text-white tracking-tight line-clamp-1">
              {seriesName}
            </h1>
            <div className="flex items-center gap-2">
              <span className="text-xs sm:text-sm font-semibold text-primary">
                S{currentSeason}:E{currentEpisode}
              </span>
              <span className="text-xs text-gray-400 font-medium line-clamp-1">
                {currentEpisodeData?.name || `Episode ${currentEpisode}`}
              </span>
            </div>

            {/* Quick Metadata Row */}
            <div className="flex items-center gap-2 text-[11px] text-gray-400 pt-0.5">
              {tvDetails?.vote_average && (
                <span className="font-bold text-[#46D369]">
                  {Math.round(tvDetails.vote_average * 10)}% Match
                </span>
              )}
              {tvDetails?.first_air_date && (
                <span>{new Date(tvDetails.first_air_date).getFullYear()}</span>
              )}
              <span className="border border-white/20 px-1 rounded-xs text-[10px] text-gray-300">
                {(tvDetails as any)?.adult ? "18+" : "16+"}
              </span>
              <span>{seasonsList.length} Seasons</span>
            </div>
          </div>

          {/* Quick Actions Toolbar */}
          <div className="flex items-center justify-between gap-2 overflow-x-auto pb-1">
            <div className="flex items-center gap-2 shrink-0">
              {hasNextEpisode && (
                <Button
                  size="sm"
                  color="primary"
                  variant="solid"
                  className="font-semibold text-xs"
                  startContent={<FaForwardStep size={12} />}
                  onPress={() => handleSelectEpisode(currentSeason, currentEpisode + 1)}
                >
                  Next Ep
                </Button>
              )}

              <div className="scale-95 shrink-0">
                <BookmarkButton data={bookmarkData} />
              </div>

              <div className="scale-95 shrink-0">
                <ShareButton id={Number(id)} title={seriesName} type="tv" />
              </div>
            </div>
          </div>

          {/* Season Selector & Episodes List */}
          <div className="space-y-3 pt-1">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm sm:text-base font-bold text-white">Episodes</h2>
              {seasonsList.length > 1 && (
                <div className="w-36 sm:w-44">
                  <Select
                    aria-label="Select Season"
                    size="sm"
                    selectedKeys={[selectedSeason.toString()]}
                    disallowEmptySelection
                    className="w-full"
                    classNames={{
                      trigger: "bg-[#202020] border border-white/10 h-8 min-h-8",
                      value: "text-xs font-semibold",
                    }}
                    onChange={(e) => {
                      if (e.target.value) {
                        setSelectedSeason(Number(e.target.value));
                      }
                    }}
                  >
                    {seasonsList.map((s) => (
                      <SelectItem key={s.season_number.toString()}>
                        {s.name || `Season ${s.season_number}`}
                      </SelectItem>
                    ))}
                  </Select>
                </div>
              )}
            </div>

            {/* Vertical Episodes List */}
            <div className="space-y-2">
              {episodesList.map((ep) => {
                const isPlaying =
                  ep.episode_number === currentEpisode && selectedSeason === currentSeason;
                const thumbUrl = getImageUrl(
                  ep.still_path || tvDetails?.backdrop_path || tvDetails?.poster_path,
                  "backdrop"
                );

                return (
                  <div
                    key={ep.id || ep.episode_number}
                    onClick={() => handleSelectEpisode(selectedSeason, ep.episode_number)}
                    className={cn(
                      "flex items-center gap-3 p-2 rounded-xl transition-all cursor-pointer group",
                      isPlaying
                        ? "bg-[#E50914]/15 border border-[#E50914] shadow-md shadow-red-950/30"
                        : "bg-white/[0.03] hover:bg-white/[0.08] border border-white/5"
                    )}
                  >
                    {/* Thumbnail */}
                    <div className="relative w-24 sm:w-28 aspect-video rounded-lg overflow-hidden shrink-0 bg-black/60">
                      <img
                        src={thumbUrl}
                        alt={ep.name}
                        className="size-full object-cover object-center group-hover:scale-105 transition-transform duration-200"
                      />
                      {ep.runtime && (
                        <span className="absolute bottom-1 right-1 bg-black/80 px-1 py-0.2 rounded text-[9px] font-bold text-gray-200">
                          {ep.runtime}m
                        </span>
                      )}
                      {isPlaying ? (
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                          <FaPlay className="text-[#E50914] text-xs animate-pulse" />
                        </div>
                      ) : null}
                    </div>

                    {/* Episode Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <h3 className="text-xs sm:text-sm font-semibold text-white truncate group-hover:text-primary transition-colors">
                          {ep.episode_number}. {ep.name}
                        </h3>
                        {isPlaying && (
                          <Chip size="sm" color="danger" variant="flat" className="h-5 text-[10px] shrink-0 font-bold">
                            Playing
                          </Chip>
                        )}
                      </div>
                      <p className="text-[11px] text-gray-400 line-clamp-2 mt-0.5 leading-snug">
                        {ep.overview || "Stream this episode now on SnapFlix."}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Series Overview */}
          {tvDetails?.overview && (
            <div className="space-y-1.5 border-t border-white/10 pt-4">
              <h3 className="text-xs sm:text-sm font-bold text-gray-300">About {seriesName}</h3>
              <p className="text-xs text-gray-400 leading-relaxed line-clamp-3">
                {tvDetails.overview}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default WatchTvPage;

"use client";

import { usePlayerEvents } from "@/hooks/usePlayerEvents";
import { siteConfig } from "@/config/site";
import { Params } from "@/types";
import { tmdb } from "@/api/tmdb";
import { useQuery } from "@tanstack/react-query";
import { Button, Chip } from "@heroui/react";
import { useDocumentTitle } from "@mantine/hooks";
import { NextPage } from "next";
import { useRouter } from "next/navigation";
import { use, useCallback, useEffect, useRef, useState } from "react";
import { IoArrowBack } from "react-icons/io5";
import { getImageUrl, movieDurationString } from "@/utils/movies";
import { cn } from "@/utils/helpers";
import BookmarkButton from "@/components/ui/button/BookmarkButton";
import ShareButton from "@/components/ui/button/ShareButton";
import type { SavedMovieDetails } from "@/types/movie";
import Link from "next/link";
import NativeWebPlayer from "@/components/player/NativeWebPlayer";
import { IoSparkles } from "react-icons/io5";
import { FaClock } from "react-icons/fa6";

const WatchMoviePage: NextPage<Params<{ id: string }>> = ({ params }) => {
  const { id } = use(params);
  const router = useRouter();

  // Fullscreen state
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch movie details
  const { data: movieDetails } = useQuery({
    queryKey: ["movie-details", id],
    queryFn: async () => {
      try {
        const res = await tmdb.movies.details(Number(id), ["recommendations", "similar"]);
        return res || null;
      } catch (e) {
        return null;
      }
    },
    staleTime: 1000 * 60 * 60,
  });

  const movieTitle = movieDetails?.title || movieDetails?.original_title || "";
  const releaseYear = movieDetails?.release_date
    ? new Date(movieDetails.release_date).getFullYear()
    : undefined;
  const displayTitle = movieTitle || "Movie";
  const isNotReleased = Boolean(
    movieDetails?.release_date && new Date(movieDetails.release_date).getTime() > Date.now()
  );
  const runtimeText = movieDetails?.runtime ? movieDurationString(movieDetails.runtime) : null;
  const recommendations = (movieDetails?.recommendations?.results || movieDetails?.similar?.results || []).slice(0, 10);

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
      router.push(`/movie/${id}`);
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

  usePlayerEvents({
    mediaId: id,
    mediaType: "movie",
    saveHistory: true,
  });

  useDocumentTitle(`Watch ${displayTitle} | ${siteConfig.name}`);

  const bookmarkData: SavedMovieDetails = {
    type: "movie",
    adult: movieDetails?.adult || false,
    backdrop_path: movieDetails?.backdrop_path || "",
    id: Number(id),
    poster_path: movieDetails?.poster_path || "",
    release_date: movieDetails?.release_date || "",
    title: displayTitle,
    vote_average: movieDetails?.vote_average || 8.0,
    saved_date: new Date().toISOString(),
  };

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
        {/* Native Web Player or Unreleased Screen */}
        {isNotReleased ? (
          <div className="flex flex-col items-center justify-center size-full bg-black/95 p-6 text-center text-white space-y-4">
            <div className="w-16 h-16 rounded-full bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-lg shadow-amber-500/10">
              <FaClock size={28} />
            </div>
            <div className="space-y-1.5 max-w-md">
              <span className="text-xs font-bold text-amber-400 uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20">
                Coming Soon
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-white">
                {movieTitle}
              </h2>
              <p className="text-xs sm:text-sm text-gray-400">
                This film has not been released yet. Scheduled release:{" "}
                <span className="text-white font-semibold block mt-1">
                  {new Date(movieDetails!.release_date).toLocaleDateString("en-US", {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </span>
              </p>
            </div>
            <Button
              color="primary"
              variant="flat"
              className="font-bold text-xs mt-2"
              onPress={handleBack}
            >
              Go Back
            </Button>
          </div>
        ) : (
          <NativeWebPlayer
            tmdbId={Number(id)}
            title={movieTitle}
            year={releaseYear}
            type="movie"
            originalLanguage={movieDetails?.original_language}
            onBack={handleBack}
            backdropUrl={getImageUrl(movieDetails?.backdrop_path, "backdrop")}
            backdropPath={movieDetails?.backdrop_path || undefined}
            posterPath={movieDetails?.poster_path || undefined}
            overview={movieDetails?.overview}
          />
        )}
      </div>

      {/* 2. DETAILS & RECOMMENDATIONS (Scrollable in Portrait, Sidebar on Desktop, hidden in Landscape) */}
      {!isFullscreen && (
        <div className="flex-1 lg:flex-none lg:w-[380px] xl:w-[440px] 2xl:w-[480px] overflow-y-auto w-full bg-[#0c0c0e] text-white px-4 sm:px-6 pt-3 sm:pt-4 pb-20 lg:pb-8 space-y-4 sm:space-y-5 player-responsive-details">
          {/* Title & Metadata Header */}
          <div className="space-y-1.5 border-b border-white/10 pb-3">
            <h1 className="text-lg sm:text-xl font-extrabold text-white tracking-tight line-clamp-1">
              {displayTitle}
            </h1>

            {/* Quick Metadata Row */}
            <div className="flex items-center gap-2 text-[11px] text-gray-400 pt-0.5">
              {movieDetails?.vote_average && (
                <span className="font-bold text-[#46D369]">
                  {Math.round(movieDetails.vote_average * 10)}% Match
                </span>
              )}
              <span>{releaseYear}</span>
              <span className="border border-white/20 px-1 rounded-xs text-[10px] text-gray-300">
                {movieDetails?.adult ? "18+" : "16+"}
              </span>
              {runtimeText && <span>{runtimeText}</span>}
              <span className="border border-white/20 px-1 rounded-xs text-[10px] text-gray-300">
                4K Ultra HD
              </span>
            </div>

            {/* Genres */}
            {movieDetails?.genres && movieDetails.genres.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-1">
                {movieDetails.genres.slice(0, 3).map((g) => (
                  <span
                    key={g.id}
                    className="text-[10px] text-gray-300 bg-white/5 border border-white/10 px-2 py-0.5 rounded-full"
                  >
                    {g.name}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Quick Actions Toolbar */}
          <div className="flex items-center justify-between gap-2 overflow-x-auto pb-1">
            <div className="flex items-center gap-2 shrink-0">
              <div className="scale-95 shrink-0">
                <BookmarkButton data={bookmarkData} />
              </div>

              <div className="scale-95 shrink-0">
                <ShareButton id={Number(id)} title={movieTitle} type="movie" />
              </div>
            </div>
          </div>

          {/* Synopsis */}
          {movieDetails?.overview && (
            <div className="space-y-1.5 pt-1">
              <h2 className="text-xs sm:text-sm font-bold text-gray-300">Synopsis</h2>
              <p className="text-xs text-gray-400 leading-relaxed line-clamp-3">
                {movieDetails.overview}
              </p>
            </div>
          )}

          {/* Recommended / More Like This */}
          {recommendations.length > 0 && (
            <div className="space-y-3 border-t border-white/10 pt-4">
              <h2 className="text-sm sm:text-base font-bold text-white">More Like This</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {recommendations.map((rec) => {
                  const posterUrl = getImageUrl(rec.poster_path || rec.backdrop_path);
                  return (
                    <Link
                      key={rec.id}
                      href={`/watch/movie/${rec.id}`}
                      className="group flex flex-col gap-1.5 rounded-lg overflow-hidden bg-white/[0.02] border border-white/5 p-1.5 hover:border-primary/50 transition-colors"
                    >
                      <div className="aspect-2/3 w-full rounded-md overflow-hidden bg-black/50 relative">
                        <img
                          src={posterUrl}
                          alt={rec.title}
                          className="size-full object-cover group-hover:scale-105 transition-transform duration-200"
                        />
                      </div>
                      <h4 className="text-xs font-semibold text-white truncate group-hover:text-primary transition-colors">
                        {rec.title}
                      </h4>
                      <div className="flex items-center justify-between text-[10px] text-gray-400">
                        <span>{rec.release_date ? new Date(rec.release_date).getFullYear() : ""}</span>
                        {rec.vote_average && (
                          <span className="text-[#46D369] font-bold">
                            ★ {rec.vote_average.toFixed(1)}
                          </span>
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default WatchMoviePage;

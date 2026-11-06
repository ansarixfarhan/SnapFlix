"use client";

import { use } from "react";
import { useQuery } from "@tanstack/react-query";
import { tmdb } from "@/api/tmdb";
import { getImageUrl } from "@/utils/movies";
import NativeWebPlayer from "@/components/player/NativeWebPlayer";
import type { Params } from "@/types";

export default function EmbedMoviePage({ params }: Params<{ id: string }>) {
  const { id } = use(params);

  const { data: movieDetails, isLoading } = useQuery({
    queryKey: ["embed-movie-details", id],
    queryFn: async () => {
      try {
        const res = await tmdb.movies.details(Number(id));
        return res || null;
      } catch (e) {
        return null;
      }
    },
    staleTime: 1000 * 60 * 60,
  });

  const movieTitle = movieDetails?.title || movieDetails?.original_title || "Movie";
  const releaseYear = movieDetails?.release_date
    ? new Date(movieDetails.release_date).getFullYear()
    : undefined;

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-black select-none">
      {/* Main Full-Bleed Video Player */}
      <div className="relative w-full h-full">
        <NativeWebPlayer
          tmdbId={Number(id)}
          title={movieTitle}
          year={releaseYear}
          type="movie"
          originalLanguage={movieDetails?.original_language}
          backdropUrl={getImageUrl(movieDetails?.backdrop_path, "backdrop")}
          backdropPath={movieDetails?.backdrop_path || undefined}
          posterPath={movieDetails?.poster_path || undefined}
          overview={movieDetails?.overview}
        />
      </div>
    </div>
  );
}


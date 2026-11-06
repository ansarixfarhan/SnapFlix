"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useMemo } from "react";
import EmbedMoviePage from "./movie/[id]/page";
import EmbedTvPage from "./tv/[id]/[season]/[episode]/page";

function EmbedContent() {
  const searchParams = useSearchParams();

  const id = searchParams.get("id") || searchParams.get("tmdb") || searchParams.get("tmdbId");
  const typeParam = searchParams.get("type");
  const seasonParam = searchParams.get("season") || searchParams.get("s");
  const episodeParam = searchParams.get("episode") || searchParams.get("e");

  const isTv = typeParam === "tv" || Boolean(seasonParam || episodeParam);
  const season = seasonParam || "1";
  const episode = episodeParam || "1";

  if (!id) {
    return (
      <div className="flex flex-col items-center justify-center w-screen h-screen bg-black text-white p-6 text-center space-y-3">
        <div className="w-12 h-12 rounded-full bg-red-500/20 text-red-500 flex items-center justify-center font-bold text-xl border border-red-500/30">
          !
        </div>
        <h2 className="text-xl font-bold">SnapFlix Embed Player</h2>
        <p className="text-sm text-gray-400 max-w-sm">
          Missing media ID. Usage:
          <br />
          <code className="text-xs bg-white/10 px-2 py-1 rounded mt-2 inline-block">
            /embed?id=&#123;tmdbId&#125;
          </code>
          <br />
          <code className="text-xs bg-white/10 px-2 py-1 rounded mt-1 inline-block">
            /embed?id=&#123;tmdbId&#125;&season=1&episode=1
          </code>
        </p>
      </div>
    );
  }

  if (isTv) {
    const tvParams = Promise.resolve({
      id,
      season,
      episode,
    });
    return <EmbedTvPage params={tvParams} />;
  }

  const movieParams = Promise.resolve({
    id,
  });
  return <EmbedMoviePage params={movieParams} />;
}

export default function UniversalEmbedPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center w-screen h-screen bg-black text-white">
          <div className="w-8 h-8 rounded-full border-2 border-red-500 border-t-transparent animate-spin" />
        </div>
      }
    >
      <EmbedContent />
    </Suspense>
  );
}


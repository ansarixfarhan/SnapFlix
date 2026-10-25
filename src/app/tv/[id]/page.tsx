"use client";

import { getTvDetails } from "@/actions/catalog";
import { tmdb } from "@/api/tmdb";
import { Params } from "@/types";
import { siteConfig } from "@/config/site";
import { mutateTvShowTitle } from "@/utils/movies";
import { Skeleton } from "@heroui/react";
import { useDocumentTitle, useScrollIntoView } from "@mantine/hooks";
import { useQuery } from "@tanstack/react-query";
import { notFound } from "next/navigation";
import { Suspense, use } from "react";
import dynamic from "next/dynamic";
import { NextPage } from "next";
import Footer from "@/components/ui/layout/Footer";

import { findBestEpisodeGroup, getSeasonGroupIdToSplit } from "@/utils/seasonResolver";

const PhotosSection = dynamic(() => import("@/components/ui/other/PhotosSection"));
const TvShowRelatedSection = dynamic(() => import("@/components/sections/TV/Details/Related"));
const TvShowCastsSection = dynamic(() => import("@/components/sections/TV/Details/Casts"));
const DetailHeroBillboard = dynamic(() => import("@/components/sections/Detail/DetailHeroBillboard"));
const TvShowsSeasonsSelection = dynamic(() => import("@/components/sections/TV/Details/Seasons"));
const SeriesFacts = dynamic(() => import("@/components/sections/TV/Details/Facts"));

const TVShowDetailPage: NextPage<Params<{ id: number }>> = ({ params }) => {
  const { id } = use(params);
  const { scrollIntoView, targetRef } = useScrollIntoView<HTMLDivElement>({
    duration: 500,
  });

  const { data: result, isPending } = useQuery({
    queryFn: async () => {
      const serverResult = await getTvDetails(Number(id));
      if ("data" in serverResult || serverResult.error === "not-found") return serverResult;
      try {
        const res = await tmdb.tvShows.details(Number(id), [
          "images",
          "videos",
          "credits",
          "keywords",
          "recommendations",
          "similar",
          "reviews",
          "watch/providers",
          "episode_groups" as any,
        ]);
        if (res?.id) return { data: res };
      } catch (err) {
        console.warn("TMDB series details failed", err);
      }
      return serverResult;
    },
    queryKey: ["tv-show-detail", id],
  });
  const tv = result && "data" in result ? result.data : null;

  useDocumentTitle(tv ? `${mutateTvShowTitle(tv)} | ${siteConfig.name}` : siteConfig.name);

  if (isPending) {
    return (
      <div className="relative h-[62dvh] min-h-[420px] w-full overflow-hidden bg-[#0c0c0e] sm:h-[70dvh] lg:h-[78dvh]">
        <Skeleton className="size-full rounded-none opacity-20" />
      </div>
    );
  }

  if (result && "error" in result && result.error === "not-found") notFound();
  if (!tv) {
    return (
      <p className="px-6 py-24 text-center text-sm text-white/70">
        This series could not be loaded from TMDB.
      </p>
    );
  }

  const splitGroupId = getSeasonGroupIdToSplit(tv);
  const bestGroup = splitGroupId ? findBestEpisodeGroup(tv.episode_groups) : null;
  // If group has specials, seasons count is group_count - 1
  const overrideSeasonCount = bestGroup ? Math.max(1, bestGroup.group_count - 1) : undefined;

  return (
    <div className="flex w-full flex-col overflow-x-hidden">
      <Suspense fallback={<Skeleton className="h-[62dvh] w-full rounded-none opacity-20" />}>
        <DetailHeroBillboard
          media={tv}
          type="tv"
          onViewEpisodesClick={() => scrollIntoView({ alignment: "start" })}
        />

        <div className="relative z-10 flex flex-col gap-8 pt-2 pb-16 md:gap-11">
          <SeriesFacts show={tv} overrideSeasonCount={overrideSeasonCount} />
          <TvShowsSeasonsSelection ref={targetRef} id={Number(id)} seasons={tv.seasons || []} tvShow={tv} />
          <TvShowCastsSection casts={tv.credits?.cast || []} />
          <PhotosSection images={tv.images?.backdrops || []} type="tv" heading="row" />
          <TvShowRelatedSection tv={tv} />
        </div>
      </Suspense>
      <Footer />
    </div>
  );
};

export default TVShowDetailPage;

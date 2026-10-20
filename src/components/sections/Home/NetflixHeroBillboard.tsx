"use client";

import { getRecommendationsFromHistory, getTrendingMovies, getTrendingTvShows } from "@/actions/lists";
import BookmarkButton from "@/components/ui/button/BookmarkButton";
import CatalogErrorState from "@/components/ui/other/CatalogErrorState";
import PopcornTvLoader from "@/components/ui/other/PopcornTvLoader";
import { useWatchHistory } from "@/hooks/useWatchHistory";
import { CatalogListResponse, ContentType } from "@/types";
import { SavedMovieDetails } from "@/types/movie";
import { unwrapCatalog } from "@/utils/catalog";
import { getImageUrl, mutateMovieTitle, mutateTvShowTitle } from "@/utils/movies";
import { Skeleton } from "@heroui/react";
import { useQuery } from "@tanstack/react-query";
import useEmblaCarousel from "embla-carousel-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { FaChevronLeft, FaChevronRight, FaPlay } from "react-icons/fa6";
import { IoInformationCircleOutline, IoPause } from "react-icons/io5";
import { useSearchParams } from "next/navigation";
import { Movie, TV } from "tmdb-ts/dist/types";
import { cn } from "@/utils/helpers";
import { tmdb } from "@/api/tmdb";

/** Source the billboard ended up showing, used to tweak its copy. */
type BillboardSource = "personalized" | "trending";

interface BillboardData {
  results: (Movie | TV)[];
  source: BillboardSource;
}

const HeroTitleLogo: React.FC<{
  id: number;
  type: "movie" | "tv";
  title: string;
}> = ({ id, type, title }) => {
  const [imgFailed, setImgFailed] = useState(false);

  const { data: logoUrl } = useQuery({
    queryKey: ["hero-title-logo", type, id],
    queryFn: async () => {
      try {
        const res =
          type === "tv"
            ? await tmdb.tvShows.images(id, { include_image_language: ["en", "null"] })
            : await tmdb.movies.images(id, { include_image_language: ["en", "null"] });
        const logos = res?.logos || [];
        if (logos.length === 0) return null;
        const pngLogos = logos.filter((l) => l.file_path && !l.file_path.endsWith(".svg"));
        const candidate =
          pngLogos.find((l) => l.iso_639_1 === "en") ||
          pngLogos.find((l) => !l.iso_639_1) ||
          pngLogos[0] ||
          logos[0];
        return candidate?.file_path ? getImageUrl(candidate.file_path, "title") : null;
      } catch {
        return null;
      }
    },
    staleTime: 1000 * 60 * 60 * 24, // 24 hours
  });

  if (logoUrl && !imgFailed) {
    return (
      <div className="h-14 sm:h-20 md:h-24 lg:h-28 max-w-[260px] sm:max-w-sm md:max-w-md lg:max-w-lg flex items-center justify-start drop-shadow-[0_4px_16px_rgba(0,0,0,0.85)] my-1 sm:my-2">
        <img
          src={logoUrl}
          alt={title}
          className="max-h-full max-w-full object-contain object-left select-none"
          onError={() => setImgFailed(true)}
          draggable={false}
        />
      </div>
    );
  }

  return (
    <h1 className="line-clamp-2 text-[1.7rem] leading-[1.05] font-black tracking-tight text-white drop-shadow-[0_4px_16px_rgba(0,0,0,0.85)] sm:text-5xl lg:text-6xl">
      {title}
    </h1>
  );
};

interface NetflixHeroBillboardProps {
  contentType?: "movie" | "tv";
}

const SLIDE_INTERVAL_MS = 7000;
const heroFrame =
  "relative h-[62dvh] min-h-[420px] max-h-[540px] w-full overflow-hidden bg-[#0c0c0e] sm:h-[70dvh] sm:min-h-[500px] sm:max-h-[680px] lg:h-[78dvh] lg:min-h-[560px] lg:max-h-[820px]";

const NetflixHeroBillboard: React.FC<NetflixHeroBillboardProps> = ({ contentType: propContentType }) => {
  const searchParams = useSearchParams();
  const currentContent: ContentType = propContentType || (searchParams.get("content") as ContentType) || "movie";
  const isTv = currentContent === "tv";

  const [currentIndex, setCurrentIndex] = useState(0);
  const [hoverPaused, setHoverPaused] = useState(false);
  const [manualPaused, setManualPaused] = useState(false);
  const [hidden, setHidden] = useState(false);
  const paused = hoverPaused || hidden || manualPaused;

  // Embla Carousel with true seamless Infinite Loop
  const [emblaRef, emblaApi] = useEmblaCarousel({
    loop: true,
    duration: 30,
    skipSnaps: false,
  });

  // Watch history (guest localStorage + Supabase when signed in) seeds the
  // personalized picks below. New viewers with no history fall back to trending.
  const { data: watchHistory, isLoading: isHistoryLoading } = useWatchHistory();

  const { data, isPending, isError, error, refetch, isRefetching } = useQuery({
    queryKey: [
      "hero-billboard",
      currentContent,
      (watchHistory ?? [])
        .filter((item) => item.type === currentContent)
        .map((item) => `${item.media_id}`)
        .join(","),
    ],
    queryFn: async (): Promise<BillboardData> => {
      const seeds = (watchHistory ?? []).filter((item) => item.type === currentContent);

      if (seeds.length > 0) {
        try {
          const recommendationsResponse = await getRecommendationsFromHistory({
            mediaType: currentContent,
            seedIds: seeds.map((item) => Number(item.media_id)),
            excludeIds: (watchHistory ?? []).map((item) => Number(item.media_id)),
          });
          const unwrapped = unwrapCatalog(recommendationsResponse);
          if (unwrapped.results.length > 0) {
            return { results: unwrapped.results, source: "personalized" };
          }
        } catch {
          // Fall through to trending below.
        }
      }

      const trendingResponse: CatalogListResponse<Movie | TV> = isTv
        ? await getTrendingTvShows({ timeWindow: "day" })
        : await getTrendingMovies({ timeWindow: "day" });

      return { results: unwrapCatalog(trendingResponse).results, source: "trending" };
    },
    enabled: !isHistoryLoading,
    staleTime: 1000 * 60 * 30, // 30 minutes
  });

  const isPersonalized = data?.source === "personalized";

  // Extract the top titles that actually ship a backdrop.
  const heroItems = useMemo(() => {
    const rawList = data?.results ?? [];
    return rawList.filter((item: any) => Boolean(item.backdrop_path)).slice(0, 4);
  }, [data]);

  // Sync selected index with Embla scroll events
  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setCurrentIndex(emblaApi.selectedScrollSnap());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    emblaApi.on("select", onSelect);
    emblaApi.on("reInit", onSelect);
    return () => {
      emblaApi.off("select", onSelect);
      emblaApi.off("reInit", onSelect);
    };
  }, [emblaApi, onSelect]);

  // Reset to first slide when switching between Movies and TV
  useEffect(() => {
    if (emblaApi) {
      emblaApi.scrollTo(0, true);
      setCurrentIndex(0);
    }
  }, [currentContent, emblaApi]);

  useEffect(() => {
    const onVisibility = () => setHidden(document.hidden);
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  // Automatic infinite scroll. Pauses while hovered or the tab is hidden.
  useEffect(() => {
    if (!emblaApi || heroItems.length <= 1 || paused) return;

    const interval = setInterval(() => {
      emblaApi.scrollNext();
    }, SLIDE_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [emblaApi, heroItems.length, currentIndex, paused]);

  const handleSlideClick = useCallback(
    (index: number) => {
      if (emblaApi) emblaApi.scrollTo(index);
    },
    [emblaApi]
  );

  if (isPending && heroItems.length === 0) {
    return (
      <div className={heroFrame}>
        <Skeleton className="size-full rounded-none opacity-20" />
        <div className="absolute inset-0 z-20 grid place-items-center px-4">
          <PopcornTvLoader size="lg" label="Finding something for you" />
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className={cn(heroFrame, "grid place-items-center px-4")}>
        <CatalogErrorState
          error={error}
          isRetrying={isRefetching}
          onRetry={() => refetch()}
          title="Billboard unavailable"
        />
      </div>
    );
  }

  if (heroItems.length === 0) return null;

  return (
    <div
      className={cn(
        "group/hero select-none",
        heroFrame,
        paused && "hero-paused",
      )}
      onMouseEnter={() => setHoverPaused(true)}
      onMouseLeave={() => setHoverPaused(false)}
      onFocusCapture={() => setHoverPaused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setHoverPaused(false);
        }
      }}
    >
      {/* Infinite Scroll Viewport */}
      <div className="size-full overflow-hidden" ref={emblaRef}>
        {/* Infinite Scroll Track */}
        <div className="flex h-full w-full touch-pan-y">
          {heroItems.map((item: any, idx: number) => {
            const title = isTv
              ? mutateTvShowTitle(item as any)
              : mutateMovieTitle(item as any);

            const releaseDate = item.release_date || item.first_air_date;
            const releaseYear = releaseDate ? new Date(releaseDate).getFullYear() : 2025;
            const detailHref = isTv ? `/tv/${item.id}` : `/movie/${item.id}`;
            const playHref = isTv ? `/watch/tv/${item.id}/1/1` : `/watch/movie/${item.id}`;

            const voteAverage = item.vote_average || 8.2;
            const matchPercentage = Math.min(99, Math.round(voteAverage * 10 + 8));
            const bgUrl = getImageUrl(item.backdrop_path, "backdrop", true);

            const bookmarkData: SavedMovieDetails = {
              type: isTv ? "tv" : "movie",
              adult: item.adult || false,
              backdrop_path: item.backdrop_path,
              id: item.id,
              poster_path: item.poster_path,
              release_date: releaseDate || "",
              title,
              vote_average: item.vote_average,
              saved_date: new Date().toISOString(),
            };

            return (
              <div key={item.id || idx} className="relative h-full w-full flex-none overflow-hidden">
                <img
                  src={bgUrl}
                  alt=""
                  width={1280}
                  height={720}
                  fetchPriority={idx === currentIndex ? "high" : "low"}
                  loading={idx === currentIndex ? "eager" : "lazy"}
                  className={cn(
                    "pointer-events-none absolute inset-0 size-full object-cover object-[center_22%] sm:object-top",
                    idx === currentIndex && "hero-ken",
                  )}
                  draggable={false}
                />

                <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-[68%] bg-linear-to-t from-[#0c0c0e] via-[#0c0c0e]/80 to-transparent" />
                <div className="pointer-events-none absolute inset-y-0 left-0 z-10 hidden w-1/2 bg-linear-to-r from-[#0c0c0e]/70 to-transparent md:block" />

                <div className="absolute inset-x-4 bottom-12 z-20 flex max-w-xl flex-col gap-2 sm:inset-x-8 sm:bottom-14 md:left-12 md:gap-3">
                  <p className="text-xs font-semibold text-white/80 sm:text-sm">
                    <span className="text-[#46d369]">{matchPercentage}% match</span>
                    <span className="mx-2 text-white/35">·</span>
                    {isPersonalized ? "Recommended for you" : `#${idx + 1} today`}
                  </p>

                  <HeroTitleLogo id={item.id} type={isTv ? "tv" : "movie"} title={title} />

                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-white/75 sm:text-sm">
                    <span>{releaseYear}</span>
                    <span className="rounded-full border border-white/25 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                      {item.adult ? "18+" : "16+"}
                    </span>
                    <span className="hidden sm:inline">{isTv ? "Series" : "Film"}</span>
                  </div>

                  <p
                    className="line-clamp-3 max-w-lg text-sm leading-relaxed text-white/80 md:text-base"
                    style={{
                      display: '-webkit-box',
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                  >
                    {item.overview || "Stream this title on SnapFlix."}
                  </p>

                  <div className="flex items-center gap-2 pt-1">
                    <Link
                      href={playHref}
                      className="inline-flex h-11 items-center gap-2 rounded-full bg-white px-5 text-sm font-bold text-black transition active:scale-95"
                    >
                      <FaPlay className="size-3.5" />
                      Play
                    </Link>
                    <Link
                      href={detailHref}
                      className="sf-chip inline-flex h-11 items-center gap-1.5 rounded-full px-4 text-sm font-semibold text-white transition hover:bg-white/15"
                    >
                      <IoInformationCircleOutline className="size-5" />
                      Info
                    </Link>
                    <BookmarkButton
                      data={bookmarkData}
                      className="sf-chip size-11 min-w-11 rounded-full bg-transparent text-white shadow-none"
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <button
        type="button"
        onClick={() => emblaApi?.scrollPrev()}
        aria-label="Previous title"
        className="sf-glass-strong absolute top-1/2 left-4 z-30 hidden size-11 -translate-y-1/2 place-items-center rounded-full text-white opacity-0 transition group-hover/hero:opacity-100 md:grid"
      >
        <FaChevronLeft className="size-4" />
      </button>
      <button
        type="button"
        onClick={() => emblaApi?.scrollNext()}
        aria-label="Next title"
        className="sf-glass-strong absolute top-1/2 right-4 z-30 hidden size-11 -translate-y-1/2 place-items-center rounded-full text-white opacity-0 transition group-hover/hero:opacity-100 md:grid"
      >
        <FaChevronRight className="size-4" />
      </button>

      <div className="absolute inset-x-4 bottom-3 z-30 flex items-center gap-3 sm:inset-x-8 md:inset-x-12">
        <div className="flex min-w-0 flex-1 gap-1.5">
          {heroItems.map((_, idx) => {
            const isCurrent = idx === currentIndex;
            return (
              <button
                key={idx}
                type="button"
                onClick={() => handleSlideClick(idx)}
                aria-label={`Show title ${idx + 1}`}
                aria-current={isCurrent ? "true" : undefined}
                className="relative h-1 min-w-0 flex-1 overflow-hidden rounded-full bg-white/25"
              >
                {isCurrent && (
                  <span
                    key={`progress-${currentIndex}-${paused ? "paused" : "play"}`}
                    className="hero-progress absolute inset-0 origin-left bg-white"
                  />
                )}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={() => setManualPaused((value) => !value)}
          aria-pressed={manualPaused}
          aria-label={manualPaused ? "Play slides" : "Pause slides"}
          className="sf-chip grid size-9 shrink-0 place-items-center rounded-full text-white"
        >
          {manualPaused ? <FaPlay className="size-3" /> : <IoPause className="size-4" />}
        </button>
      </div>
    </div>
  );
};

export default NetflixHeroBillboard;

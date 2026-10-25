import { getTvSeason } from "@/actions/catalog";
import { tmdb } from "@/api/tmdb";
import useBreakpoints from "@/hooks/useBreakpoints";
import { cn, formatDate, isEmpty } from "@/utils/helpers";
import { PlayOutline } from "@/utils/icons";
import { getImageUrl, getLoadingLabel, movieDurationString } from "@/utils/movies";
import type { ResolvedEpisode } from "@/utils/seasonResolver";
import { Card, CardBody, CardFooter, Chip, Image, Spinner } from "@heroui/react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { memo } from "react";
import { Episode } from "tmdb-ts/dist/types/tv-episode";

interface TvShowEpisodesSelectionProps {
  id: number;
  seasonNumber: number;
  preloadedEpisodes?: ResolvedEpisode[];
  filters?: {
    searchQuery?: string;
    sortedByName?: boolean;
    layout?: "list" | "grid";
  };
}

interface EpisodeCardProps {
  id: number;
  episode: Episode | ResolvedEpisode;
  order?: number;
  withAnimation?: boolean;
}

const TvShowEpisodesSelection: React.FC<TvShowEpisodesSelectionProps> = ({
  id,
  seasonNumber,
  preloadedEpisodes,
  filters: { searchQuery, sortedByName, layout } = {},
}) => {
  const hasPreloaded = Boolean(preloadedEpisodes && preloadedEpisodes.length > 0);

  const { data: result, isPending, isError } = useQuery({
    queryFn: async () => {
      const serverResult = await getTvSeason(id, seasonNumber);
      if ("data" in serverResult || serverResult.error === "not-found") return serverResult;
      try {
        const res = await tmdb.tvShows.season(id, seasonNumber);
        if (res?.episodes) return { data: res };
      } catch (err) {
        console.warn("TMDB season failed", err);
      }
      return serverResult;
    },
    queryKey: ["tv-show-episodes", id, seasonNumber],
    enabled: !hasPreloaded,
  });

  const rawEpisodes = hasPreloaded
    ? preloadedEpisodes
    : result && "data" in result
      ? result.data?.episodes
      : null;

  if (isPending && !hasPreloaded) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner variant="wave" size="lg" label={getLoadingLabel()} color="danger" />
      </div>
    );
  }

  if ((!hasPreloaded && (isError || (result && "error" in result))) || !rawEpisodes) {
    return <p className="py-6 text-sm text-white/60">Episodes could not be loaded from TMDB.</p>;
  }

  const now = new Date();
  const EPISODES = (rawEpisodes as (Episode | ResolvedEpisode)[])
    .filter((episode) => {
      // Exclude future unreleased episodes
      if (episode.air_date) {
        const air = new Date(episode.air_date);
        if (!isNaN(air.getTime()) && air.getTime() > now.getTime()) {
          return false;
        }
      }
      return searchQuery ? episode.name.toLowerCase().includes(searchQuery.toLowerCase()) : true;
    })
    .sort((a, b) => (sortedByName ? a.name.localeCompare(b.name) : 0));

  if (isEmpty(EPISODES)) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-center">No episodes found.</p>
      </div>
    );
  }

  if (layout === "grid") {
    return (
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
        {EPISODES.map((episode) => (
          <EpisodeGridCard key={episode.id} episode={episode} id={id} />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-2 sm:gap-4">
      {EPISODES.map((episode, index: number) => (
        <EpisodeListCard key={episode.id} episode={episode} order={index + 1} id={id} />
      ))}
    </div>
  );
};

export const EpisodeListCard: React.FC<EpisodeCardProps> = ({
  episode,
  order = 1,
  id,
  withAnimation = true,
}) => {
  const imageUrl = getImageUrl(episode.still_path);
  const { mobile } = useBreakpoints();
  const isNotReleased = !episode.air_date || new Date(episode.air_date) > new Date();
  const isOdd = order % 2 !== 0;
  const href = !isNotReleased
    ? `/watch/tv/${id}/${episode.season_number}/${episode.episode_number}`
    : undefined;

  return (
    <Card
      isPressable={!isNotReleased}
      as={(isNotReleased ? "div" : Link) as "a"}
      href={href}
      shadow="none"
      className={cn(
        "group motion-preset-blur-right motion-duration-300 grid grid-cols-[auto_minmax(0,1fr)] gap-3 overflow-hidden rounded-2xl border border-white/10 bg-white/5 transition-colors",
        {
          "hover:bg-white/10": !isNotReleased,
          "cursor-not-allowed opacity-50": isNotReleased,
          "motion-preset-slide-left": isOdd && withAnimation,
          "motion-preset-slide-right": !isOdd && withAnimation,
        },
      )}
    >
      <div className="relative">
        <Image
          alt={episode.name}
          src={imageUrl}
          height={120}
          width={mobile ? 180 : 220}
          className="rounded-r-none object-cover"
        />
        {!isNotReleased && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="z-10 flex h-12 w-12 items-center justify-center rounded-full bg-black/35 opacity-0 backdrop-blur-xs transition-opacity group-hover:opacity-100">
              <PlayOutline className="h-6 w-6 text-white" />
            </div>
          </div>
        )}
        {/* {isNotReleased && (
        )} */}
        <Chip
          size="sm"
          color={isNotReleased ? "warning" : undefined}
          variant={isNotReleased ? "shadow" : undefined}
          className={cn("absolute top-2 right-2 z-20", {
            "bg-black/35 backdrop-blur-xs": !isNotReleased,
          })}
        >
          {isNotReleased ? "Coming Soon" : movieDurationString(episode.runtime)}
        </Chip>
        <Chip
          size="sm"
          className="absolute bottom-2 left-2 z-20 min-w-9 bg-black/35 text-center text-white backdrop-blur-xs"
        >
          {episode.episode_number}
        </Chip>
      </div>
      <CardBody className="flex min-w-0 flex-col gap-1">
        <p
          title={episode.name}
          className={cn(
            "line-clamp-1 text-xl font-semibold transition-colors",
            !isNotReleased && "group-hover:text-[#E50914]",
          )}
        >
          {episode.name}
        </p>
        <div className="flex items-center gap-2">
          <p className="text-content4-foreground line-clamp-1 text-xs">
            {formatDate(episode.air_date, "en-US")}
          </p>
          {(episode as any).absolute_episode_number && (episode as any).absolute_episode_number !== episode.episode_number && (
            <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-medium text-white/70">
              Overall Ep {(episode as any).absolute_episode_number}
            </span>
          )}
        </div>
        <p className="text-foreground-500 line-clamp-2 text-sm" title={episode.overview}>
          {episode.overview}
        </p>
      </CardBody>
    </Card>
  );
};

const EpisodeGridCard: React.FC<EpisodeCardProps> = ({ episode, id }) => {
  const imageUrl = getImageUrl(episode.still_path);
  const isNotReleased = !episode.air_date || new Date(episode.air_date) > new Date();
  const href = !isNotReleased
    ? `/watch/tv/${id}/${episode.season_number}/${episode.episode_number}`
    : undefined;

  return (
    <Card
      isPressable={!isNotReleased}
      as={(isNotReleased ? "div" : Link) as "a"}
      href={href}
      shadow="none"
      className={cn(
        "group motion-preset-focus overflow-hidden rounded-2xl border border-white/10 bg-white/5 transition-colors",
        {
          "hover:bg-white/10": !isNotReleased,
          "cursor-not-allowed opacity-50": isNotReleased,
        },
      )}
    >
      <CardBody className="overflow-visible p-0">
        <div className="relative">
          <Image
            alt={episode.name}
            src={imageUrl}
            className="aspect-video w-full rounded-b-none object-cover"
          />
          {!isNotReleased && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="z-10 flex h-12 w-12 items-center justify-center rounded-full bg-black/35 opacity-0 backdrop-blur-xs transition-opacity group-hover:opacity-100">
                <PlayOutline className="h-6 w-6 text-white" />
              </div>
            </div>
          )}
          <Chip
            size="sm"
            color={isNotReleased ? "danger" : undefined}
            variant={isNotReleased ? "shadow" : undefined}
            className={cn("absolute top-2 right-2 z-20", {
              "bg-black/35 backdrop-blur-xs": !isNotReleased,
            })}
          >
            {isNotReleased ? "Coming Soon" : movieDurationString(episode.runtime)}
          </Chip>
          <Chip
            size="sm"
            className="absolute bottom-2 left-2 z-20 min-w-9 bg-black/35 text-center text-white backdrop-blur-xs"
          >
            {episode.episode_number}
          </Chip>
        </div>
      </CardBody>
      <CardFooter className="h-full">
        <div className="flex h-full flex-col gap-2">
          <p
            title={episode.name}
            className={cn(
              "text-lg font-semibold transition-colors",
              !isNotReleased && "group-hover:text-[#E50914]",
            )}
          >
            {episode.name}
          </p>
          <div className="flex items-center gap-2">
            <p className="text-content4-foreground line-clamp-1 text-xs">
              {formatDate(episode.air_date, "en-US")}
            </p>
            {(episode as any).absolute_episode_number && (episode as any).absolute_episode_number !== episode.episode_number && (
              <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-medium text-white/70">
                Overall Ep {(episode as any).absolute_episode_number}
              </span>
            )}
          </div>
          <p className="text-foreground-500 text-sm" title={episode.overview}>
            {episode.overview}
          </p>
        </div>
      </CardFooter>
    </Card>
  );
};

export default memo(TvShowEpisodesSelection);

"use client";

import { getWatchlist, removeAllWatchlist } from "@/actions/library";
import { queryClient } from "@/app/providers";
import BackToTopButton from "@/components/ui/button/BackToTopButton";
import ContentTypeSelection from "@/components/ui/other/ContentTypeSelection";
import useDiscoverFilters from "@/hooks/useDiscoverFilters";
import useSupabaseUser from "@/hooks/useSupabaseUser";
import { isEmpty } from "@/utils/helpers";
import { Trash } from "@/utils/icons";
import { addToast, Button, Select, SelectItem, Spinner } from "@heroui/react";
import { useDisclosure, useInViewport } from "@mantine/hooks";
import { useInfiniteQuery, useMutation } from "@tanstack/react-query";
import { Suspense, useEffect, useMemo, useState, useTransition } from "react";
import MoviePosterCard from "../Movie/Cards/Poster";
import TvShowPosterCard from "../TV/Cards/Poster";
import { getLoadingLabel } from "@/utils/movies";
import { ITEMS_PER_PAGE } from "@/utils/constants";
import ConfirmationModal from "@/components/ui/overlay/ConfirmationModal";
import Link from "next/link";
import { TbFolder } from "react-icons/tb";

type SortOption = "title" | "release_date" | "vote_average" | "created_at";
type FilterType = "movie" | "tv" | "all";

const SORT_OPTIONS: { key: SortOption; label: string }[] = [
  { key: "title", label: "Title" },
  { key: "release_date", label: "Release Date" },
  { key: "vote_average", label: "Rating" },
  { key: "created_at", label: "Date Added" },
];

const LibraryList = () => {
  const { ref, inViewport } = useInViewport();
  const { content } = useDiscoverFilters();
  const { data: user, isLoading: isUserLoading } = useSupabaseUser();
  const [isPending, startTransition] = useTransition();
  const [sortOption, setSortOption] = useState<SortOption>("created_at");
  const [opened, { open, close }] = useDisclosure(false);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, status, refetch } =
    useInfiniteQuery({
      queryKey: ["watchlist", content, user?.id],
      queryFn: async ({ pageParam = 1 }) => {
        if (!user) return { success: true, data: [], hasNextPage: false };
        return await getWatchlist(content as FilterType, pageParam, ITEMS_PER_PAGE);
      },
      initialPageParam: 1,
      getNextPageParam: (lastPage, pages) => {
        if (lastPage.hasNextPage) {
          return pages.length + 1;
        }
        return undefined;
      },
      enabled: !isUserLoading,
      staleTime: 1000 * 60 * 5,
    });

  useEffect(() => {
    if (inViewport && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [inViewport]);

  const clearWatchlistMutation = useMutation({
    mutationFn: async (type: "movie" | "tv") => {
      if (!user) throw new Error("User not authenticated");
      const result = await removeAllWatchlist(type);
      if (!result.success) {
        throw new Error(result.error || "Failed to clear watchlist");
      }
      const allItems = data?.pages.flatMap((page) => page.data || []) || [];
      const count = allItems.filter((item) => item.type === type).length;
      return { type, count };
    },
    onSuccess: ({ type, count }) => {
      queryClient.invalidateQueries({ queryKey: ["watchlist"] });

      addToast({
        title: `Cleared ${count} ${type === "movie" ? "movies" : "TV shows"} from your watchlist!`,
        color: "success",
        icon: <Trash />,
      });

      close();
    },
    onError: (error) => {
      addToast({
        title: "Error",
        description: "Failed to clear watchlist. Please try again.",
        color: "danger",
      });
      console.error("Clear watchlist error:", error);
    },
  });

  const sortedWatchlist = useMemo(() => {
    if (!data?.pages) return [];

    const allItems = data.pages.flatMap((page) => page.data || []);

    return [...allItems].sort((a, b) => {
      switch (sortOption) {
        case "vote_average":
        case "release_date":
          return b[sortOption] > a[sortOption] ? 1 : -1;
        case "created_at":
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case "title":
        default:
          return a.title.localeCompare(b.title);
      }
    });
  }, [data?.pages, sortOption]);

  const confirmClearWatchlist = () => {
    startTransition(() => {
      clearWatchlistMutation.mutate(content);
    });
  };

  if (status === "error") {
    return (
      <div className="flex h-[50vh] flex-col items-center justify-center gap-4">
        <p className="text-danger">Failed to load watchlist</p>
        <Button color="primary" onPress={() => refetch()}>
          Try Again
        </Button>
      </div>
    );
  }

  const hasItems = !isEmpty(sortedWatchlist);

  return (
    <>
      <div className="relative flex flex-col gap-6 md:gap-8">
        {/* Header with Title, Count badge, and Subtitle */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-2 border-b border-white/10">
          <div>
            <div className="flex items-center gap-3">
              <div>
                <h1 className="text-2xl font-semibold tracking-tight text-balance text-white sm:text-3xl md:text-4xl">
                  My library
                </h1>
              </div>
              {hasItems && (
                <span className="text-xs sm:text-sm font-semibold px-2.5 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/30">
                  {sortedWatchlist.length} {sortedWatchlist.length === 1 ? "item" : "items"}
                </span>
              )}
            </div>
            <p className="text-xs sm:text-sm text-gray-400 mt-1">
              Your saved {content === "movie" ? "movies" : "TV shows"} and custom watchlist
            </p>
          </div>

          {/* Action buttons (Clear button on tablet/desktop/TV) */}
          {hasItems && (
            <div className="hidden sm:flex items-center gap-2">
              <Button
                startContent={<Trash />}
                color="danger"
                variant="flat"
                size="sm"
                className="font-medium text-xs md:text-sm"
                onPress={() => {
                  if (user) open();
                }}
                isLoading={clearWatchlistMutation.isPending || isPending}
              >
                Clear Watchlist
              </Button>
            </div>
          )}
        </div>

        {/* Responsive Toolbar: Switcher & Sort Controls */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4 bg-[#181818]/60 p-2 sm:p-3 rounded-2xl border border-white/5 backdrop-blur-sm">
          {/* Switcher */}
          <div className="flex justify-center sm:justify-start">
            <ContentTypeSelection />
          </div>

          {/* Sort & Mobile Clear Controls */}
          <div className="flex items-center justify-between sm:justify-end gap-2.5 w-full sm:w-auto">
            <div className="w-full sm:w-44">
              <Select
                aria-label="Sort by"
                placeholder="Sort by"
                size="sm"
                selectedKeys={[sortOption]}
                className="w-full"
                classNames={{
                  trigger: "bg-[#202020] border border-white/10 hover:border-white/20 min-h-10 h-10",
                  value: "text-xs sm:text-sm font-medium",
                }}
                onChange={({ target }) => {
                  if (target.value) setSortOption(target.value as SortOption);
                }}
              >
                {SORT_OPTIONS.map(({ key, label }) => (
                  <SelectItem key={key}>{label}</SelectItem>
                ))}
              </Select>
            </div>

            {hasItems && (
              <div className="sm:hidden shrink-0">
                <Button
                  isIconOnly
                  aria-label="Clear Watchlist"
                  color="danger"
                  variant="flat"
                  size="md"
                  className="min-h-10 min-w-10 h-10 w-10"
                  onPress={() => {
                    if (user) open();
                  }}
                  isLoading={clearWatchlistMutation.isPending || isPending}
                >
                  <Trash />
                </Button>
              </div>
            )}
          </div>
        </div>

        {status === "pending" ? (
          <Spinner
            size="lg"
            variant="simple"
            className="absolute-center mt-[30vh]"
            color="primary"
          />
        ) : hasItems ? (
          <>
            <div className="movie-grid">
              {sortedWatchlist.map((data) => {
                if (data.type === "tv") {
                  return (
                    <Suspense key={`tv-${data.id}`}>
                      <TvShowPosterCard
                        variant="bordered"
                        // @ts-expect-error: Type conversion for compatibility
                        tv={{
                          adult: data.adult,
                          backdrop_path: data.backdrop_path,
                          first_air_date: data.release_date,
                          id: data.id,
                          name: data.title,
                          poster_path: data.poster_path || "",
                          vote_average: data.vote_average,
                        }}
                      />
                    </Suspense>
                  );
                }
                return (
                  <Suspense key={`movie-${data.id}`}>
                    <MoviePosterCard
                      variant="bordered"
                      // @ts-expect-error: Type conversion for compatibility
                      movie={{
                        adult: data.adult,
                        backdrop_path: data.backdrop_path,
                        id: data.id,
                        poster_path: data.poster_path || "",
                        release_date: data.release_date,
                        title: data.title,
                        vote_average: data.vote_average,
                      }}
                    />
                  </Suspense>
                );
              })}
            </div>
            <div ref={ref} className="flex h-24 items-center justify-center">
              {isFetchingNextPage && (
                <Spinner
                  size="lg"
                  variant="wave"
                  label={getLoadingLabel()}
                  color="primary"
                />
              )}
              {!hasNextPage && !isFetchingNextPage && sortedWatchlist.length > 0 && (
                <p className="text-muted-foreground text-center text-base">
                  You have reached the end of your watchlist.
                </p>
              )}
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center min-h-[35vh] sm:min-h-[40vh] gap-4 text-center px-4 py-12 rounded-2xl bg-white/[0.02] border border-white/5 mt-4">
            <div className="size-16 rounded-full bg-white/5 flex items-center justify-center text-gray-500 mb-1">
              <TbFolder className="size-8 text-gray-400" />
            </div>
            <h3 className="text-lg sm:text-xl font-bold text-white">
              No {content === "movie" ? "movies" : "TV shows"} saved yet
            </h3>
            <p className="text-gray-400 text-xs sm:text-sm max-w-sm">
              Discover and add {content === "movie" ? "movies" : "TV series"} to your personal watchlist to watch them anytime.
            </p>
            <Button
              as={Link}
              href="/discover"
              color="primary"
              variant="shadow"
              size="md"
              className="mt-2 font-medium"
            >
              Browse Catalog
            </Button>
          </div>
        )}
      </div>

      <BackToTopButton />

      <ConfirmationModal
        title={`Clear ${content === "movie" ? "Movies" : "TV Shows"}?`}
        isOpen={opened}
        onClose={close}
        onConfirm={confirmClearWatchlist}
        confirmLabel="Clear All"
        isLoading={clearWatchlistMutation.isPending}
      >
        <p>
          Are you sure you want to remove all {content === "movie" ? "movies" : "TV shows"} from
          your watchlist? This action cannot be undone.
        </p>
        <p className="text-default-500 text-sm">
          {sortedWatchlist.length} {sortedWatchlist.length === 1 ? "item" : "items"} will be
          removed.
        </p>
      </ConfirmationModal>
    </>
  );
};

export default LibraryList;

"use client";

import { getMovieList, getTvList, searchMovies, searchTvShows } from "@/actions/lists";
import TvShowHomeCard from "@/components/sections/TV/Cards/Poster";
import BackToTopButton from "@/components/ui/button/BackToTopButton";
import CatalogErrorState from "@/components/ui/other/CatalogErrorState";
import PopcornTvLoader from "@/components/ui/other/PopcornTvLoader";
import useDiscoverFilters from "@/hooks/useDiscoverFilters";
import { ContentType } from "@/types";
import { unwrapCatalog } from "@/utils/catalog";
import { isEmpty } from "@/utils/helpers";
import { getLoadingLabel } from "@/utils/movies";
import { useInViewport } from "@mantine/hooks";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Movie, TV } from "tmdb-ts/dist/types";
import MoviePosterCard from "../Movie/Cards/Poster";
import SearchFilter from "./Filter";

type FetchType = {
  page: number;
  type: ContentType;
  query: string;
};

/** Real TMDB search for a single page of movies or TV shows. */
const fetchSearchPage = async ({ page, type, query }: FetchType) =>
  type === "movie"
    ? unwrapCatalog(await searchMovies({ query, page }))
    : unwrapCatalog(await searchTvShows({ query, page }));

/** Real TMDB popular list, shown before the user types a query. */
const fetchPopularPage = async ({ page, type }: Omit<FetchType, "query">) =>
  type === "movie"
    ? unwrapCatalog(await getMovieList({ type: "popular", page }))
    : unwrapCatalog(await getTvList({ type: "popular", page }));

const SearchList = () => {
  const { content } = useDiscoverFilters();
  const searchParams = useSearchParams();
  const initialUrlQuery = searchParams.get("q") || "";
  const { ref, inViewport } = useInViewport();
  const [submittedSearchQuery, setSubmittedSearchQuery] = useState(initialUrlQuery);
  const [loadingLabel, setLoadingLabel] = useState("Loading");
  const triggered = !isEmpty(submittedSearchQuery);

  // Random fun label, computed after mount so SSR and the client agree.
  useEffect(() => {
    setLoadingLabel(getLoadingLabel());
  }, [submittedSearchQuery]);

  useEffect(() => {
    const q = searchParams.get("q");
    if (q !== null && q !== submittedSearchQuery) {
      setSubmittedSearchQuery(q.trim());
    }
  }, [searchParams]);

  const { data, isFetching, isPending, isError, error, fetchNextPage, isFetchingNextPage, hasNextPage, refetch, isRefetching } =
    useInfiniteQuery({
      queryKey: triggered ? ["search-list", content, submittedSearchQuery] : ["popular-list", content],
      queryFn: ({ pageParam }) =>
        triggered
          ? fetchSearchPage({ page: pageParam, type: content, query: submittedSearchQuery })
          : fetchPopularPage({ page: pageParam, type: content }),
      initialPageParam: 1,
      getNextPageParam: (lastPage) =>
        lastPage.page < lastPage.total_pages ? lastPage.page + 1 : undefined,
    });

  useEffect(() => {
    if (inViewport && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [inViewport, hasNextPage, isFetchingNextPage, fetchNextPage]);

  const results = useMemo(() => {
    const items = (data?.pages ?? []).flatMap((page) => page.results as Array<Movie | TV>);

    // TMDB can repeat an entry across pages, keep the first occurrence.
    const unique = new Map<number, Movie | TV>();
    for (const item of items) {
      if (!unique.has(item.id)) unique.set(item.id, item);
    }
    return Array.from(unique.values());
  }, [data]);

  const totalResults = data?.pages?.[0]?.total_results ?? results.length;

  const renderResults = () => {
    if (isEmpty(results)) {
      return (
        <h5 className="mt-24 text-center text-xl">
          No {content === "movie" ? "movies" : "TV series"} found with query{" "}
          <span className="text-[#E50914] font-semibold">"{submittedSearchQuery}"</span>
        </h5>
      );
    }

    return (
      <div className="movie-grid w-full">
        {results.map((item) =>
          content === "movie" ? (
            <MoviePosterCard key={item.id} movie={item as Movie} variant="bordered" />
          ) : (
            <TvShowHomeCard key={item.id} tv={item as TV} variant="bordered" />
          ),
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col items-center gap-8 pb-16">
      <SearchFilter
        // Only lock the input while a new query is resolving, not while the
        // infinite scroll loads another page.
        isLoading={isFetching && !isFetchingNextPage}
        onSearchSubmit={(value) => setSubmittedSearchQuery(value.trim())}
      />

      {isPending ? (
        <div className="flex min-h-[50vh] w-full items-center justify-center">
          <PopcornTvLoader
            size="lg"
            label={triggered ? `Searching TMDB for "${submittedSearchQuery}"` : "Loading popular titles"}
          />
        </div>
      ) : isError ? (
        <CatalogErrorState
          className="mt-16 max-w-xl"
          error={error}
          isRetrying={isRefetching}
          onRetry={() => refetch()}
          title={triggered ? "Search is unavailable" : "Popular titles are unavailable"}
        />
      ) : (
        <>
          <div className="relative flex w-full max-w-7xl flex-col items-center gap-8 px-4 md:px-8">
            {triggered ? (
              <>
                {!isEmpty(results) && (
                  <h5 className="text-center text-xl">
                    <span className="motion-preset-focus">
                      Found{" "}
                      <span className="text-success font-semibold">{totalResults}</span>{" "}
                      {content === "movie" ? "movies" : "TV series"} with query{" "}
                      <span className="text-[#E50914] font-semibold">
                        "{submittedSearchQuery}"
                      </span>
                    </span>
                  </h5>
                )}
                {renderResults()}
              </>
            ) : (
              <div className="flex w-full flex-col items-center gap-6">
                <div className="flex w-full items-center gap-2">
                  <span className="inline-block h-6 w-1.5 rounded-full bg-[#E50914]" />
                  <h3 className="text-xl font-black tracking-wide text-white md:text-2xl">
                    Popular on SnapFlix
                  </h3>
                </div>
                {renderResults()}
              </div>
            )}
          </div>

          <div ref={ref} className="flex h-24 items-center justify-center">
            {isFetchingNextPage && (
              <PopcornTvLoader size="sm" label={loadingLabel} />
            )}
            {!isEmpty(results) && !hasNextPage && !isPending && (
              <p className="text-muted-foreground text-center text-base">
                You have reached the end of the list.
              </p>
            )}
          </div>
        </>
      )}

      <BackToTopButton />
    </div>
  );
};

export default SearchList;

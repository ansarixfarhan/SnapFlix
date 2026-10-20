import { Movie, TV } from "tmdb-ts/dist/types";

export type ContentType = "movie" | "tv";

/** Failure modes reported by the TMDB server layer. */
export type CatalogError = "unconfigured" | "unauthorized" | "not-found" | "unavailable";

/** Standard paginated TMDB envelope (`/trending`, `/movie/popular`, `/search/*`, ...). */
export type CatalogList<T> = {
  page: number;
  results: T[];
  total_pages: number;
  total_results: number;
};

/**
 * Result of a catalog server action. Actions resolve instead of throwing so the
 * client always receives a serializable, user presentable error.
 */
export type CatalogListResponse<T> =
  | { ok: true; data: CatalogList<T> }
  | { ok: false; error: CatalogError; message: string };

/** Movie collections exposed by the home rows and the discover page. */
export type MovieListType = "popular" | "nowPlaying" | "upcoming" | "topRated";

/** TV collections exposed by the home rows and the discover page. */
export type TvListType = "popular" | "onTheAir" | "topRated";

/** Time window accepted by the TMDB trending endpoint. */
export type TrendingWindow = "day" | "week";

/** A movie or TV entry returned by the merged (multi) TMDB search. */
export type CatalogSuggestionItem = {
  id: number;
  title: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: string;
  vote_average: number;
  overview: string;
  media_type: ContentType;
};

export type Params<T> = {
  params: Promise<T>;
};

export type ActionResponse<T = null> = Promise<{
  success: boolean;
  message?: string;
  data?: T;
}>;

export type MovieParam =
  | "todayTrending"
  | "thisWeekTrending"
  | "popular"
  | "nowPlaying"
  | "upcoming"
  | "topRated";

export type TvShowParam =
  | "todayTrending"
  | "thisWeekTrending"
  | "popular"
  | "onTheAir"
  | "topRated";

export type QueryList<T extends Movie | TV> = {
  name: string;
  /** Server action that resolves the row from TMDB. */
  query: () => Promise<CatalogListResponse<T>>;
  param: T extends Movie ? MovieParam : TvShowParam;
};

export type SiteConfigType = {
  name: string;
  description: string;
  favicon: string;
  navItems: {
    label: string;
    href: string;
    icon: React.ReactNode;
    activeIcon: React.ReactNode;
  }[];
  queryLists: {
    movies: QueryList<Movie>[];
    tvShows: QueryList<TV>[];
  };
  themes: {
    name: "light" | "dark" | "system";
    icon: React.ReactNode;
  }[];
  socials?: {
    help?: string;
    privacy?: string;
    terms?: string;
  };
};

export type PlayersProps = {
  title: string;
  source: string;
  recommended?: boolean;
  fast?: boolean;
  ads?: boolean;
  resumable?: boolean;
};

export type Settings = {
  theme: "light" | "dark" | "system";
  showSpecialSeason: boolean;
  disableAnimation: boolean;
  saveWatchHistory: boolean;
};

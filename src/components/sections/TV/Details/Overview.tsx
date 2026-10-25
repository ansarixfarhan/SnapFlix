"use client";

import { Image, Chip, Button } from "@heroui/react";
import { getImageUrl, mutateTvShowTitle } from "@/utils/movies";
import BookmarkButton from "@/components/ui/button/BookmarkButton";
import ShareButton from "@/components/ui/button/ShareButton";
import { AppendToResponse } from "tmdb-ts/dist/types/options";
import { useDocumentTitle } from "@mantine/hooks";
import { siteConfig } from "@/config/site";
import { FaCirclePlay } from "react-icons/fa6";
import Genres from "@/components/ui/other/Genres";
import { TvShowDetails } from "tmdb-ts/dist/types/tv-shows";
import { Calendar, List, Season } from "@/utils/icons";
import Rating from "@/components/ui/other/Rating";
import SectionTitle from "@/components/ui/other/SectionTitle";
import Trailer from "@/components/ui/overlay/Trailer";
import { SavedMovieDetails } from "@/types/movie";

export interface TvShowOverviewSectionProps {
  tv: AppendToResponse<TvShowDetails, "videos"[], "tvShow">;
  onViewEpisodesClick: () => void;
}

export const TvShowOverviewSection: React.FC<TvShowOverviewSectionProps> = ({
  tv,
  onViewEpisodesClick,
}) => {
  const firstReleaseYear = new Date(tv.first_air_date).getFullYear();
  const lastReleaseYear = new Date(tv.last_air_date).getFullYear();
  const releaseYears = `${firstReleaseYear} ${firstReleaseYear !== lastReleaseYear ? ` - ${lastReleaseYear}` : ""}`;
  const posterImage = getImageUrl(tv.poster_path);
  const title = mutateTvShowTitle(tv);
  const fullTitle = title;
  const bookmarkData: SavedMovieDetails = {
    type: "tv",
    adult: "adult" in tv ? (tv.adult as boolean) : false,
    backdrop_path: tv.backdrop_path,
    id: tv.id,
    poster_path: tv.poster_path,
    release_date: tv.first_air_date,
    title: fullTitle,
    vote_average: tv.vote_average,
    saved_date: new Date().toISOString(),
  };

  useDocumentTitle(`${fullTitle} | ${siteConfig.name}`);

  return (
    <section id="overview" className="relative z-3 flex flex-col gap-8 pt-[20vh] md:pt-[40vh]">
      <div className="md:grid md:grid-cols-[auto_1fr] md:gap-6">
        <Image
          isBlurred
          shadow="md"
          alt={fullTitle}
          classNames={{
            wrapper: "w-52 max-h-min aspect-2/3 hidden md:block",
          }}
          className="object-cover object-center"
          src={posterImage}
        />

        <div className="flex flex-col gap-8">
          <div id="title" className="flex flex-col gap-1 md:gap-2">
            <Chip
              color="primary"
              variant="faded"
              className="md:text-md text-xs border-[#E50914]/40"
              classNames={{ content: "font-bold text-[#E50914]" }}
            >
              TV
            </Chip>
            <h2 className="text-2xl font-black md:text-4xl">{fullTitle}</h2>
            <div className="md:text-md flex flex-wrap gap-1 text-xs md:gap-2">
              <div className="flex items-center gap-1">
                <Season />
                <span>
                  {tv.number_of_seasons} Season{tv.number_of_seasons > 1 ? "s" : ""}
                </span>
              </div>
              <p>&#8226;</p>
              <div className="flex items-center gap-1">
                <List />
                <span>
                  {tv.number_of_episodes} Episode{tv.number_of_episodes > 1 ? "s" : ""}
                </span>
              </div>
              <p>&#8226;</p>
              <div className="flex items-center gap-1">
                <Calendar />
                <span>{releaseYears}</span>
              </div>
              <p>&#8226;</p>
              <Rating rate={tv.vote_average} count={tv.vote_count} />
            </div>
            <Genres genres={tv.genres} type="tv" />
          </div>

          <div id="action" className="flex w-full flex-wrap justify-between gap-4 md:gap-0">
            <div className="flex flex-wrap gap-2">
              <Button
                color="primary"
                variant="shadow"
                onPress={onViewEpisodesClick}
                startContent={<FaCirclePlay size={22} />}
                className="bg-[#E50914] text-white font-bold shadow-lg shadow-red-600/30"
              >
                View Episodes
              </Button>
              <Trailer color="primary" videos={tv.videos.results} />
            </div>
            <div className="flex flex-wrap gap-2">
              <ShareButton id={tv.id} title={title} type="tv" />
              <BookmarkButton data={bookmarkData} />
            </div>
          </div>

          <div id="story" className="flex flex-col gap-2">
            <SectionTitle color="primary">Story Line</SectionTitle>
            <p className="text-sm">{tv.overview}</p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default TvShowOverviewSection;

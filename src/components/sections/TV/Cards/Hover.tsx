import { tmdb } from "@/api/tmdb";
import Genres from "@/components/ui/other/Genres";
import { cn, isEmpty } from "@/utils/helpers";
import { Calendar, List, Play, Season } from "@/utils/icons";
import { getImageUrl, mutateTvShowTitle } from "@/utils/movies";
import { Button, Image, Link, Spinner } from "@heroui/react";
import { useQuery } from "@tanstack/react-query";
import Rating from "../../../ui/other/Rating";
import { SavedMovieDetails } from "@/types/movie";
import BookmarkButton from "@/components/ui/button/BookmarkButton";

const TvShowHoverCard: React.FC<{ id: number; fullWidth?: boolean }> = ({ id, fullWidth }) => {
  const { data: tv, isPending } = useQuery({
    queryFn: () => tmdb.tvShows.details(id, ["images"]),
    queryKey: ["get-tv-detail-on-hover-poster", id],
  });

  if (isPending) {
    return (
      <div
        className={cn("sf-glass-strong grid h-96 w-80 place-items-center rounded-[1.4rem]", {
          "w-full": fullWidth,
        })}
      >
        <Spinner size="lg" color="warning" variant="simple" />
      </div>
    );
  }

  if (!tv) return null;

  const title = mutateTvShowTitle(tv);
  const firstReleaseYear = new Date(tv.first_air_date).getFullYear();
  const lastReleaseYear = new Date(tv.last_air_date).getFullYear();
  const releaseYears = `${firstReleaseYear} ${firstReleaseYear !== lastReleaseYear ? ` - ${lastReleaseYear}` : ""}`;
  const fullTitle = title;
  const backdropImage = getImageUrl(tv.backdrop_path, "backdrop");
  const titleImage = getImageUrl(
    tv.images.logos.find((logo) => logo.iso_639_1 === "en")?.file_path,
    "title",
  );
  const matchPercentage = Math.min(99, Math.round((tv.vote_average || 7.5) * 10 + 8));
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

  return (
    <div
      className={cn(
        "sf-glass-strong w-80 overflow-hidden rounded-[1.4rem] text-white shadow-2xl",
        { "w-full": fullWidth },
      )}
    >
      <div className="relative aspect-video w-full overflow-hidden bg-[#0b0b0e]">
        <Image
          radius="none"
          alt={fullTitle}
          className="z-0 aspect-video w-full object-cover object-center"
          src={backdropImage}
        />
        <div className="pointer-events-none absolute inset-0 z-1 bg-gradient-to-t from-[#0b0b0e] via-[#0b0b0e]/30 to-transparent" />
        {!isEmpty(titleImage) && (
          <div className="pointer-events-none absolute inset-0 z-2 flex items-center justify-center p-4">
            <Image
              isBlurred
              radius="none"
              alt={fullTitle}
              className="max-h-24 max-w-[82%] object-contain drop-shadow-2xl"
              src={titleImage}
            />
          </div>
        )}
        <div className="absolute top-3 left-3 z-3 flex items-center gap-1.5">
          <span className="sf-chip inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold tracking-wide text-white uppercase backdrop-blur-md">
            <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-[#f5c451]" />
            TV
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-2.5 p-4 pt-3">
        <h4 className="line-clamp-2 text-lg font-black leading-snug tracking-tight text-white">
          {fullTitle}
        </h4>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="font-extrabold text-[#46d369]">{matchPercentage}% Match</span>
          <div className="flex items-center gap-1 text-white/75">
            <Season />
            <span>
              {tv.number_of_seasons} Season{tv.number_of_seasons > 1 ? "s" : ""}
            </span>
          </div>
          <p className="text-white/35">&#8226;</p>
          <div className="flex items-center gap-1 text-white/75">
            <List />
            <span>
              {tv.number_of_episodes} Episode{tv.number_of_episodes > 1 ? "s" : ""}
            </span>
          </div>
          <p className="text-white/35">&#8226;</p>
          <div className="flex items-center gap-1 text-white/75">
            <Calendar />
            <span>{releaseYears}</span>
          </div>
          <p className="text-white/35">&#8226;</p>
          <Rating rate={tv.vote_average} count={tv.vote_count} />
        </div>
        <Genres
          genres={tv.genres}
          type="tv"
          chipProps={{
            size: "sm",
            variant: "flat",
            radius: "full",
            className: "sf-chip text-white/85!",
          }}
        />
        <div className="flex w-full justify-between gap-2 py-1">
          <Button
            as={Link}
            href={`/tv/${tv.id}`}
            fullWidth
            color="primary"
            variant="shadow"
            startContent={<Play size={24} />}
          >
            View Episodes
          </Button>
          <BookmarkButton data={bookmarkData} isTooltipDisabled />
        </div>
        <p className="line-clamp-4 text-sm leading-relaxed text-white/80">{tv.overview}</p>
      </div>
    </div>
  );
};

export default TvShowHoverCard;

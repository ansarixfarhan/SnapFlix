"use client";

import { useState } from "react";
import BookmarkButton from "@/components/ui/button/BookmarkButton";
import MarkCompletedButton from "@/components/ui/button/MarkCompletedButton";
import ShareButton from "@/components/ui/button/ShareButton";
import Trailer from "@/components/ui/overlay/Trailer";
import { SavedMovieDetails } from "@/types/movie";
import { getImageUrl, movieDurationString, mutateMovieTitle, mutateTvShowTitle } from "@/utils/movies";
import Link from "next/link";
import { FaPlay, FaClock } from "react-icons/fa6";
import { IoListOutline } from "react-icons/io5";

interface DetailHeroBillboardProps {
  media: any;
  type: "movie" | "tv";
  onViewEpisodesClick?: () => void;
}

const heroFrame =
  "relative h-[62dvh] min-h-[420px] max-h-[540px] w-full overflow-hidden bg-[#0c0c0e] sm:h-[70dvh] sm:min-h-[500px] sm:max-h-[680px] lg:h-[78dvh] lg:min-h-[560px] lg:max-h-[820px]";

const iconChip = "sf-chip size-11 min-w-11 shrink-0 rounded-full bg-transparent text-white shadow-none";

const DetailHeroBillboard: React.FC<DetailHeroBillboardProps> = ({
  media,
  type,
  onViewEpisodesClick,
}) => {
  const [logoFailed, setLogoFailed] = useState(false);
  const isTv = type === "tv";
  const title = isTv ? mutateTvShowTitle(media) : mutateMovieTitle(media);

  const logos = media.images?.logos || [];
  const pngLogos = logos.filter((l: any) => l.file_path && !l.file_path.endsWith(".svg"));
  const candidate =
    pngLogos.find((l: any) => l.iso_639_1 === "en") ||
    pngLogos.find((l: any) => !l.iso_639_1) ||
    pngLogos[0] ||
    logos[0];
  const titleLogoUrl = candidate?.file_path ? getImageUrl(candidate.file_path, "title") : null;
  const releaseDate = media.release_date || media.first_air_date;
  const parsedDate = releaseDate ? new Date(releaseDate) : null;
  const releaseYear = parsedDate && !Number.isNaN(parsedDate.getTime()) ? parsedDate.getFullYear() : null;
  const isNotReleased = parsedDate && !Number.isNaN(parsedDate.getTime()) ? parsedDate.getTime() > Date.now() : false;
  const playHref = isTv ? `/watch/tv/${media.id}/1/1` : `/watch/movie/${media.id}`;
  const bgUrl = getImageUrl(media.backdrop_path || media.images?.backdrops?.[0]?.file_path, "backdrop", true);
  const matchPercentage =
    typeof media.vote_average === "number" && media.vote_average > 0
      ? Math.min(99, Math.round(media.vote_average * 10))
      : null;
  const runtimeText = !isTv && media.runtime ? movieDurationString(media.runtime) : null;
  const seasonsText =
    isTv && media.number_of_seasons
      ? `${media.number_of_seasons} season${media.number_of_seasons > 1 ? "s" : ""}`
      : null;
  const videos = media.videos?.results || [];

  const bookmarkData: SavedMovieDetails = {
    type: isTv ? "tv" : "movie",
    adult: media.adult || false,
    backdrop_path: media.backdrop_path,
    id: media.id,
    poster_path: media.poster_path,
    release_date: releaseDate || "",
    title,
    vote_average: media.vote_average,
    saved_date: new Date().toISOString(),
  };

  return (
    <div className={heroFrame}>
      <img
        src={bgUrl}
        alt=""
        width={1280}
        height={720}
        fetchPriority="high"
        className="hero-ken pointer-events-none absolute inset-0 size-full object-cover object-[center_22%] sm:object-top"
        draggable={false}
      />

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-[68%] bg-linear-to-t from-[#0c0c0e] via-[#0c0c0e]/80 to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 hidden w-1/2 bg-linear-to-r from-[#0c0c0e]/70 to-transparent md:block" />

      <div className="absolute inset-x-4 bottom-8 z-20 flex max-w-xl flex-col gap-2 sm:inset-x-8 sm:bottom-10 md:left-12 md:gap-3">
        <p className="text-xs font-semibold text-white/80 sm:text-sm">
          {matchPercentage ? (
            <span className="text-[#46d369]">{matchPercentage}% match</span>
          ) : (
            <span>{isTv ? "Series" : "Film"}</span>
          )}
          {matchPercentage && (
            <>
              <span className="mx-2 text-white/35">·</span>
              {isTv ? "Series" : "Film"}
            </>
          )}
        </p>

        {titleLogoUrl && !logoFailed ? (
          <div className="h-14 sm:h-20 md:h-24 lg:h-28 max-w-[260px] sm:max-w-sm md:max-w-md lg:max-w-lg flex items-center justify-start drop-shadow-[0_4px_16px_rgba(0,0,0,0.85)] my-1 sm:my-2">
            <img
              src={titleLogoUrl}
              alt={title}
              className="max-h-full max-w-full object-contain object-left select-none"
              onError={() => setLogoFailed(true)}
              draggable={false}
            />
          </div>
        ) : (
          <h1 className="line-clamp-2 text-[1.7rem] leading-[1.05] font-black tracking-tight text-white drop-shadow-[0_4px_16px_rgba(0,0,0,0.85)] sm:text-5xl lg:text-6xl">
            {title}
          </h1>
        )}

        <div className="flex flex-wrap items-center gap-2 text-[11px] text-white/75 sm:text-sm">
          {releaseYear && <span>{releaseYear}</span>}
          {media.adult && (
            <span className="rounded-full border border-white/25 px-1.5 py-0.5 text-[10px] font-semibold text-white">
              18+
            </span>
          )}
          {runtimeText && <span>{runtimeText}</span>}
          {seasonsText && <span>{seasonsText}</span>}
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pt-1 no-scrollbar">
          {isNotReleased && !isTv ? (
            <div className="inline-flex h-11 shrink-0 items-center gap-2 rounded-full bg-amber-500/20 border border-amber-500/40 px-5 text-sm font-bold text-amber-400">
              <FaClock className="size-3.5" />
              Coming Soon ({releaseYear || "Upcoming"})
            </div>
          ) : (
            <Link
              href={playHref}
              className="inline-flex h-11 shrink-0 items-center gap-2 rounded-full bg-white px-5 text-sm font-bold text-black transition active:scale-95"
            >
              <FaPlay className="size-3.5" />
              Play
            </Link>
          )}
          {isTv && onViewEpisodesClick && (
            <button
              type="button"
              onClick={onViewEpisodesClick}
              className="sf-chip inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full px-4 text-sm font-semibold text-white transition hover:bg-white/15 active:scale-95"
            >
              <IoListOutline className="size-5" />
              Episodes
            </button>
          )}
          {videos.length > 0 && <Trailer videos={videos} appearance="chip" />}
          {!isTv && <MarkCompletedButton movieId={media.id} />}
          <BookmarkButton data={bookmarkData} className={iconChip} />
          <ShareButton id={media.id} title={title} type={type} className={iconChip} />
        </div>
      </div>
    </div>
  );
};

export default DetailHeroBillboard;

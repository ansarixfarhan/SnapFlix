"use client";

import { useEffect, useState, useTransition } from "react";
import { BsBookmarkCheckFill, BsBookmarkFill } from "react-icons/bs";
import { addToast } from "@heroui/react";
import IconButton from "./IconButton";
import { Trash } from "@/utils/icons";
import useDeviceVibration from "@/hooks/useDeviceVibration";
import useSupabaseUser from "@/hooks/useSupabaseUser";
import { SavedMovieDetails } from "@/types/movie";
import { addToWatchlist, removeFromWatchlist, checkInWatchlist } from "@/actions/library";
import { queryClient } from "@/app/providers";
import { usePathname } from "next/navigation";

interface BookmarkButtonProps {
  data: SavedMovieDetails;
  isTooltipDisabled?: boolean;
  className?: string;
}

const BookmarkButton: React.FC<BookmarkButtonProps> = ({ data, isTooltipDisabled, className }) => {
  const pathname = usePathname();
  const { startVibration } = useDeviceVibration();
  const { data: user, isLoading: isUserLoading } = useSupabaseUser();
  const [isPending, startTransition] = useTransition();
  const [isSaved, setIsSaved] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const checkWatchlistStatus = async () => {
      if (!user) {
        setIsChecking(false);
        setIsSaved(false);
        return;
      }

      setIsChecking(true);
      try {
        const result = await checkInWatchlist(data.id, data.type);
        if (result.success) {
          setIsSaved(result.isInWatchlist);
        }
      } catch (error) {
        console.error("Error checking watchlist status:", error);
      } finally {
        setIsChecking(false);
      }
    };

    checkWatchlistStatus();
  }, [user, data.id, data.type]);

  const handleBookmark = () => {
    if (!user) {
      addToast({
        title: "You must be logged in to use this feature",
        color: "warning",
      });
      return;
    }

    startTransition(async () => {
      try {
        if (isSaved) {
          const result = await removeFromWatchlist(data.id, data.type);

          if (result.success) {
            setIsSaved(false);

            addToast({
              title: `${data.title} removed from your watchlist!`,
              color: "danger",
              icon: <Trash />,
            });

            if (pathname.startsWith("/library")) {
              queryClient.invalidateQueries({ queryKey: ["watchlist"] });
            }
          } else {
            addToast({
              title: "Error",
              description: result.error || "Failed to remove from watchlist",
              color: "danger",
            });
          }
        } else {
          const watchlistItem = {
            id: data.id,
            type: data.type,
            adult: data.adult,
            backdrop_path: data.backdrop_path,
            poster_path: data.poster_path || null,
            release_date: data.release_date,
            title: data.title,
            vote_average: data.vote_average,
          };

          const result = await addToWatchlist(watchlistItem);

          if (result.success) {
            setIsSaved(true);
            startVibration([100]);
            addToast({
              title: `${data.title} added to your watchlist!`,
              color: "success",
            });
          } else {
            if (result.error === "This item is already in your watchlist") {
              setIsSaved(true);
              addToast({
                title: "Already in watchlist",
                description: `${data.title} is already in your watchlist`,
                color: "warning",
              });
            } else {
              addToast({
                title: "Error",
                description: result.error || "Failed to add to watchlist",
                color: "danger",
              });
            }
          }
        }
      } catch (error) {
        console.error("Error updating watchlist:", error);
        addToast({
          title: "Error",
          description: "An unexpected error occurred",
          color: "danger",
        });
      }
    });
  };

  return (
    <IconButton
      onPress={handleBookmark}
      icon={isSaved ? <BsBookmarkCheckFill size={20} /> : <BsBookmarkFill size={20} />}
      variant={isSaved ? "shadow" : "faded"}
      color="primary"
      className={className}
      isLoading={isUserLoading || isChecking || isPending}
      tooltip={
        isTooltipDisabled ? undefined : isSaved ? "Remove from Watchlist" : "Add to Watchlist"
      }
    />
  );
};

export default BookmarkButton;

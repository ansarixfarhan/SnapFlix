"use client";

import React, { useState, useEffect } from "react";
import { cn } from "@/utils/helpers";

export type AvatarId = "red" | "yellow" | "blue" | "grey";

interface NetflixAvatarProps
  extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, "src"> {
  size?: number | string;
  avatarId?: AvatarId | string | null;
  className?: string;
}

export const NetflixAvatar: React.FC<NetflixAvatarProps> = ({
  size = 28,
  avatarId = "red",
  className,
  alt = "Profile Avatar",
  ...props
}) => {
  const validId =
    avatarId && ["red", "yellow", "blue", "grey"].includes(avatarId as string)
      ? avatarId
      : "red";

  const [imgSrc, setImgSrc] = useState(`/images/avatars/avatar_${validId}.png`);

  useEffect(() => {
    setImgSrc(`/images/avatars/avatar_${validId}.png`);
  }, [validId]);

  return (
    <img
      src={imgSrc}
      alt={alt}
      width={typeof size === "number" ? size : undefined}
      height={typeof size === "number" ? size : undefined}
      onError={() => {
        if (imgSrc !== "/images/avatars/avatar_red.png") {
          setImgSrc("/images/avatars/avatar_red.png");
        }
      }}
      className={cn(
        "shrink-0 select-none overflow-hidden rounded-full object-cover",
        className
      )}
      style={
        typeof size === "number"
          ? { width: size, height: size }
          : undefined
      }
      {...props}
    />
  );
};

export default NetflixAvatar;

"use client";

import BackButton from "@/components/ui/button/BackButton";
import { siteConfig } from "@/config/site";
import { cn } from "@/utils/helpers";
import { Navbar, NavbarBrand, NavbarContent, NavbarItem } from "@heroui/react";
import { useWindowScroll } from "@mantine/hooks";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import UserProfileButton from "../button/UserProfileButton";
import BrandLogo from "../other/BrandLogo";
import NavSearch from "./NavSearch";

const TopNavbar = () => {
  const pathName = usePathname();
  const searchParams = useSearchParams();
  const currentContent = searchParams.get("content");
  const [{ y }] = useWindowScroll();
  const isScrolled = y > 25;

  const tv = pathName.includes("/tv/");
  const player = pathName.includes("/player") || pathName.startsWith("/watch") || pathName.startsWith("/embed");
  const auth = pathName.includes("/auth");

  if (auth || player) return null;

  const isHome = pathName === "/";
  const isMediaRoute = pathName.startsWith("/movie/") || pathName.startsWith("/tv/");

  const navLinks = [
    { label: "Home", href: "/", active: isHome && !currentContent },
    { label: "TV Series", href: "/?content=tv", active: isHome && currentContent === "tv" },
    { label: "Movies", href: "/?content=movie", active: isHome && currentContent === "movie" },
    { label: "New & Popular", href: "/discover", active: pathName === "/discover" },
    { label: "My List", href: "/library", active: pathName === "/library" },
  ];

  return (
    <Navbar
      disableScrollHandler
      isBlurred={false}
      position="static"
      maxWidth="full"
      classNames={{
        base: "bg-transparent",
        wrapper: "h-14 max-w-full bg-transparent px-2.5 sm:px-3.5",
      }}
      className={cn(
        "sf-glass-strong fixed z-50 mx-auto w-auto rounded-full transition-all duration-300",
        "top-[max(0.55rem,env(safe-area-inset-top))] right-3 left-3 md:right-6 md:left-6 lg:right-10 lg:left-10",
        isScrolled && "shadow-[0_18px_40px_rgba(0,0,0,0.45)]",
      )}
    >
      {/* Left: Brand Logo */}
      <NavbarBrand className="grow-0 basis-auto shrink-0">
        {!isMediaRoute ? (
          <BrandLogo size="sm" className="[&_svg]:h-7 sm:[&_svg]:h-8 md:[&_svg]:h-9" />
        ) : (
          <BackButton href={tv ? "/?content=tv" : "/"} />
        )}
      </NavbarBrand>

      {/* Center: Netflix Translucent Cylinder Nav Links */}
      <NavbarContent justify="center" className="hidden md:flex grow">
        <nav className="sf-chip flex items-center gap-0.5 rounded-full p-1">
          {navLinks.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              aria-current={link.active ? "page" : undefined}
              className={cn(
                "rounded-full px-3.5 py-1.5 text-xs font-semibold tracking-wide transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white lg:px-4 lg:text-sm",
                link.active
                  ? "bg-white text-black shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]"
                  : "text-white/75 hover:bg-white/12 hover:text-white",
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </NavbarContent>

      {/* Right: Actions */}
      <NavbarContent justify="end" className="gap-2 sm:gap-3 md:gap-4 shrink-0 grow-0 basis-auto">
        {/* Interactive In-Navbar Search with Live Overlay */}
        <NavbarItem>
          <NavSearch />
        </NavbarItem>

        <NavbarItem>
          <UserProfileButton />
        </NavbarItem>
      </NavbarContent>
    </Navbar>
  );
};

export default TopNavbar;

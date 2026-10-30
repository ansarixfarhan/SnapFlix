import type { Metadata, Viewport } from "next";
import { siteConfig } from "@/config/site";
import { BebasNeue, Poppins } from "@/utils/fonts";
import "../styles/globals.css";
import "../styles/lightbox.css";
import Providers from "./providers";
import TopNavbar from "@/components/ui/layout/TopNavbar";
import BottomNavbar from "@/components/ui/layout/BottomNavbar";
import Sidebar from "@/components/ui/layout/Sidebar";
import { cn } from "@/utils/helpers";

import { NuqsAdapter } from "nuqs/adapters/next/app";
import { Suspense } from "react";


export const metadata: Metadata = {
  title: siteConfig.name,
  applicationName: siteConfig.name,
  description: siteConfig.description,
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/snapflix.png", type: "image/png" },
      { url: "/icons/android/android-launchericon-192-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/android/android-launchericon-512-512.png", sizes: "512x512", type: "image/png" },
      { url: "/favicon.ico", sizes: "any" },
    ],
    shortcut: "/snapflix.png",
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  twitter: {
    card: "summary",
    title: {
      default: siteConfig.name,
      template: siteConfig.name,
    },
    description: siteConfig.description,
  },
  openGraph: {
    type: "website",
    siteName: siteConfig.name,
    title: {
      default: siteConfig.name,
      template: siteConfig.name,
    },
    description: siteConfig.description,
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#0c0c0e" },
    { media: "(prefers-color-scheme: dark)", color: "#0c0c0e" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html suppressHydrationWarning lang="en" className="dark" style={{ colorScheme: "dark" }}>
      <link rel="preconnect" href="https://image.tmdb.org" crossOrigin="anonymous" />
      <body
        suppressHydrationWarning
        className={cn(
          "bg-background min-h-dvh antialiased text-foreground overflow-x-hidden",
          Poppins.className,
          BebasNeue.variable,
        )}
      >
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[80] focus:rounded-md focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-black"
        >
          Skip to content
        </a>
        <Suspense>
          <NuqsAdapter>
            <Providers>

              <TopNavbar />
              <Sidebar>
                <main id="main" className="w-full min-h-screen overflow-x-hidden scroll-mt-20">
                  {children}
                </main>
              </Sidebar>
              <BottomNavbar />
            </Providers>
          </NuqsAdapter>
        </Suspense>
      </body>
    </html>
  );
}

"use client";

import { PropsWithChildren, Suspense } from "react";
import { HeroUIProvider, ToastProvider } from "@heroui/react";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AppProgressProvider as ProgressProvider } from "@bprogress/next";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 10, // 10 minutes cache
      gcTime: 1000 * 60 * 60, // 1 hour memory persistence
      refetchOnWindowFocus: false, // Prevents heavy reload spikes when switching windows/tabs
      refetchOnReconnect: false,
      retry: 1,
    },
  },
});

export default function Providers({ children }: PropsWithChildren) {
  const { push } = useRouter();
  const pathName = usePathname();
  const searchParams = useSearchParams();
  const content = searchParams.get("content");
  const tv = pathName.includes("/tv/") || content === "tv";

  return (
    <QueryClientProvider client={queryClient}>
      <HeroUIProvider navigate={push}>
        <ToastProvider
          placement="top-right"
          maxVisibleToasts={1}
          toastOffset={10}
          toastProps={{
            shouldShowTimeoutProgress: true,
            timeout: 5000,
            classNames: {
              content: "mr-7",
              closeButton:
                "opacity-100 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-auto",
            },
          }}
        />
        <NextThemesProvider attribute="class" defaultTheme="dark" enableSystem>
          {/* https://github.com/vercel/next.js/discussions/61654#discussioncomment-8480088 */}
          <Suspense>
            <ProgressProvider
              options={{ showSpinner: false }}
              color="#E50914"
            >
              {children}
            </ProgressProvider>
          </Suspense>
        </NextThemesProvider>
      </HeroUIProvider>
    </QueryClientProvider>
  );
}

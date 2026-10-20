import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { env } from "../env";

const PROTECTED_PATHS = env.PROTECTED_PATHS?.split(",") ?? [];

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });
  const pathname = request.nextUrl.pathname;

  // 1. Skip completely for static files, cdn-cgi, and assets (0ms overhead)
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/cdn-cgi") ||
    /\.(?:svg|png|jpg|jpeg|gif|webp|woff|woff2|js|css)$/i.test(pathname)
  ) {
    return supabaseResponse;
  }

  // 2. High-performance auth check: Does the client have a Supabase auth token cookie?
  const allCookies = request.cookies.getAll();
  const hasAuthCookie = allCookies.some(
    (c) => c.name.includes("auth-token") || c.name.startsWith("sb-")
  );

  const isProtectedPath = PROTECTED_PATHS.some((url) => pathname.startsWith(url));

  // If no auth cookie exists (guest browsing)
  if (!hasAuthCookie) {
    // If guest tries to access protected path (/profile, /auth/reset-password), redirect to /auth instantly
    if (isProtectedPath) {
      const url = request.nextUrl.clone();
      url.pathname = "/auth";
      return NextResponse.redirect(url);
    }
    // Guest accessing public page (/ , /movie/..., /tv/..., /watch/...) -> return immediately! 0ms latency, zero remote calls!
    return supabaseResponse;
  }

  // If Supabase URL is placeholder/invalid, skip auth check gracefully
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  if (
    !supabaseUrl ||
    !supabaseUrl.startsWith("http") ||
    supabaseUrl.includes("your_supabase_url")
  ) {
    return supabaseResponse;
  }

  try {
    const supabase = createServerClient(
      supabaseUrl,
      env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "dummy-key",
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
            supabaseResponse = NextResponse.next({ request });
            cookiesToSet.forEach(({ name, value, options }) =>
              supabaseResponse.cookies.set(name, value, options),
            );
          },
        },
      },
    );

    const {
      data: { user },
    } = await supabase.auth.getUser();

    // if user is not logged in and the current pathname is protected, redirect to login page
    if (!user && isProtectedPath) {
      const url = request.nextUrl.clone();
      url.pathname = "/auth";

      const redirectRes = NextResponse.redirect(url);

      supabaseResponse.cookies.getAll().forEach((cookie) => {
        redirectRes.cookies.set(cookie.name, cookie.value, cookie);
      });

      return redirectRes;
    }

    // if user is logged in and the current pathname is auth, redirect to home page
    if (user && pathname === "/auth") {
      const url = request.nextUrl.clone();
      url.pathname = "/";

      const redirectRes = NextResponse.redirect(url);

      supabaseResponse.cookies.getAll().forEach((cookie) => {
        redirectRes.cookies.set(cookie.name, cookie.value, cookie);
      });

      return redirectRes;
    }
  } catch (error) {
    // If Supabase call fails in dev/mock, pass through
    return supabaseResponse;
  }

  return supabaseResponse;
}

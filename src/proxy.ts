import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/utils/supabase/middleware";

const ROAST_PAYLOAD = {
  status: 403,
  success: false,
  error: "Forbidden: Unauthorized Intruder Detected",
  message: "Bhai, ye tumhari ex ka ass hole nahi hai jo har koi munh utha ke ghus jayega! 🚪🚫",
  emotional_damage: "Kyun bhai? Zindagi me koi validation nahi mil rahi jo backend ke URL inspect karne aa gaye? 🤡",
  reality_check: "Ye SnapFlix ka private resolver backend hai. Yahan ghusne ki aukaat aur permission dono nahi hai tumhare paas.",
  advice: "Chupchaap https://snapflix.indevs.in par jao aur popcorn leke movie dekho, yahan faltu ungli mat karo.",
};

export async function proxy(request: NextRequest) {
  const host =
    request.headers.get("x-forwarded-host") ||
    request.headers.get("host") ||
    "";
  const pathname = request.nextUrl.pathname;

  // If visiting the backend API domain (api.snapflix.indevs.in)
  if (host.includes("api.snapflix.indevs.in") || host.startsWith("api.")) {
    // If accessing root, non-API routes, or bare /api
    const isBareApi = pathname === "/api" || pathname === "/api/";
    const isNonApi = !pathname.startsWith("/api/");

    if (isBareApi || isNonApi) {
      return NextResponse.json(
        {
          ...ROAST_PAYLOAD,
          timestamp: new Date().toISOString(),
        },
        {
          status: 403,
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Access-Control-Allow-Origin": "*",
            "Cache-Control": "no-store, no-cache, must-revalidate",
          },
        }
      );
    }
  }

  // update user's auth session for normal frontend requests
  return await updateSession(request);
}

export const middleware = proxy;

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|cdn-cgi|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff|woff2|js|css)$).*)",
  ],
};


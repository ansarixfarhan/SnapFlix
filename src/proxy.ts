import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/utils/supabase/middleware";

const ROAST_PAYLOAD = {
  status: 403,
  success: false,
  error: "Forbidden: Unauthorized Intruder Detected",
  message: "This isn't your ex's asshole where anyone can just slide in without permission. 🚪🚫",
  emotional_damage: "Did you genuinely believe you discovered a secret backdoor, or are you just starved for attention? 💀",
  reality_check: "This is a private SnapFlix backend API gateway. You don't have the clearance, the authorization, or the intellect to be here.",
  advice: "Close DevTools, wipe the drool off your keyboard, head over to https://snapflix.indevs.in and watch a movie like a normal human being.",
  incident_id: "YOUR_EGO_HAS_BEEN_CRUSHED",
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


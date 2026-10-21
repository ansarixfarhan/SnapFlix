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

const ROAST_MARKDOWN = `# 403 Forbidden — Unauthorized Access

> "This isn't your ex's asshole where anyone can just slide in without permission." 🚪🚫

### 💀 Emotional Damage
Did you genuinely believe you discovered a secret backdoor, or are you just starved for attention?

### 🛡️ Reality Check
This is SnapFlix's private stream resolver backend. You possess neither the clearance, the authorization, nor the intellect to probe this gateway.

### 🍿 Prescribed Cure
Close DevTools, wipe the drool off your keyboard, and go back to watching movies like a normal human being.

---
👉 Official Website: https://snapflix.indevs.in
INCIDENT ID: #YOUR_EGO_HAS_BEEN_CRUSHED | PROTOCOL: ZERO_CHILL
`;

export async function proxy(request: NextRequest) {
  const host =
    request.headers.get("x-forwarded-host") ||
    request.headers.get("host") ||
    "";
  const pathname = request.nextUrl.pathname;

  // If visiting the backend API domain (api.snapflix.indevs.in, onrender.com, etc.)
  const isBackendHost =
    host.includes("api.snapflix.indevs.in") ||
    host.startsWith("api.") ||
    host.includes("onrender.com");

  if (isBackendHost) {
    // If accessing root, non-API routes, or bare /api
    const isBareApi = pathname === "/api" || pathname === "/api/";
    const isNonApi = !pathname.startsWith("/api/");

    if (isBareApi || isNonApi) {
      return new NextResponse(ROAST_MARKDOWN, {
        status: 403,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-store, no-cache, must-revalidate",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
          "Access-Control-Allow-Headers": "*",
        },
      });
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


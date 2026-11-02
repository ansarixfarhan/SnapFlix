import { getMobileHome } from "@/lib/mobile/catalog";
import { MOBILE_CACHE_TTL } from "@/lib/mobile/constants";
import { runMobileEndpoint } from "@/lib/mobile/http";
import { homeCacheKey, parseHomeParams } from "@/lib/mobile/validation";

/** Mobile home: one cached request for a hero plus every fixed TMDB row. */
export async function GET(request: Request) {
  return runMobileEndpoint(request, {
    parse: parseHomeParams,
    cacheKey: homeCacheKey,
    ttlSeconds: MOBILE_CACHE_TTL.home,
    rateLimitCost: 2,
    load: getMobileHome,
  });
}

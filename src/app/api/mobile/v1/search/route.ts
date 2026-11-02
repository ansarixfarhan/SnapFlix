import { getMobileSearch } from "@/lib/mobile/catalog";
import { MOBILE_CACHE_TTL } from "@/lib/mobile/constants";
import { runMobileEndpoint } from "@/lib/mobile/http";
import { parseSearchParams, searchCacheKey } from "@/lib/mobile/validation";

/** Movie, TV or merged TMDB search; person results are removed from multi search. */
export async function GET(request: Request) {
  return runMobileEndpoint(request, {
    parse: parseSearchParams,
    cacheKey: searchCacheKey,
    ttlSeconds: MOBILE_CACHE_TTL.search,
    rateLimitCost: 2,
    load: getMobileSearch,
  });
}

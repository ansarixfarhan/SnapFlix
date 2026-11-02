import { getMobileDetails } from "@/lib/mobile/catalog";
import { MOBILE_CACHE_TTL } from "@/lib/mobile/constants";
import { runMobileEndpoint } from "@/lib/mobile/http";
import { detailsCacheKey, parseDetailsParams } from "@/lib/mobile/validation";

/** Consolidated movie or TV details, credits, media, related titles and seasons. */
export async function GET(request: Request) {
  return runMobileEndpoint(request, {
    parse: parseDetailsParams,
    cacheKey: detailsCacheKey,
    ttlSeconds: MOBILE_CACHE_TTL.details,
    rateLimitCost: 1,
    load: getMobileDetails,
  });
}

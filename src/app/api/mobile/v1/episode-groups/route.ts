import { getMobileEpisodeGroup } from "@/lib/mobile/catalog";
import { MOBILE_CACHE_TTL } from "@/lib/mobile/constants";
import { runMobileEndpoint } from "@/lib/mobile/http";
import { episodeGroupCacheKey, parseEpisodeGroupParams } from "@/lib/mobile/validation";

/** Alternate episode ordering (for example anime season groups). */
export async function GET(request: Request) {
  return runMobileEndpoint(request, {
    parse: parseEpisodeGroupParams,
    cacheKey: episodeGroupCacheKey,
    ttlSeconds: MOBILE_CACHE_TTL.episodeGroup,
    rateLimitCost: 1,
    load: getMobileEpisodeGroup,
  });
}

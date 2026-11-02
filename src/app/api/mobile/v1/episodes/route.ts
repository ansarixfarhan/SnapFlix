import { getMobileEpisodes } from "@/lib/mobile/catalog";
import { MOBILE_CACHE_TTL } from "@/lib/mobile/constants";
import { runMobileEndpoint } from "@/lib/mobile/http";
import { episodesCacheKey, parseEpisodesParams } from "@/lib/mobile/validation";

/** Episodes for one TMDB TV season, including playback-ready season/episode numbers. */
export async function GET(request: Request) {
  return runMobileEndpoint(request, {
    parse: parseEpisodesParams,
    cacheKey: episodesCacheKey,
    ttlSeconds: MOBILE_CACHE_TTL.episodes,
    rateLimitCost: 1,
    load: getMobileEpisodes,
  });
}

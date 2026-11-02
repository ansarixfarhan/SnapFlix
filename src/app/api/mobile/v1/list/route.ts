import { getMobileList } from "@/lib/mobile/catalog";
import { MOBILE_CACHE_TTL } from "@/lib/mobile/constants";
import { runMobileEndpoint } from "@/lib/mobile/http";
import { listCacheKey, parseListParams } from "@/lib/mobile/validation";

/** A single paginated home row, using the same fixed collection whitelist. */
export async function GET(request: Request) {
  return runMobileEndpoint(request, {
    parse: parseListParams,
    cacheKey: listCacheKey,
    ttlSeconds: MOBILE_CACHE_TTL.list,
    rateLimitCost: 1,
    load: getMobileList,
  });
}

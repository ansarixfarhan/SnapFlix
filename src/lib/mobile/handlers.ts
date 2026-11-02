import {
  getMobileDiscover,
  getMobileFind,
  getMobileGenres,
  getMobileHome,
} from "./catalog";
import { MOBILE_CACHE_TTL } from "./constants";
import { runMobileEndpoint } from "./http";
import {
  discoverCacheKey,
  findCacheKey,
  genresCacheKey,
  homeCacheKey,
  parseDiscoverParams,
  parseFindParams,
  parseGenresParams,
  parseHomeParams,
} from "./validation";

export function handleHome(request: Request): Promise<Response> {
  return runMobileEndpoint(request, {
    parse: parseHomeParams,
    cacheKey: homeCacheKey,
    ttlSeconds: (data) =>
      data.partial ? MOBILE_CACHE_TTL.partialHome : MOBILE_CACHE_TTL.home,
    rateLimitCost: 2,
    load: getMobileHome,
  });
}

export function handleDiscover(request: Request): Promise<Response> {
  return runMobileEndpoint(request, {
    parse: parseDiscoverParams,
    cacheKey: discoverCacheKey,
    ttlSeconds: MOBILE_CACHE_TTL.discover,
    rateLimitCost: 1,
    load: getMobileDiscover,
  });
}

export function handleGenres(request: Request): Promise<Response> {
  return runMobileEndpoint(request, {
    parse: parseGenresParams,
    cacheKey: genresCacheKey,
    ttlSeconds: MOBILE_CACHE_TTL.genres,
    rateLimitCost: 1,
    load: getMobileGenres,
  });
}

export function handleFind(request: Request, pathImdbId?: string): Promise<Response> {
  return runMobileEndpoint(request, {
    parse: (params) => parseFindParams(params, pathImdbId),
    cacheKey: findCacheKey,
    ttlSeconds: MOBILE_CACHE_TTL.find,
    rateLimitCost: 1,
    load: getMobileFind,
  });
}

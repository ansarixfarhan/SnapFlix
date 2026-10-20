import {
  searchProvider,
  getProviderMeta,
  getProviderStream,
  getProviderEpisodes,
} from './providerEngine';
import type { Stream, Info } from './types';

export interface ProviderDefinition {
  value: string;
  name: string;
  type?: 'global' | 'india' | 'english' | 'anime';
}

export const ACTIVE_PROVIDERS: ProviderDefinition[] = [
  // Primary Fast Global Providers
  { value: 'autoEmbed', name: 'MultiStream', type: 'global' },
  { value: 'castle', name: 'Castle TV', type: 'global' },
  { value: 'movieBoxWeb', name: 'MovieBox Web', type: 'global' },
  { value: '4khdhub', name: '4khdHub', type: 'global' },
  { value: 'vega', name: 'VMovies', type: 'global' },
  { value: 'drive', name: 'MoviesDrive', type: 'global' },
  { value: 'uhd', name: 'UHDMovies', type: 'global' },
  { value: 'mod', name: 'MoviesMod', type: 'global' },
  { value: 'katmovies', name: 'KatMoviesHd', type: 'global' },
  { value: 'world4u', name: 'World4uFree', type: 'global' },
  { value: 'hdhub4u', name: 'HdHub4u', type: 'global' },
  { value: 'kmMovies', name: 'KmMovies', type: 'global' },
  { value: 'topmovies', name: 'TopMovies', type: 'india' },
  { value: '1cinevood', name: 'Cinewood', type: 'global' },
  { value: 'zeefliz', name: 'Zeefliz', type: 'global' },
  { value: 'eonMovies', name: 'EonMovies', type: 'global' },
  { value: 'movies4u', name: 'Movies4U', type: 'global' },
  { value: 'everything', name: 'Everything', type: 'global' },

  // English & Drama
  { value: 'showbox', name: 'ShowBox', type: 'english' },
  { value: 'kissKh', name: 'KissKh', type: 'english' },
  { value: 'dramacool', name: 'DramaCool', type: 'global' },

  // Regional & Indian
  { value: 'luxMovies', name: 'RogMovies', type: 'india' },
  { value: 'moviezwap', name: 'MoviezWap', type: 'india' },
  { value: 'movielinkdb', name: 'MovieLinkBD', type: 'india' },
  { value: 'mxplayer', name: 'MX Player', type: 'india' },

  // Anime
  { value: 'anikoto', name: 'Anikoto', type: 'anime' },
  { value: 'kickAssAnime', name: 'KickAssAnime', type: 'anime' },
  { value: 'animesub', name: 'AnimeSub+', type: 'anime' },
  { value: 'animesalt', name: 'AnimeSalt', type: 'anime' },
  { value: 'animeworld', name: 'AnimeWorld', type: 'anime' },
  { value: 'kartoons', name: 'Kartoons', type: 'anime' },
];

function normalizeTitle(title?: string | null): string {
  if (!title) return '';
  return title
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractYear(val?: number | string | null): number | undefined {
  if (!val) return undefined;
  const match = String(val).match(/\b(19\d{2}|20\d{2})\b/);
  return match ? parseInt(match[1], 10) : undefined;
}

export const seasonNumberFromTitle = (title?: string | null): number | undefined => {
  const match = String(title || '').match(/season\s*(\d+)|s\s*(\d+)/i);
  if (!match) return undefined;
  const value = Number(match[1] || match[2]);
  return Number.isFinite(value) ? value : undefined;
};

export const episodeNumberFromTitle = (title?: string | null): number | undefined => {
  const value = String(title || '');
  const seasonEpisode = value.match(/s\s*\d+\s*e\s*(\d+)/i) || value.match(/\d+\s*x\s*(\d+)/i);
  if (seasonEpisode) {
    return Number(seasonEpisode[1]);
  }
  const episode = value.match(/\be\s*(\d+)\b/i) || value.match(/episode\s*(\d+)/i) || value.match(/\bep\s*(\d+)\b/i);
  return episode ? Number(episode[1]) : undefined;
};

export function scoreTitleMatch({
  candidateTitle,
  targetTitle,
  candidateYear,
  targetYear,
  isTvSeries = false,
}: {
  candidateTitle?: string;
  targetTitle: string;
  candidateYear?: number | string;
  targetYear?: number | string;
  isTvSeries?: boolean;
}): number {
  const candidate = normalizeTitle(candidateTitle);
  const target = normalizeTitle(targetTitle);
  if (!candidate || !target) return 0;

  let score = 0;
  if (candidate === target) {
    score = 100;
  } else if (candidate.startsWith(target + ' ')) {
    score = 85;
  } else if (candidate.includes(target)) {
    score = 75;
  } else {
    // All significant target tokens (length > 2, excluding common filler words) MUST be present in candidate
    const stopWords = new Set(['the', 'and', 'for', 'with', 'from', 'part', 'vol', 'edition']);
    const targetTokens = target.split(' ').filter(token => token.length > 2 && !stopWords.has(token));
    const candidateTokens = new Set(candidate.split(' ').filter(Boolean));

    const missingTokens = targetTokens.filter(token => !candidateTokens.has(token));
    if (missingTokens.length > 0) {
      // Missing a key word (e.g. "Titan" missing from "Attack on Titan") -> reject completely!
      return 0;
    }

    score = 60;
  }

  const cYear = extractYear(candidateYear);
  const tYear = extractYear(targetYear);
  if (cYear && tYear) {
    const diff = Math.abs(cYear - tYear);
    if (diff === 0) {
      score += 25;
    } else if (diff <= 1) {
      score += 10;
    } else if (!isTvSeries) {
      // Don't heavily penalize TV series where title year is Season 4/5
      score -= 30;
    }
  }

  return Math.max(0, score);
}

export interface ResolveStreamParams {
  tmdbId?: number | string;
  imdbId?: string;
  title: string;
  year?: number | string;
  type?: 'movie' | 'tv' | 'anime';
  season?: number;
  episode?: number;
}

export interface ResolvedProviderResult {
  providerValue: string;
  providerName: string;
  streams: Stream[];
  infoTitle?: string;
}

// 12-second timeout per provider to allow deep scrapers (MultiStream, 4khdHub, Castle) to complete
const PROVIDER_TIMEOUT_MS = 12000;

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T, name: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) =>
      setTimeout(() => {
        console.warn(`[Provider] ${name} TIMED OUT after ${ms}ms`);
        resolve(fallback);
      }, ms)
    ),
  ]);
}

export async function resolveStreamAcrossProviders({
  tmdbId,
  imdbId,
  title,
  year,
  type = 'movie',
  season,
  episode,
}: ResolveStreamParams): Promise<ResolvedProviderResult[]> {
  const cleanTitle = title.trim();
  if (!cleanTitle && !tmdbId) return [];

  // 1. Direct Ultra-Fast Path (MultiStream autoEmbed via TMDB ID)
  if (tmdbId) {
    try {
      const payload = JSON.stringify({
        tmdbId: String(tmdbId),
        imdbId: imdbId || undefined,
        type: type === 'tv' ? 'series' : 'movie',
        season: season || 1,
        episode: episode || 1,
        title: cleanTitle,
        year: year ? String(year) : undefined,
      });
      const directStreams = await getProviderStream({
        providerValue: 'autoEmbed',
        link: payload,
        type,
      });
      if (directStreams && directStreams.length > 0) {
        console.log(`[Provider] MultiStream (Direct TMDB) SUCCESS (${directStreams.length} streams)`);
        return [
          {
            providerValue: 'autoEmbed',
            providerName: 'MultiStream',
            streams: directStreams,
            infoTitle: cleanTitle,
          },
        ];
      }
    } catch (err) {
      console.warn(`[Provider] MultiStream direct resolution attempt failed:`, err);
    }
  }

  // 2. Select targeted batch of up to 4-5 relevant providers to stay within Cloudflare CPU & subrequest limits
  const targetProviders = ACTIVE_PROVIDERS.filter(provider => {
    if (provider.value === 'autoEmbed') return false; // already checked
    if (type === 'anime') {
      return provider.type === 'anime';
    }
    return provider.type !== 'anime';
  }).slice(0, 5); // limit to top 5 providers per request

  // Search/resolve fallback providers in parallel with timeout
  const searchPromises = targetProviders.map(provider => {
    return withTimeout(
      (async () => {
        const t0 = Date.now();
        try {
          // 1. Search provider
          const posts = await searchProvider({
            providerValue: provider.value,
            query: cleanTitle,
          });

          if (!posts || posts.length === 0) return null;

          // 2. Score candidates
          const isTvSeries = type === 'tv';
          const scored = posts
            .map(post => {
              let score = scoreTitleMatch({
                candidateTitle: post.title,
                targetTitle: cleanTitle,
                candidateYear: post.year || post.title,
                targetYear: year,
                isTvSeries,
              });

              const isSeries =
                post.type === 'series' ||
                post.type === 'tv' ||
                (typeof post.link === 'string' && post.link.includes('/series/')) ||
                (typeof post.link === 'string' && post.link.includes('Drama'));

              if (type === 'movie' && isSeries) score -= 45;
              if (type === 'tv' && !isSeries && (post.type === 'movie' || (typeof post.link === 'string' && post.link.includes('/movie/')))) {
                score -= 45;
              }

              return { post, score };
            })
            .filter(item => item.score >= 45)
            .sort((a, b) => b.score - a.score);

          if (scored.length === 0) return null;

          const bestPost = scored[0].post;

          // 3. Fetch meta for best post
          const meta = await getProviderMeta({
            providerValue: provider.value,
            link: bestPost.link,
          });

          if (!meta || !meta.linkList || meta.linkList.length === 0) return null;

          // Reject mismatch between Movie and TV series:
          if (type === 'tv' && meta.type === 'movie') {
            console.log(`[Provider] ${provider.name} rejected: requested TV series, but got standalone movie "${meta.title}"`);
            return null;
          }
          if (type === 'movie' && meta.type === 'series') {
            console.log(`[Provider] ${provider.name} rejected: requested movie, but got series "${meta.title}"`);
            return null;
          }

          // 4. Find relevant direct link
          let targetLink: string | undefined;

          if (type === 'movie' || season === undefined) {
            // Movies
            targetLink = meta.linkList[0]?.directLinks?.[0]?.link || meta.linkList[0]?.episodesLink;
          } else {
            // TV Series: match season and episode strictly
            const seasonEntry = meta.linkList.find(link => {
              const sNum = seasonNumberFromTitle(link.title);
              return sNum !== undefined ? sNum === season : false;
            }) || meta.linkList.find(
              link => link.title?.toLowerCase().includes(`season ${season}`) ||
                      link.title?.toLowerCase().includes(`s0${season}`) ||
                      link.title?.toLowerCase().includes(`s${season}`)
            );

            // If requested season is not available on this provider, do not pretend another season is it!
            if (!seasonEntry) {
              console.log(`[Provider] ${provider.name} rejected: Season ${season} not found in "${meta.title}"`);
              return null;
            }

            if (seasonEntry?.directLinks?.length) {
              const epMatch = seasonEntry.directLinks.find(d => {
                const epNum = episodeNumberFromTitle(d.title);
                return epNum !== undefined ? epNum === episode : false;
              }) || seasonEntry.directLinks.find(
                d => d.title?.toLowerCase().includes(`episode ${episode}`) ||
                     d.title?.toLowerCase().includes(`ep ${episode}`) ||
                     d.title?.toLowerCase().includes(`e${episode}`)
              );
              if (!epMatch) {
                console.log(`[Provider] ${provider.name} rejected: Episode ${episode} not found in Season ${season}`);
                return null;
              }
              targetLink = epMatch.link;
            } else if (seasonEntry?.episodesLink) {
              const episodes = await getProviderEpisodes({
                providerValue: provider.value,
                url: seasonEntry.episodesLink,
              });
              const epMatch = episodes.find(e => {
                const epNum = episodeNumberFromTitle(e.title);
                return epNum !== undefined ? epNum === episode : false;
              }) || episodes.find(
                e => e.title?.toLowerCase().includes(`episode ${episode}`) ||
                     e.title?.toLowerCase().includes(`ep ${episode}`) ||
                     e.title?.toLowerCase().includes(`e${episode}`)
              );
              if (!epMatch) {
                console.log(`[Provider] ${provider.name} rejected: Episode ${episode} not found via episodesLink`);
                return null;
              }
              targetLink = epMatch.link;
            }
          }

          if (!targetLink) return null;

          // 5. Resolve streams
          const streams = await getProviderStream({
            providerValue: provider.value,
            link: targetLink,
            type,
          });

          if (!streams || streams.length === 0) {
            console.log(`[Provider] ${provider.name} finished in ${Date.now() - t0}ms (no streams)`);
            return null;
          }

          console.log(`[Provider] ${provider.name} SUCCESS in ${Date.now() - t0}ms (${streams.length} streams)`);
          return {
            providerValue: provider.value,
            providerName: provider.name,
            streams,
            infoTitle: meta.title,
          };
        } catch (e) {
          console.warn(`[Provider] ${provider.name} FAILED in ${Date.now() - t0}ms:`, e);
          return null;
        }
      })(),
      PROVIDER_TIMEOUT_MS,
      null,
      provider.name
    );
  });

  const results = await Promise.all(searchPromises);
  const valid: ResolvedProviderResult[] = [];
  for (const res of results) {
    if (res && res.streams.length > 0) {
      valid.push(res);
    }
  }
  return valid;
}

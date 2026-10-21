import { NextRequest, NextResponse } from 'next/server';
import { resolveStreamAcrossProviders } from '@/lib/providers/providerMatch';
import { tmdb } from '@/api/tmdb';

const resolveCache = new Map<
  string,
  {
    data: any;
    expiresAt: number;
  }
>();

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tmdbId = searchParams.get('tmdbId');
  let title = searchParams.get('title') || '';
  let year = searchParams.get('year') || '';
  const type = (searchParams.get('type') || 'movie') as 'movie' | 'tv';
  const season = searchParams.get('season') ? Number(searchParams.get('season')) : undefined;
  const episode = searchParams.get('episode') ? Number(searchParams.get('episode')) : undefined;

  const isPlaceholder =
    !title ||
    title.trim().toLowerCase() === 'movie' ||
    title.trim().toLowerCase() === 'tv series';

  // If tmdbId is provided, resolve title and year from TMDB if not supplied or if placeholder was passed
  if (tmdbId && (isPlaceholder || !year)) {
    let resolvedTitle = '';
    let resolvedYear = '';

    // 1. Try official TMDB library first
    try {
      if (type === 'movie') {
        const details = await tmdb.movies.details(Number(tmdbId));
        if (details) {
          resolvedTitle = details.title || details.original_title || '';
          resolvedYear = details.release_date ? details.release_date.split('-')[0] : '';
        }
      } else {
        const details = await tmdb.tvShows.details(Number(tmdbId));
        if (details) {
          resolvedTitle = details.name || details.original_name || '';
          resolvedYear = details.first_air_date ? details.first_air_date.split('-')[0] : '';
        }
      }
    } catch (e) {
      console.warn('[Resolve API] TMDB library fetch failed, trying mirror:', e);
    }

    // 2. Fallback to resilient TMDB mirror if library failed or ISP blocked
    if (!resolvedTitle) {
      try {
        const endpoint = `https://db.wecollege.net/3/${type === 'tv' ? 'tv' : 'movie'}/${tmdbId}`;
        const res = await fetch(endpoint, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            Origin: 'https://www.movy.sx',
            Referer: 'https://www.movy.sx/',
          },
        });
        if (res.ok) {
          const d: any = await res.json();
          resolvedTitle = d.title || d.name || d.original_title || d.original_name || '';
          const dDate = d.release_date || d.first_air_date || '';
          resolvedYear = dDate ? dDate.split('-')[0] : '';
        }
      } catch (mirrorErr) {
        console.warn('[Resolve API] TMDB mirror fallback failed:', mirrorErr);
      }
    }

    if (resolvedTitle) title = resolvedTitle;
    if (resolvedYear) year = resolvedYear;
  }

  if (!title) {
    return NextResponse.json(
      { success: false, message: 'Missing title or tmdbId parameter' },
      { status: 400 }
    );
  }

  const refresh = searchParams.get('refresh') === 'true';
  const cacheKey = `${tmdbId || ''}_${title.toLowerCase().trim()}_${year}_${type}_${season || 0}_${episode || 0}`;
  const cached = resolveCache.get(cacheKey);
  if (!refresh && cached && Date.now() < cached.expiresAt) {
    return NextResponse.json(
      { ...cached.data, cached: true },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200',
        },
      }
    );
  }

  try {
    const results = await resolveStreamAcrossProviders({
      tmdbId: tmdbId ? Number(tmdbId) : undefined,
      title,
      year,
      type,
      season,
      episode,
    });

    const responsePayload = {
      success: true,
      media: { title, year, type, season, episode },
      providersCount: results.length,
      results,
    };

    if (results.length > 0) {
      // Cache valid stream results for 1 hour
      resolveCache.set(cacheKey, {
        data: responsePayload,
        expiresAt: Date.now() + 60 * 60 * 1000,
      });
    }

    return NextResponse.json(responsePayload, {
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': '*',
      },
    });
  } catch (error: any) {
    console.error('[Resolve API] Internal error:', error);
    return NextResponse.json(
      { success: false, message: error?.message || 'Resolution failed' },
      {
        status: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': '*',
        },
      }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': '*',
    },
  });
}

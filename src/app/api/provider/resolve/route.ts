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

  // If tmdbId is provided, resolve title and year from TMDB if not supplied
  if (tmdbId && (!title || !year)) {
    try {
      if (type === 'movie') {
        const details = await tmdb.movies.details(Number(tmdbId));
        if (details) {
          title = details.title || details.original_title || title;
          year = details.release_date ? details.release_date.split('-')[0] : year;
        }
      } else {
        const details = await tmdb.tvShows.details(Number(tmdbId));
        if (details) {
          title = details.name || details.original_name || title;
          year = details.first_air_date ? details.first_air_date.split('-')[0] : year;
        }
      }
    } catch (e) {
      console.warn('[Resolve API] TMDB details fetch failed:', e);
    }
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
      },
    });
  } catch (error: any) {
    console.error('[Resolve API] Internal error:', error);
    return NextResponse.json(
      { success: false, message: error?.message || 'Resolution failed' },
      { status: 500 }
    );
  }
}

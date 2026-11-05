import { NextRequest, NextResponse } from 'next/server';

const PRIMARY_BACKEND = (process.env.NEXT_PUBLIC_BACKEND_URL || 'https://vidly.snapflix.indevs.in').replace(/\/$/, '');
const VIDBOLT_BACKEND = (process.env.NEXT_PUBLIC_VIDBOLT_URL || 'https://vidbolt.snapflix.indevs.in').replace(/\/$/, '');
const CINEVERSE_BACKEND = (process.env.NEXT_PUBLIC_CINEVERSE_URL || 'https://cineverse.snapflix.indevs.in').replace(/\/$/, '');
const SECONDARY_BACKEND = (process.env.NEXT_PUBLIC_BACKEND_URL_TIER2 || 'https://vidy.snapflix.indevs.in').replace(/\/$/, '');

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  try {
    const [primarySettled, vidboltSettled, cineverseSettled, secondarySettled] = await Promise.allSettled([
      fetch(`${PRIMARY_BACKEND}/api/provider/resolve?${searchParams.toString()}`, {
        headers: { Accept: 'application/json' },
      }).then(async (r) => (r.ok ? r.json() : null)),
      fetch(`${VIDBOLT_BACKEND}/api/provider/resolve?${searchParams.toString()}`, {
        headers: { Accept: 'application/json' },
      }).then(async (r) => (r.ok ? r.json() : null)),
      fetch(`${CINEVERSE_BACKEND}/api/provider/resolve?${searchParams.toString()}`, {
        headers: { Accept: 'application/json' },
      }).then(async (r) => (r.ok ? r.json() : null)),
      fetch(`${SECONDARY_BACKEND}/api/provider/resolve?${searchParams.toString()}`, {
        headers: { Accept: 'application/json' },
      }).then(async (r) => (r.ok ? r.json() : null)),
    ]);

    const primaryData = primarySettled.status === 'fulfilled' ? primarySettled.value : null;
    const vidboltData = vidboltSettled.status === 'fulfilled' ? vidboltSettled.value : null;
    const cineverseData = cineverseSettled.status === 'fulfilled' ? cineverseSettled.value : null;
    const secondaryData = secondarySettled.status === 'fulfilled' ? secondarySettled.value : null;

    const combinedResults = [
      ...(primaryData?.results || []),
      ...(vidboltData?.results || []),
      ...(cineverseData?.results || []),
      ...(secondaryData?.results || []),
    ];
    const combinedStreams = [
      ...(primaryData?.streams || []),
      ...(vidboltData?.streams || []),
      ...(cineverseData?.streams || []),
      ...(secondaryData?.streams || []),
    ];

    if (combinedResults.length > 0) {
      return NextResponse.json(
        {
          success: true,
          query: primaryData?.query || vidboltData?.query || cineverseData?.query || secondaryData?.query || {},
          media: primaryData?.media || vidboltData?.media || cineverseData?.media || secondaryData?.media || {},
          tier: 'hybrid-4tier',
          providersResponded: [
            ...(primaryData?.providersResponded || []),
            ...(vidboltData?.providersResponded || []),
            ...(cineverseData?.providersResponded || []),
            ...(secondaryData?.providersResponded || []),
          ],
          totalStreams: combinedStreams.length,
          streams: combinedStreams,
          results: combinedResults,
        },
        {
          status: 200,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': '*',
          },
        }
      );
    }

    return NextResponse.json(
      {
        success: false,
        message: 'No streams available from active providers.',
      },
      {
        status: 404,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': '*',
        },
      }
    );
  } catch (error: any) {
    console.error('[SnapFlix-Web API/Resolve Hybrid Proxy Error]:', error);
    return NextResponse.json(
      {
        success: false,
        message: error?.message || 'Failed to reach SnapFlix stream providers',
      },
      {
        status: 502,
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

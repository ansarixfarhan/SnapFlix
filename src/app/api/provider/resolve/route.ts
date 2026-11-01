import { NextRequest, NextResponse } from 'next/server';

const PRIMARY_BACKEND = (process.env.NEXT_PUBLIC_BACKEND_URL || 'https://vidly.snapflix.indevs.in').replace(/\/$/, '');
const SECONDARY_BACKEND = (process.env.NEXT_PUBLIC_BACKEND_URL_TIER2 || 'https://vidy.snapflix.indevs.in').replace(/\/$/, '');

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  try {
    const [primarySettled, secondarySettled] = await Promise.allSettled([
      fetch(`${PRIMARY_BACKEND}/api/provider/resolve?${searchParams.toString()}`, {
        headers: { Accept: 'application/json' },
      }).then(async (r) => (r.ok ? r.json() : null)),
      fetch(`${SECONDARY_BACKEND}/api/provider/resolve?${searchParams.toString()}`, {
        headers: { Accept: 'application/json' },
      }).then(async (r) => (r.ok ? r.json() : null)),
    ]);

    const primaryData = primarySettled.status === 'fulfilled' ? primarySettled.value : null;
    const secondaryData = secondarySettled.status === 'fulfilled' ? secondarySettled.value : null;

    const combinedResults = [
      ...(primaryData?.results || []),
      ...(secondaryData?.results || []),
    ];
    const combinedStreams = [
      ...(primaryData?.streams || []),
      ...(secondaryData?.streams || []),
    ];

    if (combinedResults.length > 0) {
      return NextResponse.json(
        {
          success: true,
          query: primaryData?.query || secondaryData?.query || {},
          media: primaryData?.media || secondaryData?.media || {},
          tier: 'hybrid',
          providersResponded: [
            ...(primaryData?.providersResponded || []),
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

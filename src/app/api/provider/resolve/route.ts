import { NextRequest, NextResponse } from 'next/server';

const PRIMARY_BACKEND = (process.env.NEXT_PUBLIC_BACKEND_URL || 'https://api.snapflix.indevs.in').replace(/\/$/, '');
const SECONDARY_BACKEND = (process.env.NEXT_PUBLIC_BACKEND_URL_TIER2 || 'https://api1.snapflix.indevs.in').replace(/\/$/, '');

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  // 1. Try Primary Backend (Cloudflare Worker - SnapFlix Edge)
  try {
    const primaryUrl = `${PRIMARY_BACKEND}/api/provider/resolve?${searchParams.toString()}`;
    const primaryRes = await fetch(primaryUrl, {
      headers: { Accept: 'application/json' },
    });

    if (primaryRes.ok) {
      const primaryData = await primaryRes.json();
      if (primaryData.success && Array.isArray(primaryData.results) && primaryData.results.length > 0) {
        return NextResponse.json(primaryData, {
          status: 200,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': '*',
          },
        });
      }
    }
  } catch (err) {
    console.warn('[SnapFlix-Web Proxy] Primary backend failed, trying secondary...', err);
  }

  // 2. Fallback to Secondary Backend (Oracle VPS - SnapFlix Vidy Multi-Audio)
  try {
    const secondaryUrl = `${SECONDARY_BACKEND}/api/provider/resolve?${searchParams.toString()}`;
    const secondaryRes = await fetch(secondaryUrl, {
      headers: { Accept: 'application/json' },
    });

    const secData = await secondaryRes.json();
    return NextResponse.json(secData, {
      status: secondaryRes.status,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': '*',
      },
    });
  } catch (error: any) {
    console.error('[SnapFlix-Web API/Resolve Proxy Error]:', error);
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

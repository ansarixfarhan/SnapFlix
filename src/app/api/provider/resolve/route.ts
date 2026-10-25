import { NextRequest, NextResponse } from 'next/server';

const BACKEND_BASE = (process.env.NEXT_PUBLIC_BACKEND_URL || 'https://api.snapflix.indevs.in').replace(/\/$/, '');

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  try {
    const targetUrl = `${BACKEND_BASE}/api/provider/resolve?${searchParams.toString()}`;
    const res = await fetch(targetUrl, {
      headers: {
        'Accept': 'application/json',
      },
    });

    const data = await res.json();
    return NextResponse.json(data, {
      status: res.status,
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
        message: error?.message || 'Failed to reach SnapFlix-API backend',
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

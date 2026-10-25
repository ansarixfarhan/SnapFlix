import { NextRequest, NextResponse } from 'next/server';

const BACKEND_BASE = (process.env.NEXT_PUBLIC_BACKEND_URL || 'https://api.snapflix.indevs.in').replace(/\/$/, '');

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const targetBackendUrl = `${BACKEND_BASE}/api/provider/proxy-stream?${searchParams.toString()}`;

  // Redirect client directly to the high-performance backend proxy
  return NextResponse.redirect(targetBackendUrl, 307);
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': '*',
    },
  });
}

import { NextRequest, NextResponse } from 'next/server';
import zlib from 'zlib';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get('url');

  if (!url) {
    return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });
  }

  try {
    const res = await fetch(url, {
      headers: {
        'x-user-agent': 'VLSub 0.10.2',
        'User-Agent': 'VLSub 0.10.2',
      },
    });

    if (!res.ok) {
      return NextResponse.json({ error: `Fetch failed: ${res.status}` }, { status: res.status });
    }

    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    let text = '';
    // Check if gzipped (magic bytes 0x1f 0x8b)
    if (buffer.length > 2 && buffer[0] === 0x1f && buffer[1] === 0x8b) {
      text = zlib.gunzipSync(buffer).toString('utf-8');
    } else {
      text = buffer.toString('utf-8');
    }

    // Convert SRT to WebVTT if needed
    if (!text.startsWith('WEBVTT')) {
      text = 'WEBVTT\n\n' + text
        .replace(/\r\n|\r/g, '\n')
        .replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2');
    }

    return new NextResponse(text, {
      status: 200,
      headers: {
        'Content-Type': 'text/vtt; charset=utf-8',
        'Cache-Control': 'public, max-age=86400, s-maxage=86400',
      },
    });
  } catch (err: any) {
    console.error('[Subtitle Download] Error:', err);
    return NextResponse.json({ error: err?.message || 'Download failed' }, { status: 500 });
  }
}

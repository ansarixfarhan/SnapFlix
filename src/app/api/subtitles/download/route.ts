import { NextRequest, NextResponse } from 'next/server';
import zlib from 'zlib';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get('url');
  const headersParam = searchParams.get('headers');

  if (!url) {
    return NextResponse.json(
      { error: 'Missing url parameter' },
      {
        status: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
        },
      }
    );
  }

  try {
    let customHeaders: Record<string, string> = {};
    if (headersParam) {
      try {
        customHeaders = JSON.parse(headersParam);
      } catch (e) {
        console.warn('[Subtitle Download] Failed to parse custom headers:', e);
      }
    }

    const isOs = url.includes('opensubtitles.org');
    const fetchHeaders: Record<string, string> = {
      'User-Agent': isOs
        ? 'VLSub 0.10.2'
        : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      Accept: '*/*',
      ...customHeaders,
    };
    if (isOs) {
      fetchHeaders['x-user-agent'] = 'VLSub 0.10.2';
    }

    const res = await fetch(url, {
      headers: fetchHeaders,
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `Fetch failed: ${res.status}` },
        {
          status: res.status,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
          },
        }
      );
    }

    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    let text = '';
    // Check if gzipped (magic bytes 0x1f 0x8b)
    if (buffer.length > 2 && buffer[0] === 0x1f && buffer[1] === 0x8b) {
      try {
        text = zlib.gunzipSync(buffer).toString('utf-8');
      } catch (gzErr) {
        text = buffer.toString('utf-8');
      }
    } else {
      text = buffer.toString('utf-8');
    }

    // Strip UTF-8 BOM if present
    if (text.charCodeAt(0) === 0xfeff) {
      text = text.slice(1);
    }
    text = text.trim();

    // Convert SRT to WebVTT if not already WEBVTT
    if (!text.startsWith('WEBVTT')) {
      text =
        'WEBVTT\n\n' +
        text
          .replace(/\r\n|\r/g, '\n')
          .replace(/(\d{1,2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2');
    }

    // Elevate cue positions so subtitles do not touch the extreme bottom edge or get obscured
    text = text.replace(
      /((?:\d{1,2}:)?\d{2}:\d{2}\.\d{3}\s+-->\s+(?:\d{1,2}:)?\d{2}:\d{2}\.\d{3})([^\r\n]*)/g,
      (_match, timing, settings) => {
        const s = (settings || '').trim();
        if (!s.includes('line:')) {
          return `${timing} ${s ? s + ' ' : ''}line:89%`.trim();
        }
        return `${timing} ${s}`.trim();
      }
    );

    return new NextResponse(text, {
      status: 200,
      headers: {
        'Content-Type': 'text/vtt; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Cache-Control': 'public, max-age=86400, s-maxage=86400',
      },
    });
  } catch (err: any) {
    console.error('[Subtitle Download] Error:', err);
    return NextResponse.json(
      { error: err?.message || 'Download failed' },
      {
        status: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
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

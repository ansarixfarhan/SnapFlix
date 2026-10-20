import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const targetUrl = searchParams.get('url');
  const headersParam = searchParams.get('headers');

  if (!targetUrl) {
    return new NextResponse('Missing url parameter', { status: 400 });
  }

  let customHeaders: Record<string, string> = {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
  };

  if (headersParam) {
    try {
      const parsed = JSON.parse(headersParam);
      customHeaders = { ...customHeaders, ...parsed };
    } catch {}
  }

  const clientRange = request.headers.get('range');
  if (clientRange) {
    customHeaders['Range'] = clientRange;
  }

  try {
    const upstreamRes = await fetch(targetUrl, {
      headers: customHeaders,
    });

    if (!upstreamRes.ok && upstreamRes.status !== 206) {
      return new NextResponse(`Upstream error: ${upstreamRes.status} ${upstreamRes.statusText}`, {
        status: upstreamRes.status,
      });
    }

    const contentType = upstreamRes.headers.get('content-type') || '';
    const isM3u8 =
      targetUrl.includes('.m3u8') ||
      contentType.includes('mpegurl') ||
      contentType.includes('application/x-mpegURL');

    if (isM3u8) {
      const manifestText = await upstreamRes.text();
      const baseUrl = new URL(targetUrl);

      // Rewrite manifest URLs to route through proxy-stream
      const rewrittenLines = manifestText.split('\n').map((line) => {
        const trimmed = line.trim();
        if (!trimmed) return line;

        // Attribute URIs like URI="..."
        if (trimmed.startsWith('#') && trimmed.includes('URI=')) {
          return trimmed.replace(/URI="([^"]+)"/g, (match, uri) => {
            const resolved = new URL(uri, baseUrl).toString();
            const proxied = `/api/provider/proxy-stream?url=${encodeURIComponent(
              resolved
            )}&headers=${encodeURIComponent(JSON.stringify(customHeaders))}`;
            return `URI="${proxied}"`;
          });
        }

        // Segment or child playlist URLs
        if (!trimmed.startsWith('#')) {
          const resolved = new URL(trimmed, baseUrl).toString();
          return `/api/provider/proxy-stream?url=${encodeURIComponent(
            resolved
          )}&headers=${encodeURIComponent(JSON.stringify(customHeaders))}`;
        }

        return line;
      });

      return new NextResponse(rewrittenLines.join('\n'), {
        headers: {
          'Content-Type': 'application/vnd.apple.mpegurl',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
          'Access-Control-Allow-Headers': '*',
          'Cache-Control': 'no-cache',
        },
      });
    }

    // Binary stream (e.g. video/mp2t TS segment or mp4 video)
    const responseHeaders: Record<string, string> = {
      'Content-Type': contentType || 'video/mp2t',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': '*',
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'public, max-age=86400',
    };

    const contentRange = upstreamRes.headers.get('content-range');
    if (contentRange) responseHeaders['Content-Range'] = contentRange;

    const contentLength = upstreamRes.headers.get('content-length');
    if (contentLength) responseHeaders['Content-Length'] = contentLength;

    return new NextResponse(upstreamRes.body, {
      status: upstreamRes.status,
      headers: responseHeaders,
    });
  } catch (e: any) {
    console.error('[ProxyStream Error]', e);
    return new NextResponse(e?.message || 'Proxy error', { status: 500 });
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

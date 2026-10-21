import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
  'Access-Control-Allow-Headers': '*',
};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const targetUrl = searchParams.get('url');
  const headersParam = searchParams.get('headers');

  if (!targetUrl) {
    return new NextResponse('Missing url parameter', {
      status: 400,
      headers: CORS_HEADERS,
    });
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

  // Derive public origin, avoiding 0.0.0.0:10000 on hosting platforms like Render
  const host =
    request.headers.get('x-forwarded-host') ||
    request.headers.get('host') ||
    'api.snapflix.indevs.in';
  const proto = request.headers.get('x-forwarded-proto') || 'https';
  const cleanHost = (host.includes('0.0.0.0') || host.includes('localhost'))
    ? 'api.snapflix.indevs.in'
    : host;
  const requestOrigin = `${proto}://${cleanHost}`;

  const isLikelyM3u8 =
    targetUrl.includes('.m3u8') ||
    targetUrl.includes('playlist') ||
    targetUrl.includes('/hls/');

  try {
    const upstreamRes = await axios.get(targetUrl, {
      headers: customHeaders,
      responseType: isLikelyM3u8 ? 'text' : 'arraybuffer',
      validateStatus: () => true,
      timeout: 20000,
      maxRedirects: 5,
      beforeRedirect: (options: any) => {
        if (!options.headers) options.headers = {};
        if (customHeaders['Referer']) options.headers['Referer'] = customHeaders['Referer'];
        if (customHeaders['Origin']) options.headers['Origin'] = customHeaders['Origin'];
        if (customHeaders['User-Agent']) options.headers['User-Agent'] = customHeaders['User-Agent'];
      },
    });

    if (upstreamRes.status >= 400 && upstreamRes.status !== 206) {
      return new NextResponse(`Upstream error: ${upstreamRes.status} ${upstreamRes.statusText}`, {
        status: upstreamRes.status,
        headers: CORS_HEADERS,
      });
    }

    const contentType = String(upstreamRes.headers['content-type'] || '');
    const isM3u8 =
      isLikelyM3u8 ||
      contentType.includes('mpegurl') ||
      contentType.includes('application/x-mpegURL');

    if (isM3u8 && typeof upstreamRes.data === 'string') {
      const manifestText = upstreamRes.data;
      const baseUrl = new URL(targetUrl);

      // Rewrite manifest URLs to route through proxy-stream
      const rewrittenLines = manifestText.split('\n').map((line: string) => {
        const trimmed = line.trim();
        if (!trimmed) return line;

        // Attribute URIs like URI="..."
        if (trimmed.startsWith('#') && trimmed.includes('URI=')) {
          return trimmed.replace(/URI="([^"]+)"/g, (_match, uri) => {
            const resolved = new URL(uri, baseUrl).toString();
            const proxied = `${requestOrigin}/api/provider/proxy-stream?url=${encodeURIComponent(
              resolved
            )}&headers=${encodeURIComponent(JSON.stringify(customHeaders))}`;
            return `URI="${proxied}"`;
          });
        }

        // Segment or child playlist URLs
        if (!trimmed.startsWith('#')) {
          const resolved = new URL(trimmed, baseUrl).toString();
          return `${requestOrigin}/api/provider/proxy-stream?url=${encodeURIComponent(
            resolved
          )}&headers=${encodeURIComponent(JSON.stringify(customHeaders))}`;
        }

        return line;
      });

      return new NextResponse(rewrittenLines.join('\n'), {
        status: upstreamRes.status,
        headers: {
          'Content-Type': 'application/vnd.apple.mpegurl',
          ...CORS_HEADERS,
          'Cache-Control': 'no-cache',
        },
      });
    }

    // Binary stream (e.g. video/mp2t TS segment or mp4 video or image)
    const responseHeaders: Record<string, string> = {
      'Content-Type': contentType || 'video/mp2t',
      ...CORS_HEADERS,
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'public, max-age=86400',
    };

    if (upstreamRes.headers['content-range']) {
      responseHeaders['Content-Range'] = String(upstreamRes.headers['content-range']);
    }
    if (upstreamRes.headers['content-length']) {
      responseHeaders['Content-Length'] = String(upstreamRes.headers['content-length']);
    }

    const binaryData = Buffer.isBuffer(upstreamRes.data)
      ? upstreamRes.data
      : Buffer.from(upstreamRes.data);

    return new NextResponse(binaryData, {
      status: upstreamRes.status,
      headers: responseHeaders,
    });
  } catch (e: any) {
    console.error('[ProxyStream Error]', e?.message || e);
    return new NextResponse(e?.message || 'Proxy error', {
      status: 500,
      headers: CORS_HEADERS,
    });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}

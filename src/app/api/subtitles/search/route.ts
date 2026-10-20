import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('query') || '';
  const imdbId = searchParams.get('imdbId') || '';
  const season = searchParams.get('season');
  const episode = searchParams.get('episode');
  const subLanguageId = searchParams.get('lang') || '';

  if (!query && !imdbId) {
    return NextResponse.json({ success: false, message: 'Missing query or imdbId' }, { status: 400 });
  }

  try {
    let endpoint = 'https://rest.opensubtitles.org/search';

    if (episode) endpoint += `/episode-${episode}`;

    if (imdbId) {
      const cleanImdb = imdbId.replace('tt', '');
      endpoint += `/imdbid-${cleanImdb}`;
    } else if (query) {
      endpoint += `/query-${encodeURIComponent(query.toLowerCase())}`;
    }

    if (season) endpoint += `/season-${season}`;
    if (subLanguageId) endpoint += `/sublanguageid-${subLanguageId}`;

    const res = await fetch(endpoint, {
      headers: {
        'x-user-agent': 'VLSub 0.10.2',
        'User-Agent': 'VLSub 0.10.2',
      },
    });

    if (!res.ok) {
      return NextResponse.json({ success: false, results: [] });
    }

    const data = await res.json();
    if (!Array.isArray(data)) {
      return NextResponse.json({ success: true, results: [] });
    }

    const results = data.map((item: any) => ({
      id: item.IDSubtitleFile || item.IDSubtitle,
      title: item.SubFileName || item.MovieReleaseName || item.LanguageName,
      language: item.LanguageName || item.SubLanguageID,
      langCode: item.SubLanguageID,
      downloadUrl: item.SubDownloadLink,
      rating: item.SubRating,
      downloadsCount: item.SubDownloadsCnt,
    }));

    return NextResponse.json({
      success: true,
      count: results.length,
      results,
    });
  } catch (err: any) {
    console.error('[Subtitle Search] Error:', err);
    return NextResponse.json({ success: false, results: [], error: err?.message }, { status: 500 });
  }
}

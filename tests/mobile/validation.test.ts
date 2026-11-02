import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCollectionEndpoint,
  buildDiscoverEndpoint,
  buildEpisodeGroupEndpoint,
  buildEpisodesEndpoint,
  buildListEndpoint,
  buildTitleLogosEndpoint,
  collectionRequest,
  parseCollectionParams,
  parseDetailsParams,
  parseDiscoverParams,
  parseEpisodeGroupParams,
  parseEpisodesParams,
  parseFindParams,
  parseGenresParams,
  parseHomeParams,
  parseListParams,
  parseSearchParams,
  parseTitleLogoParams,
  type ValidationResult,
} from "../../src/lib/mobile/validation";

function value<T>(result: ValidationResult<T>): T {
  if (!result.ok) assert.fail(result.error);
  return result.value;
}

test("home accepts defaults and rejects bad enum/page values", () => {
  assert.deepEqual(value(parseHomeParams(new URLSearchParams())), {
    content: "movie",
    page: 1,
  });
  assert.deepEqual(
    value(parseHomeParams(new URLSearchParams("content=tv&page=7"))),
    { content: "tv", page: 7 },
  );

  assert.equal(parseHomeParams(new URLSearchParams("content=anime")).ok, false);
  assert.equal(parseHomeParams(new URLSearchParams("page=0")).ok, false);
  assert.equal(parseHomeParams(new URLSearchParams("page=501")).ok, false);
  assert.equal(parseHomeParams(new URLSearchParams("page=1e2")).ok, false);
});

test("duplicate, unknown and repeated query parameters are rejected", () => {
  assert.equal(
    parseHomeParams(new URLSearchParams("content=movie&content=tv")).ok,
    false,
  );
  assert.equal(parseHomeParams(new URLSearchParams("content=movie&api_key=x")).ok, false);
  assert.equal(parseListParams(new URLSearchParams("content=movie&collection=popular&page=1&page=2")).ok, false);
});

test("search trims query, rejects control characters and caps length", () => {
  const result = parseSearchParams(new URLSearchParams("q=%20%20Dune%20%20Part%20Two%20&type=movie"));
  assert.deepEqual(value(result), { q: "Dune Part Two", type: "movie", page: 1 });

  assert.equal(parseSearchParams(new URLSearchParams("q=%00bad")).ok, false);
  assert.equal(parseSearchParams(new URLSearchParams("q=")).ok, false);
  assert.equal(parseSearchParams(new URLSearchParams(`q=${"x".repeat(121)}`)).ok, false);
  assert.equal(parseSearchParams(new URLSearchParams("q=dune&type=person")).ok, false);
});

test("numeric ids, seasons and group ids are strictly bounded", () => {
  assert.deepEqual(value(parseDetailsParams(new URLSearchParams("mediaType=tv&id=123"))), {
    mediaType: "tv",
    id: 123,
  });
  for (const id of ["0", "1.5", "1e3", "../movie/1", "1000000000"]) {
    assert.equal(parseDetailsParams(new URLSearchParams(`mediaType=movie&id=${id}`)).ok, false);
  }
  assert.equal(parseDetailsParams(new URLSearchParams("id=123")).ok, false);

  assert.deepEqual(value(parseEpisodesParams(new URLSearchParams("tvId=42&season=0"))), {
    tvId: 42,
    season: 0,
  });
  assert.equal(parseEpisodesParams(new URLSearchParams("tvId=42&season=1000")).ok, false);
  assert.equal(parseEpisodeGroupParams(new URLSearchParams("groupId=abc_123-XYZ")).ok, true);
  assert.equal(parseEpisodeGroupParams(new URLSearchParams("groupId=../secret")).ok, false);
});

test("only fixed TMDB collection paths can be requested", () => {
  assert.deepEqual(collectionRequest("movie", "now_playing", 2), {
    path: "/movie/now_playing",
    params: { page: 2 },
  });
  assert.equal(collectionRequest("tv", "upcoming", 1), null);
  assert.equal(collectionRequest("movie", "on_the_air", 1), null);
  assert.equal(parseListParams(new URLSearchParams("content=tv&collection=upcoming")).ok, false);

  assert.equal(
    buildListEndpoint("movie", "now_playing", 2),
    "/api/mobile/v1/list?content=movie&collection=now_playing&page=2",
  );
  assert.equal(
    buildEpisodesEndpoint(42, 0),
    "/api/mobile/v1/episodes?tvId=42&season=0",
  );
  assert.equal(
    buildEpisodeGroupEndpoint("g1"),
    "/api/mobile/v1/episode-groups?groupId=g1",
  );
});

test("genre Discover accepts compatibility aliases and canonicalizes fixed query values", () => {
  const params = new URLSearchParams(
    "mediaType=tv&with_genres=28,12&sort_by=vote_average.desc&page=2",
  );
  assert.deepEqual(value(parseDiscoverParams(params)), {
    content: "tv",
    preset: "none",
    genreIds: [12, 28],
    withGenres: "12,28",
    sortBy: "vote_average.desc",
    page: 2,
    originalLanguage: null,
    originCountry: null,
    keywordIds: [],
    keywords: "",
    withoutKeywordIds: [],
    withoutKeywords: "",
  });

  const repeated = new URLSearchParams("content=movie&genres=28&genres=12&sort=popularity.asc");
  assert.deepEqual(value(parseDiscoverParams(repeated)), {
    content: "movie",
    preset: "none",
    genreIds: [12, 28],
    withGenres: "12,28",
    sortBy: "popularity.asc",
    page: 1,
    originalLanguage: null,
    originCountry: null,
    keywordIds: [],
    keywords: "",
    withoutKeywordIds: [],
    withoutKeywords: "",
  });

  assert.equal(parseDiscoverParams(new URLSearchParams("content=movie&type=tv")).ok, false);
  assert.equal(parseDiscoverParams(new URLSearchParams("genres=28|12")).ok, true);
  assert.equal(
    parseDiscoverParams(new URLSearchParams("genres=28,12&genre=18|35")).ok,
    false,
  );
  assert.equal(parseDiscoverParams(new URLSearchParams("genres=abc")).ok, false);
  assert.equal(parseDiscoverParams(new URLSearchParams("sortBy=revenue.desc")).ok, false);
  assert.equal(
    parseDiscoverParams(new URLSearchParams(`genres=${Array.from({ length: 11 }, (_, i) => i + 1).join(",")}`)).ok,
    false,
  );

  const discoverParams = value(
    parseDiscoverParams(
      new URLSearchParams("content=movie&genres=12,28&sortBy=vote_average.desc&page=3"),
    ),
  );
  assert.equal(
    buildDiscoverEndpoint(discoverParams),
    "/api/mobile/v1/discover?content=movie&sortBy=vote_average.desc&page=3&genres=12%2C28",
  );
});

test("genre list and IMDb lookup compatibility params are strictly validated", () => {
  assert.deepEqual(value(parseGenresParams(new URLSearchParams("type=tv"))), { content: "tv" });
  assert.equal(parseGenresParams(new URLSearchParams("content=movie&mediaType=tv")).ok, false);

  assert.deepEqual(
    value(parseFindParams(new URLSearchParams("imdbId=tt1234567&mediaType=movie"))),
    { imdbId: "tt1234567", mediaType: "movie", externalSource: "imdb_id" },
  );
  assert.deepEqual(
    value(parseFindParams(new URLSearchParams("imdb_id=1234567&external_source=imdb_id"))),
    { imdbId: "tt1234567", mediaType: "multi", externalSource: "imdb_id" },
  );
  assert.deepEqual(
    value(parseFindParams(new URLSearchParams(), "tt7654321")),
    { imdbId: "tt7654321", mediaType: "multi", externalSource: "imdb_id" },
  );

  assert.equal(
    parseFindParams(new URLSearchParams("imdbId=tt1234567"), "tt7654321").ok,
    false,
  );
  assert.equal(parseFindParams(new URLSearchParams("imdbId=nm1234567")).ok, false);
  assert.equal(parseFindParams(new URLSearchParams("imdbId=tt123")).ok, false);
  assert.equal(parseFindParams(new URLSearchParams("imdbId=tt1234567&externalSource=tvdb_id")).ok, false);
  assert.equal(parseFindParams(new URLSearchParams("imdbId=tt1234567&type=person")).ok, false);
});

test("anime/Korean Discover presets and explicit filters are strictly resolved", () => {
  const anime = value(parseDiscoverParams(new URLSearchParams("type=anime&page=2")));
  assert.deepEqual(
    {
      content: anime.content,
      preset: anime.preset,
      genreIds: anime.genreIds,
      withGenres: anime.withGenres,
      sortBy: anime.sortBy,
      page: anime.page,
      originalLanguage: anime.originalLanguage,
      originCountry: anime.originCountry,
      keywordIds: anime.keywordIds,
      keywords: anime.keywords,
      withoutKeywordIds: anime.withoutKeywordIds,
      withoutKeywords: anime.withoutKeywords,
    },
    {
      content: "tv",
      preset: "anime",
      genreIds: [16],
      withGenres: "16",
      sortBy: "popularity.desc",
      page: 2,
      originalLanguage: "ja",
      originCountry: "JP",
      keywordIds: [210024],
      keywords: "210024",
      withoutKeywordIds: [158718, 155477],
      withoutKeywords: "158718|155477",
    },
  );

  const korean = value(
    parseDiscoverParams(new URLSearchParams("content=movie&preset=korean&genres=28")),
  );
  assert.equal(korean.content, "movie");
  assert.equal(korean.preset, "korean");
  assert.deepEqual(korean.genreIds, [28]);
  assert.equal(korean.originalLanguage, "ko");
  assert.equal(korean.originCountry, "KR");
  assert.equal(korean.keywords, "");

  const overridden = value(
    parseDiscoverParams(
      new URLSearchParams(
        "filter=anime&content=tv&with_original_language=ko&with_origin_country=KR&with_keywords=1,2&without_keywords=3",
      ),
    ),
  );
  assert.equal(overridden.originalLanguage, "ko");
  assert.equal(overridden.originCountry, "KR");
  assert.equal(overridden.keywords, "1,2");
  assert.equal(overridden.withoutKeywords, "3");
  assert.match(buildDiscoverEndpoint(overridden), /filter=anime/);

  assert.equal(parseDiscoverParams(new URLSearchParams("filter=anime&preset=korean")).ok, false);
  assert.equal(parseDiscoverParams(new URLSearchParams("with_original_language=xx")).ok, false);
  assert.equal(parseDiscoverParams(new URLSearchParams("with_origin_country=ZZ")).ok, false);
  assert.equal(parseDiscoverParams(new URLSearchParams("with_keywords=abc")).ok, false);
  assert.equal(
    parseDiscoverParams(new URLSearchParams("filter=kdrama&content=movie&mediaType=tv")).ok,
    false,
  );
});

test("title logo and collection params accept compatibility aliases", () => {
  assert.deepEqual(value(parseTitleLogoParams(new URLSearchParams("mediaType=movie&id=7"))), {
    mediaType: "movie",
    id: 7,
  });
  assert.deepEqual(value(parseTitleLogoParams(new URLSearchParams("type=tv&id=8"))), {
    mediaType: "tv",
    id: 8,
  });
  assert.equal(parseTitleLogoParams(new URLSearchParams("id=7")).ok, false);
  assert.equal(parseTitleLogoParams(new URLSearchParams("mediaType=movie")).ok, false);

  assert.deepEqual(value(parseCollectionParams(new URLSearchParams("collectionId=9"))), {
    collectionId: 9,
  });
  assert.deepEqual(value(parseCollectionParams(new URLSearchParams("id=9"))), {
    collectionId: 9,
  });
  assert.equal(parseCollectionParams(new URLSearchParams("collectionId=1&id=1")).ok, false);
  assert.equal(parseCollectionParams(new URLSearchParams("collectionId=abc")).ok, false);

  assert.equal(
    buildTitleLogosEndpoint("movie", 7),
    "/api/mobile/v1/title-logos?mediaType=movie&id=7",
  );
  assert.equal(
    buildCollectionEndpoint(9),
    "/api/mobile/v1/collection?collectionId=9",
  );
});

import assert from "node:assert/strict";
import test from "node:test";

import {
  buildEpisodeGroupEndpoint,
  buildEpisodesEndpoint,
  buildListEndpoint,
  collectionRequest,
  parseDetailsParams,
  parseEpisodeGroupParams,
  parseEpisodesParams,
  parseHomeParams,
  parseListParams,
  parseSearchParams,
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

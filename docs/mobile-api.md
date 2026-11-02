# SnapFlix mobile metadata API

A separate, versioned metadata API for the SnapFlix mobile app. It runs on the
same Cloudflare Worker as the website, but uses a **different, strict TMDB
access layer**:

- It reads **only** the server-side `TMDB_ACCESS_TOKEN` secret.
- It does **not** use `NEXT_PUBLIC_TMDB_ACCESS_TOKEN`, `TMDB_API_KEY`, website
  fallbacks, or the website's mirror.
- It never returns stream URLs. The existing provider/stream resolver and
  website playback code are unchanged.
- It accepts only `GET` requests to a fixed set of TMDB paths.
- Home returns the rows that succeeded even if one TMDB row fails.
- Genre Discover and IMDb-to-TMDB lookup have compatibility aliases for older
  mobile clients.
- When the optional app-key gate is enabled, public CDN/Worker caching is
  automatically disabled so the gate cannot be bypassed by a cache hit.

Base URL: `https://<your-domain>/api/mobile/v1`

All successful responses look like:

```json
{
  "ok": true,
  "data": { "...": "endpoint-specific data" },
  "meta": {
    "version": "v1",
    "imageBaseUrl": "https://image.tmdb.org/t/p/",
    "ttlSeconds": 600,
    "generatedAt": "2026-11-02T00:00:00.000Z"
  }
}
```

Build an image URL by appending a size and the returned path, for example
`https://image.tmdb.org/t/p/w500/poster.jpg`.

Errors use this shape:

```json
{
  "ok": false,
  "error": {
    "code": "bad_request",
    "message": "The request contains invalid or unsupported parameters.",
    "retryable": false
  },
  "meta": {
    "version": "v1",
    "imageBaseUrl": "https://image.tmdb.org/t/p/"
  }
}
```

## Endpoints

| Endpoint | Purpose |
| --- | --- |
| `GET /home` | Hero and fixed home rows |
| `GET /list` | Pagination for one home row |
| `GET /search` | Movie, TV or merged search |
| `GET /details` | Normalized movie/TV details |
| `GET /episodes` | Episodes for a TV season |
| `GET /episode-groups` | Alternate/anime episode ordering |
| `GET /discover` | Genre-aware TMDB Discover |
| `GET /genres` | Movie/TV genre filters |
| `GET /find` | IMDb-to-TMDB lookup |

### 1. Home

```http
GET /api/mobile/v1/home?content=movie&page=1
```

| Parameter | Required | Values |
| --- | --- | --- |
| `content` | no, default `movie` | `movie`, `tv` |
| `page` | no, default `1` | `1`–`500` |

Returns a `hero` list plus fixed home rows: trending day/week, popular,
now-playing/on-the-air, upcoming (movies only) and top-rated. Each row contains
`nextPage` and a ready-to-use `endpoint` for pagination.

Rows are fetched independently. If one TMDB row fails, the response is still
`200` and contains all successful rows, plus:

```json
{
  "partial": true,
  "failedRows": [
    {
      "id": "trending_day",
      "title": "Today's Trending Movies",
      "code": "upstream_unavailable",
      "message": "The metadata provider is temporarily unavailable.",
      "retryable": true
    }
  ]
}
```

A partial Home response uses a short 30-second cache TTL so a failed row can
recover quickly. If every row fails, the original upstream error is returned.

### 2. One paginated home row

```http
GET /api/mobile/v1/list?content=movie&collection=popular&page=1
```

| Parameter | Required | Values |
| --- | --- | --- |
| `content` | no, default `movie` | `movie`, `tv` |
| `collection` | yes | see below |
| `page` | no, default `1` | `1`–`500` |

Allowed movie collections: `trending_day`, `trending_week`, `popular`,
`now_playing`, `upcoming`, `top_rated`.

Allowed TV collections: `trending_day`, `trending_week`, `popular`,
`on_the_air`, `top_rated`.

### 3. Search

```http
GET /api/mobile/v1/search?q=dune&type=multi&page=1
```

| Parameter | Required | Values |
| --- | --- | --- |
| `q` | yes | 1–120 characters; control characters rejected |
| `type` | no, default `multi` | `multi`, `movie`, `tv` |
| `page` | no, default `1` | `1`–`500` |

`multi` combines movie and TV results and removes `person` results. Searches
always force `include_adult=false`.

### 4. Movie or TV details

```http
GET /api/mobile/v1/details?mediaType=tv&id=12345
```

| Parameter | Required | Values |
| --- | --- | --- |
| `mediaType` | yes | `movie`, `tv` |
| `id` | yes | positive TMDB id, up to 9 digits |

Returns normalized title facts, genres, cast/crew, trailers, images, keywords,
recommendations, similar titles and external IDs. TV details also include
seasons (with `episodesEndpoint`), episode-group summaries and the recommended
episode-group endpoint.

### 5. Episodes for one season

```http
GET /api/mobile/v1/episodes?tvId=12345&season=1
```

| Parameter | Required | Values |
| --- | --- | --- |
| `tvId` | yes | positive TMDB id |
| `season` | yes | `0`–`999`; `0` means specials |

Returns episode names, still paths, air dates, runtimes and the TMDB
season/episode numbers needed by the app's existing playback flow.

### 6. Alternate episode groups

```http
GET /api/mobile/v1/episode-groups?groupId=abc123
```

| Parameter | Required | Values |
| --- | --- | --- |
| `groupId` | yes | 1–64 letters, digits, `_` or `-` |

Returns resolved seasons for anime/alternate ordering. Each episode keeps
`tmdbSeasonNumber`, `tmdbEpisodeNumber` and `absoluteEpisodeNumber` so the
mobile app can map a displayed season to the correct TMDB numbers.

### 7. Genre Discover

```http
GET /api/mobile/v1/discover?content=movie&genres=28,12&sortBy=popularity.desc&page=1
```

| Parameter | Required | Values |
| --- | --- | --- |
| `content`, `mediaType` or `type` | no, default `movie` | `movie`, `tv` |
| `genres`, `with_genres` or `genre` | no | up to 10 numeric TMDB genre IDs, comma or pipe separated |
| `sortBy`, `sort_by` or `sort` | no, default `popularity.desc` | fixed TMDB sort allowlist |
| `page` | no, default `1` | `1`–`500` |

`include_adult=false` is always forced. The response includes both normalized
camelCase fields and TMDB-compatible aliases such as `media_type`,
`with_genres`, `genre_ids`, `sort_by`, `total_pages` and `total_results`.

Compatibility path alias: `GET /api/mobile/v1/tmdb/discover` accepts the same
parameters.

### 8. Genre list

```http
GET /api/mobile/v1/genres?content=tv
```

| Parameter | Required | Values |
| --- | --- | --- |
| `content`, `mediaType` or `type` | no, default `movie` | `movie`, `tv` |

Returns normalized `{ id, name }` genre objects in `genres`, plus a TMDB-style
`tmdb.genres` alias and `content`/`mediaType`/`media_type` aliases.

Compatibility path alias: `GET /api/mobile/v1/tmdb/genres`.

### 9. IMDb-to-TMDB lookup

```http
GET /api/mobile/v1/find?imdbId=tt1234567&mediaType=multi
```

| Parameter | Required | Values |
| --- | --- | --- |
| `imdbId`, `imdb_id`, `externalId` or `id` | yes | `tt` + 7–10 digits, or bare 7–10 digits |
| `externalSource` or `external_source` | no | only `imdb_id` |
| `content`, `mediaType` or `type` | no, default `multi` | `multi`, `movie`, `tv` |

This calls TMDB's fixed `/find/{imdb_id}?external_source=imdb_id` path. IMDb
IDs are normalized to lowercase `tt...`. The response includes:

- `match`, `tmdbId`, `mediaType` and `results` for easy app use.
- TMDB-compatible arrays: `movie_results`, `tv_results`,
  `tv_episode_results`, `tv_season_results` and `person_results`.
- Both camelCase and snake_case fields on each result, for example
  `posterPath` and `poster_path`.
- `person_results` is always empty; person lookups are not exposed.

Compatibility aliases:

- `GET /api/mobile/v1/lookup`
- `GET /api/mobile/v1/tmdb/find`
- `GET /api/mobile/v1/find/{imdbId}`
- `GET /api/mobile/v1/tmdb/find/{imdbId}`
- `GET /api/mobile/v1/imdb/{imdbId}`

## Validation and misuse protection

- Unknown or duplicate query parameters are rejected with `400`; repeated
  `genres`/`with_genres`/`genre` values are allowed for compatibility.
- Media types, collection names, pages, IDs, seasons, group IDs, genre IDs,
  sort values and IMDb IDs are checked against fixed allowlists and numeric
  bounds.
- Search text is trimmed, normalized, control-character checked and capped at
  120 characters.
- TMDB URLs and query keys are built internally; clients cannot pass arbitrary
  paths, `api_key`, `append_to_response` or headers upstream.
- `language=en-US`, `include_adult=false` and `external_source=imdb_id` are
  fixed where supported.
- Upstream responses are streamed with a hard byte cap and requests time out
  after 8 seconds; the timeout covers the full body read, not just the headers.
- A per-isolate token bucket allows 60 requests/minute per Cloudflare IP; home
  and search cost 2 tokens. `429` includes `Retry-After`.
- Optional shared-key gate: set the `MOBILE_API_KEY` Worker secret and send it
  from the app as `X-SnapFlix-Mobile-Key`.
- There is no wildcard CORS header and no `Set-Cookie` on these responses.
  Native apps do not need CORS; same-origin website calls work normally.

> The in-Worker limiter is per isolate. Use a Cloudflare WAF rate-limiting rule
> for the global limit; see below.

## Caching

| Endpoint | `s-maxage` / TTL |
| --- | ---: |
| `/home` | 600 s, or 30 s when partial |
| `/list` | 600 s |
| `/search` | 300 s |
| `/details` | 1,800 s |
| `/episodes` | 1,800 s |
| `/episode-groups` | 86,400 s |
| `/discover` | 600 s |
| `/genres` | 86,400 s |
| `/find` | 86,400 s |

For public/ungated deployments, three layers are used:

1. A bounded, TTL-based in-isolate memory cache with in-flight request
   coalescing.
2. Cloudflare's Worker Cache API when available (`X-Mobile-Cache: HIT/MISS`).
3. Standard response headers: `Cache-Control` and `CDN-Cache-Control` with
   `s-maxage`, `stale-while-revalidate` and `stale-if-error`.

Errors are always `no-store`.

### Optional app-key gate and CDN caching

A public CDN cache hit would happen before the Worker can check
`X-SnapFlix-Mobile-Key`. Therefore, when `MOBILE_API_KEY` is set, every
successful endpoint response automatically becomes:

```http
Cache-Control: private, no-store, no-cache, max-age=0, must-revalidate
CDN-Cache-Control: no-store
Vary: Accept-Encoding, X-SnapFlix-Mobile-Key
X-Mobile-CDN-Cache: disabled
```

The Worker Cache API is also bypassed in this mode. The in-isolate data cache
still works, but only **after** the app-key check has passed. This makes the
gate safe even if a broad CDN Cache Rule exists.

## Cloudflare configuration

### 1. Required Worker secret

Set the TMDB v4 **read access token** as a Worker secret:

```bash
npx wrangler secret put TMDB_ACCESS_TOKEN
```

The command prompts securely for the value. You can also set it in the
Cloudflare dashboard under **Workers & Pages → your Worker → Settings →
Variables and Secrets → Add secret**. Do not put it in `wrangler.jsonc` under
`vars`, do not prefix it with `NEXT_PUBLIC_`, and do not commit it.

For local `wrangler dev`, put the value in an untracked `.dev.vars` file:

```dotenv
NEXTJS_ENV=development
TMDB_ACCESS_TOKEN=<local-value-only>
```

### 2. Optional mobile app-key secret

If you want an additional gate, set another Worker secret:

```bash
npx wrangler secret put MOBILE_API_KEY
```

The mobile app must then send `X-SnapFlix-Mobile-Key` with every request. When
this secret is enabled, disable or bypass the public CDN Cache Rule for
`/api/mobile/v1/`, because the API itself already emits `no-store` headers and
skips Worker Cache API writes. Never override those headers with a forced
"Cache Everything" rule in gated mode.

### 3. Cache Rule for ungated/public mode

In **Caching → Cache Rules**, create a rule scoped only to paths starting with
`/api/mobile/v1/`:

- Cache eligibility: eligible for cache / respect origin cache headers.
- Use the origin `Cache-Control` / `CDN-Cache-Control` TTL.
- Cache `GET` and `200` responses only.
- Keep the full query string in the cache key.
- Status code: `200` only.

Do **not** apply a site-wide "Cache Everything" rule. In particular, keep
`/api/provider/*`, auth routes and playback routes out of this rule. Disable or
bypass this rule when `MOBILE_API_KEY` is enabled.

### 4. Global rate limiting / WAF for native apps

In **Security → WAF → Rate limiting rules**, add a rule for paths starting with
`/api/mobile/v1/`. A reasonable starting point is 120 requests per minute per
IP, with a temporary **Block** action. Optionally add a stricter rule (for
example 30/minute) for `/api/mobile/v1/search`.

For native apps, use `Block`, `Log`, or a rate-limit response that the app can
handle. **Do not use Managed Challenge, Turnstile, or other browser-based
interactive challenges for these API routes**: native clients cannot complete a
browser challenge. For stronger client authentication, use the optional
`MOBILE_API_KEY`, mTLS/API Shield, or signed requests instead.

Cloudflare's rule is important because the in-code limiter is per Worker
isolate; the WAF rule gives one global limit across all isolates.

### 5. Deploy

After setting secrets, deploy the current branch normally:

```bash
npm run deploy
```

No client-side TMDB token needs to be configured for these endpoints.

## Error codes

| HTTP | `error.code` | Meaning |
| ---: | --- | --- |
| 400 | `bad_request` | Invalid, unknown or duplicate input |
| 401 | `client_unauthorized` | Optional `MOBILE_API_KEY` gate failed |
| 429 | `client_rate_limited` | Per-IP request budget exceeded |
| 404 | `not_found` | TMDB title not found |
| 500 | `internal_error` | Unexpected server failure |
| 502 | `upstream_unauthorized`, `upstream_unavailable`, `upstream_response_too_large` | TMDB credential, provider or oversized-response failure |
| 503 | `service_unconfigured`, `upstream_rate_limited` | Missing server secret or TMDB busy |
| 504 | `upstream_unavailable` | TMDB request timed out |

Retryable errors include `Retry-After` where available.

## Verification

Targeted checks:

```bash
npm run test:mobile-api
npm run typecheck:mobile
npm run typecheck
```

Cloudflare build and local preview:

```bash
npm run build:worker
npm run preview -- --ip 0.0.0.0
```

`test:mobile-api` uses Node's built-in test runner with `tsx` and stubs TMDB
`fetch`; it does not need a real token or network access.

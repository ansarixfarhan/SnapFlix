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

## Validation and misuse protection

- Unknown or duplicate query parameters are rejected with `400`.
- Media types, collection names, pages, IDs, seasons and group IDs are checked
  against fixed allowlists and numeric bounds.
- Search text is trimmed, normalized, control-character checked and capped at
  120 characters.
- TMDB URLs and query keys are built internally; clients cannot pass arbitrary
  paths, `api_key`, `append_to_response` or headers upstream.
- `language=en-US` and `include_adult=false` are fixed where supported.
- Upstream responses are size-limited and requests time out after 8 seconds.
- A per-isolate token bucket allows 60 requests/minute per Cloudflare IP; home
  and search cost 2 tokens. `429` includes `Retry-After`.
- Optional shared-key gate: set the `MOBILE_API_KEY` Worker secret and send it
  from the app as `X-SnapFlix-Mobile-Key`. If the secret is unset, endpoints are
  public but still rate limited.
- There is no wildcard CORS header and no `Set-Cookie` on these responses.
  Native apps do not need CORS; same-origin website calls work normally.

> The in-Worker limiter is per isolate. Use a Cloudflare WAF rate-limiting rule
> for the global limit; see below.

## Caching

| Endpoint | `s-maxage` / TTL |
| --- | ---: |
| `/home` | 600 s |
| `/list` | 600 s |
| `/search` | 300 s |
| `/details` | 1,800 s |
| `/episodes` | 1,800 s |
| `/episode-groups` | 86,400 s |

Three layers are used:

1. A bounded, TTL-based in-isolate memory cache with in-flight request
   coalescing.
2. Cloudflare's Worker Cache API when available (`X-Mobile-Cache: HIT/MISS`).
3. Standard response headers: `Cache-Control` and `CDN-Cache-Control` with
   `s-maxage`, `stale-while-revalidate` and `stale-if-error`.

Errors are always `no-store`. Successful responses are public metadata only.

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

The mobile app must then send `X-SnapFlix-Mobile-Key` with every request. This
is optional; the endpoints work without it, protected by validation and rate
limiting.

### 3. Cache Rule

In **Caching → Cache Rules**, create a rule scoped only to paths starting with
`/api/mobile/v1/`:

- Cache eligibility: eligible for cache / respect origin cache headers.
- Use the origin `Cache-Control` / `CDN-Cache-Control` TTL.
- Cache `GET` and `200` responses only.
- Keep the full query string in the cache key.
- Status code: `200` only.

Do **not** apply a site-wide "Cache Everything" rule. In particular, keep
`/api/provider/*`, auth routes and playback routes out of this rule.

### 4. Global rate limiting / WAF

In **Security → WAF → Rate limiting rules**, add a rule for paths starting with
`/api/mobile/v1/`. A reasonable starting point is 120 requests per minute per
IP, with a temporary Block or Managed Challenge. Optionally add a stricter rule
(for example 30/minute) for `/api/mobile/v1/search`.

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
| 502 | `upstream_unauthorized`, `upstream_unavailable` | TMDB credential or provider failure |
| 503 | `service_unconfigured`, `upstream_rate_limited` | Missing server secret or TMDB busy |
| 504 | `upstream_unavailable` | TMDB request timed out |

Retryable errors include `Retry-After` where available.

## Targeted verification

These commands cover the mobile API without running the full production build:

```bash
npm run test:mobile-api
npm run typecheck:mobile
npm run typecheck
```

`test:mobile-api` uses Node's built-in test runner with `tsx` and stubs TMDB
`fetch`; it does not need a real token or network access.

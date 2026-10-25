"use server";

const APPEND =
  "images,videos,credits,keywords,recommendations,similar,reviews,watch/providers,episode_groups";

type CatalogError = "not-found" | "unavailable";

export type CatalogResult<T> = { data: T } | { error: CatalogError };

function credentials() {
  const token = [
    process.env.TMDB_ACCESS_TOKEN,
    process.env.TMDB_API,
    process.env.NEXT_PUBLIC_TMDB_ACCESS_TOKEN,
  ].find((value) => value && !value.includes("your_tmdb") && value !== "placeholder_token");
  const apiKey = [process.env.TMDB_API_KEY, process.env.NEXT_PUBLIC_TMDB_API_KEY].find(
    (value) => value && !value.includes("your_tmdb"),
  );

  return { token, apiKey };
}

async function fetchFromMirror(path: string, params: Record<string, string> = {}): Promise<CatalogResult<any>> {
  try {
    const url = new URL(`https://db.wecollege.net/3${path}`);
    url.searchParams.set("api_key", "mock");
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
    const response = await fetch(url.toString(), {
      headers: { accept: "application/json" },
      next: { revalidate: 600 },
    });
    if (response.status === 404) return { error: "not-found" };
    if (!response.ok) return { error: "unavailable" };
    return { data: await response.json() };
  } catch (err) {
    console.warn(`TMDB mirror fetch failed for ${path}:`, err);
    return { error: "unavailable" };
  }
}

async function tmdbGet(path: string, params: Record<string, string> = {}): Promise<CatalogResult<any>> {
  const { token, apiKey } = credentials();

  try {
    const url = new URL(`https://api.themoviedb.org/3${path}`);
    url.searchParams.set("language", "en-US");
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
    if (apiKey) url.searchParams.set("api_key", apiKey);

    const response = await fetch(url, {
      headers: {
        accept: "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      next: { revalidate: 600 },
    });

    if (response.status === 404) return { error: "not-found" };
    if (!response.ok) {
      console.warn(`TMDB request returned ${response.status} for ${path}, trying mirror...`);
      return await fetchFromMirror(path, params);
    }

    return { data: await response.json() };
  } catch (err) {
    console.warn(`TMDB direct request threw error for ${path}, trying mirror...`, err);
    return await fetchFromMirror(path, params);
  }
}

export async function getMovieDetails(id: number): Promise<CatalogResult<any>> {
  if (!Number.isFinite(id)) return { error: "not-found" };
  return tmdbGet(`/movie/${id}`, { append_to_response: APPEND });
}

export async function getTvDetails(id: number): Promise<CatalogResult<any>> {
  if (!Number.isFinite(id)) return { error: "not-found" };
  return tmdbGet(`/tv/${id}`, { append_to_response: APPEND });
}

export async function getTvSeason(id: number, seasonNumber: number): Promise<CatalogResult<any>> {
  if (!Number.isFinite(id) || !Number.isFinite(seasonNumber)) return { error: "not-found" };
  return tmdbGet(`/tv/${id}/season/${seasonNumber}`);
}

export async function getTvEpisodeGroup(groupId: string): Promise<CatalogResult<any>> {
  if (!groupId) return { error: "not-found" };
  return tmdbGet(`/tv/episode_group/${groupId}`);
}

export async function getPersonDetails(id: number): Promise<CatalogResult<any>> {
  if (!Number.isFinite(id)) return { error: "not-found" };
  return tmdbGet(`/person/${id}`, {
    append_to_response: "combined_credits,images,external_ids",
  });
}

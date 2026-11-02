import { handleFind } from "@/lib/mobile/handlers";

/** IMDb-to-TMDB lookup using TMDB's fixed `/find/{imdb_id}` endpoint. */
export async function GET(request: Request) {
  return handleFind(request);
}

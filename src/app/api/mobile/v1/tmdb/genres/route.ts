import { handleGenres } from "@/lib/mobile/handlers";

/** Compatibility alias for the movie/TV genre list. */
export async function GET(request: Request) {
  return handleGenres(request);
}

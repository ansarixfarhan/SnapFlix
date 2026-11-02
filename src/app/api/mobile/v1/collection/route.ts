import { handleCollection } from "@/lib/mobile/handlers";

/** Full TMDB movie collection details for Story collection rows. */
export async function GET(request: Request) {
  return handleCollection(request);
}

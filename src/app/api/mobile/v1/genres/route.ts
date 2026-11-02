import { handleGenres } from "@/lib/mobile/handlers";

/** Movie or TV genre list for Discover filters. */
export async function GET(request: Request) {
  return handleGenres(request);
}

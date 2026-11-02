import { handleDiscover } from "@/lib/mobile/handlers";

/** Compatibility alias for genre-aware TMDB discover. */
export async function GET(request: Request) {
  return handleDiscover(request);
}

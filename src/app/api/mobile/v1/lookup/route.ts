import { handleFind } from "@/lib/mobile/handlers";

/** Compatibility alias for IMDb-to-TMDB lookup. */
export async function GET(request: Request) {
  return handleFind(request);
}

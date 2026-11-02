import { handleDiscover } from "@/lib/mobile/handlers";

/** Genre-aware TMDB discover with compatibility aliases for mobile clients. */
export async function GET(request: Request) {
  return handleDiscover(request);
}

import { handleHome } from "@/lib/mobile/handlers";

/** Mobile home: one cached request for a hero plus every fixed TMDB row. */
export async function GET(request: Request) {
  return handleHome(request);
}

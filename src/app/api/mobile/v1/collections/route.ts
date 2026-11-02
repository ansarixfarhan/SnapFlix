import { handleCollection } from "@/lib/mobile/handlers";

/** Compatibility alias for movie collection details. */
export async function GET(request: Request) {
  return handleCollection(request);
}

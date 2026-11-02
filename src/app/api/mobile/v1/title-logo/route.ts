import { handleTitleLogos } from "@/lib/mobile/handlers";

/** Compatibility alias for title logos. */
export async function GET(request: Request) {
  return handleTitleLogos(request);
}

import { handleTitleLogos } from "@/lib/mobile/handlers";

/** Title/brand logos for Home hero and Story headers. */
export async function GET(request: Request) {
  return handleTitleLogos(request);
}

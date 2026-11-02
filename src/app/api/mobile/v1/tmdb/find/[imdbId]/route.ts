import { handleFind } from "@/lib/mobile/handlers";

type FindContext = { params: Promise<{ imdbId: string }> };

/** Compatibility alias: /tmdb/find/tt1234567. */
export async function GET(request: Request, context: FindContext) {
  const { imdbId } = await context.params;
  return handleFind(request, imdbId);
}

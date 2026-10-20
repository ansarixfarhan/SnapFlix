import { type NextRequest } from "next/server";
import { updateSession } from "@/utils/supabase/middleware";

export async function proxy(request: NextRequest) {
  // update user's auth session
  return await updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|cdn-cgi|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff|woff2|js|css)$).*)",
  ],
};

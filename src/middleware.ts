import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/utils/supabase/middleware";

export async function middleware(request: NextRequest) {
  // Allow iframe embedding on /embed routes by setting permissive frame-ancestors
  if (request.nextUrl.pathname.startsWith("/embed")) {
    const response = NextResponse.next();
    response.headers.set("Content-Security-Policy", "frame-ancestors *;");
    response.headers.delete("X-Frame-Options");
    return response;
  }

  // The public mobile metadata API has no session state. Bypassing Supabase
  // here keeps its cacheable JSON responses free of Set-Cookie headers.
  if (request.nextUrl.pathname.startsWith("/api/mobile/")) {
    return NextResponse.next();
  }

  return await updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|cdn-cgi|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff|woff2|js|css)$).*)",
  ],
};

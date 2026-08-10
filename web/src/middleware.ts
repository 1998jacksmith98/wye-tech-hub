import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  // Auth checks happen in requireSession() on app pages.
  // This middleware only ensures /app routes are not statically cached oddly.
  const response = NextResponse.next();
  response.headers.set("x-tech-hub-path", request.nextUrl.pathname);
  return response;
}

export const config = {
  matcher: ["/app/:path*"],
};

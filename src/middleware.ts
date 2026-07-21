import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Basic rate-limit style headers + security headers
export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  // Security headers
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()"
  );
  // Monaco Editor needs blob workers, eval (source maps), and CDN assets
  response.headers.set(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://cdn.jsdelivr.net blob:",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net",
      "font-src 'self' https://fonts.gstatic.com data: https://cdn.jsdelivr.net",
      "img-src 'self' data: blob: http: https:",
      "media-src 'self' blob: http: https:",
      "connect-src 'self' http: https: ws: wss: https://cdn.jsdelivr.net",
      "frame-src 'self' blob: http: https:",
      "worker-src 'self' blob: data:",
      "child-src 'self' blob:",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; ")
  );

  // API rate-limit policy hint (enforced in API via Postgres buckets)
  if (request.nextUrl.pathname.startsWith("/api/")) {
    response.headers.set("X-RateLimit-Policy", "100;w=60");
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

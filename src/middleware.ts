import { NextRequest, NextResponse } from "next/server";
export function middleware(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (["POST", "PUT", "PATCH", "DELETE"].includes(request.method) && origin) {
    // A reverse proxy/container can expose a different origin from Next's
    // internal listener. Prefer the configured public origin; dev falls back
    // to the browser-facing Host header rather than the listener's port.
    const configured = process.env.AEGIS_ALLOWED_ORIGIN || process.env.NEXT_PUBLIC_APP_URL;
    let sameOrigin = false;
    try {
      const expected = configured ? new URL(configured).origin : `${request.nextUrl.protocol}//${request.headers.get("host") ?? request.nextUrl.host}`;
      sameOrigin = new URL(origin).origin === expected;
    } catch { /* malformed origins are denied */ }
    if (!sameOrigin) return NextResponse.json({ error: "Cross-origin mutation denied" }, { status: 403 });
  }
  const response = NextResponse.next();
  response.headers.set("Referrer-Policy", "no-referrer");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  if (request.nextUrl.pathname.startsWith("/api/") || request.nextUrl.pathname.startsWith("/onboarding/")) response.headers.set("Cache-Control", "no-store");
  return response;
}
export const config = { matcher: ["/api/:path*", "/admin/:path*", "/onboarding/:path*"] };

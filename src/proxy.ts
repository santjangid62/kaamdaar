import { NextResponse, type NextRequest } from "next/server";

const FLUTTER_WEB_ORIGINS = new Set([
  "http://127.0.0.1:4101",
  "http://127.0.0.1:4102",
  "http://localhost:4101",
  "http://localhost:4102",
]);

function corsHeaders(origin: string): Headers {
  return new Headers({
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "600",
    Vary: "Origin",
  });
}

export function proxy(request: NextRequest) {
  const origin = request.headers.get("origin") ?? "";
  if (!FLUTTER_WEB_ORIGINS.has(origin)) return NextResponse.next();

  const headers = corsHeaders(origin);
  if (request.method === "OPTIONS") {
    return new NextResponse(null, { status: 204, headers });
  }

  const response = NextResponse.next();
  headers.forEach((value, key) => response.headers.set(key, value));
  return response;
}

export const config = {
  matcher: "/api/:path*",
};

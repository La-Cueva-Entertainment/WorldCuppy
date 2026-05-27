import type { NextRequest } from "next/server";
import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";

// Dynamically derive NEXTAUTH_URL from the incoming request so sign-in
// works from any host — localhost, local IP, or the production domain.
// In production NEXTAUTH_URL is set explicitly via Docker env; this only
// runs when that env var is absent or matches localhost.
function handler(req: NextRequest) {
  const explicitUrl = process.env.NEXTAUTH_URL;
  if (!explicitUrl || explicitUrl.includes("localhost")) {
    const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
    const proto =
      req.headers.get("x-forwarded-proto") ??
      (host?.startsWith("192.168") || host?.startsWith("10.") || host?.startsWith("172.")
        ? "http"
        : "https");
    if (host) process.env.NEXTAUTH_URL = `${proto}://${host}`;
  }
  return NextAuth(authOptions)(req as never, {} as never);
}

export { handler as GET, handler as POST };

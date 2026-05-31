import type { NextRequest } from "next/server";
import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";

// Dynamically derive NEXTAUTH_URL from the incoming request so sign-in
// works from any host — localhost, local IP, or the production domain.
// In production NEXTAUTH_URL is set explicitly via Docker env; this only
// runs when that env var is absent or matches localhost.
const PRIVATE_IP = /^(localhost|127\.|192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[01])\.)/;
// Allow only valid hostname[:port] values — prevents arbitrary string injection into NEXTAUTH_URL.
const SAFE_HOST = /^[a-zA-Z0-9][a-zA-Z0-9\-\.]*[a-zA-Z0-9](:\d{1,5})?$/;

function handler(req: NextRequest, ctx: unknown) {
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "";
  const explicitUrl = process.env.NEXTAUTH_URL;

  // Only override NEXTAUTH_URL in dev (when it points to localhost or is unset).
  // In production set NEXTAUTH_URL explicitly in Docker env and this branch never runs.
  // Private IPs and malformed host values are rejected to prevent host-header injection.
  if (
    SAFE_HOST.test(host) &&
    !PRIVATE_IP.test(host) &&
    (!explicitUrl || explicitUrl.includes("localhost"))
  ) {
    const proto = req.headers.get("x-forwarded-proto") ?? "https";
    process.env.NEXTAUTH_URL = `${proto}://${host}`;
  }

  return NextAuth(authOptions)(req as never, ctx as never);
}

export { handler as GET, handler as POST };

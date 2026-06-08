import type { NextAuthOptions } from "next-auth";
import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { compare } from "bcryptjs";

import { prisma } from "@/lib/prisma";

// ── In-memory brute-force protection ─────────────────────────────────────────
// Tracks failed login attempts per email address. Blocks after MAX_ATTEMPTS
// failures within WINDOW_MS. Resets on a successful login.
// NOTE: this state resets on container restart — Cloudflare rate-limiting rules
// are the primary defence for a self-hosted deployment.
const MAX_ATTEMPTS = 10;
const WINDOW_MS = 15 * 60 * 1000;   // 15 min sliding window
const BLOCK_MS  = 15 * 60 * 1000;   // 15 min block after lockout

type RateEntry = { count: number; firstAt: number; blockedUntil: number };
const loginAttempts = new Map<string, RateEntry>();

/** Returns true if the attempt is allowed, false if it should be blocked. */
function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const entry = loginAttempts.get(key);
  if (!entry) {
    loginAttempts.set(key, { count: 1, firstAt: now, blockedUntil: 0 });
    return true;
  }
  if (entry.blockedUntil > now) return false;       // still blocked
  if (now - entry.firstAt > WINDOW_MS) {            // window expired — reset
    loginAttempts.set(key, { count: 1, firstAt: now, blockedUntil: 0 });
    return true;
  }
  entry.count += 1;
  if (entry.count > MAX_ATTEMPTS) {
    entry.blockedUntil = now + BLOCK_MS;
    return false;
  }
  return true;
}

/** Clear the rate-limit counter after a successful login. */
function clearRateLimit(key: string) {
  loginAttempts.delete(key);
}

const providers: NextAuthOptions["providers"] = [
  CredentialsProvider({
    name: "Email and Password",
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Password", type: "password" },
    },
    async authorize(credentials) {
      const email = credentials?.email?.toLowerCase().trim();
      const password = credentials?.password;

      if (!email || !password) return null;

      // Rate-limit by normalised email
      if (!checkRateLimit(email)) return null;

      const user = await prisma.user.findUnique({
        where: { email },
      });

      if (!user?.passwordHash) return null;

      const passwordValid = await compare(password, user.passwordHash);
      if (!passwordValid) return null;

      // Successful login — clear the counter
      clearRateLimit(email);

      return {
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.image,
      };
    },
  }),
];

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  providers.unshift(
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    })
  );
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers,
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  events: {},
  callbacks: {
    async redirect({ url, baseUrl }) {
      // Relative paths are always safe — resolve against baseUrl
      if (url.startsWith("/")) return `${baseUrl}${url}`;
      // Same origin as baseUrl — allow
      if (url.startsWith(baseUrl)) return url;
      // Extract just the path and resolve against the current baseUrl.
      // This handles the case where callbackUrl was built against a different
      // host (e.g. localhost) but the user is accessing via the LAN IP.
      try {
        const { pathname, search } = new URL(url);
        return `${baseUrl}${pathname}${search}`;
      } catch {
        return baseUrl;
      }
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
};

export const nextAuthHandler = NextAuth(authOptions);

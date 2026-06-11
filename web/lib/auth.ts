import type { NextAuthOptions } from "next-auth";
import NextAuth, { getServerSession } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { compare } from "bcryptjs";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { isSiteOwner } from "@/lib/siteOwner";

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

      const user = await prisma.user.findUnique({
        where: { email },
      });

      if (!user?.passwordHash) return null;

      const passwordValid = await compare(password, user.passwordHash);
      if (!passwordValid) return null;

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
    maxAge: 24 * 60 * 60, // 24 hours
  },
  events: {},
  callbacks: {
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

/** Returns the current user's ID or redirects to /login. Use in server components and server actions. */
export async function requireUserId(): Promise<string> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  return session.user.id;
}

/** Returns the current user's ID if they are an admin, or redirects. */
export async function requireAdmin(): Promise<string> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  const uid = session.user.id;
  const siteOwner = isSiteOwner(session);
  const user = await prisma.user.findUnique({
    where: { id: uid },
    select: { isAdmin: true },
  });
  if (!user?.isAdmin && !siteOwner) redirect("/dashboard");
  return uid;
}

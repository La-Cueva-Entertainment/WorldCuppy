import type { NextAuthOptions } from "next-auth";
import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { compare } from "bcryptjs";

import { prisma } from "@/lib/prisma";

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
    strategy: "database",
  },
  events: {
    async createUser({ user }) {
      const email = user.email?.toLowerCase().trim();
      if (!email) return;

      const invites = await prisma.leagueInvite.findMany({
        where: {
          email,
          acceptedAt: null,
          league: { deletedAt: null },
        },
        select: { id: true, leagueId: true },
      });

      if (invites.length === 0) return;

      await prisma.$transaction([
        ...invites.map((inv) =>
          prisma.leagueMember.upsert({
            where: {
              leagueId_userId: {
                leagueId: inv.leagueId,
                userId: user.id,
              },
            },
            update: {},
            create: {
              leagueId: inv.leagueId,
              userId: user.id,
              role: "member",
            },
          })
        ),
        ...invites.map((inv) =>
          prisma.leagueInvite.update({
            where: { id: inv.id },
            data: { acceptedAt: new Date() },
          })
        ),
        prisma.user.updateMany({
          where: { id: user.id, activeLeagueId: null },
          data: { activeLeagueId: invites[0].leagueId },
        }),
      ]);
    },
  },
  callbacks: {
    async session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
      }
      return session;
    },
  },
};

export const nextAuthHandler = NextAuth(authOptions);

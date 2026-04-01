import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Image from "next/image";
import Link from "next/link";
import { getServerSession } from "next-auth";
import "./globals.css";

import { AuthButtons } from "@/components/AuthButtons";
import { SoccerFieldBanner } from "@/components/SoccerFieldBanner";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isSiteOwner } from "@/lib/siteOwner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "World Cuppy",
  description: "World Cuppy friend pool game",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getServerSession(authOptions);
  const siteOwner = session ? isSiteOwner(session) : false;

  let picksCount: number | null = null;
  let isAdmin = false;

  if (session) {
    let userId: string | undefined = session.user.id;
    if (!userId) {
      const email = session.user.email?.toLowerCase().trim();
      if (email) {
        const user = await prisma.user.findUnique({
          where: { email },
          select: { id: true },
        });
        userId = user?.id;
      }
    }

    if (userId) {
      const [user, activeTournament] = await Promise.all([
        prisma.user.findUnique({ where: { id: userId }, select: { isAdmin: true } }),
        prisma.tournament.findFirst({
          where: { status: { in: ["draft", "active"] } },
          orderBy: { createdAt: "desc" },
          select: { id: true, teamsPerPlayer: true },
        }),
      ]);

      isAdmin = user?.isAdmin ?? false;

      if (activeTournament) {
        picksCount = await prisma.lineupPick.count({
          where: { userId, tournamentId: activeTournament.id },
        });
      }
    }
  }

  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        style={{ background: "var(--background)", color: "var(--foreground)" }}
      >
        <div className="relative min-h-screen">
          {/* Ambient glow */}
          <div className="pointer-events-none fixed inset-0 overflow-hidden">
            <div className="absolute -top-40 left-1/2 h-96 w-[52rem] -translate-x-1/2 rounded-full bg-green-500/15 blur-3xl" />
            <div className="absolute top-1/2 right-[-12rem] h-80 w-[42rem] rounded-full bg-amber-400/8 blur-3xl" />
          </div>

          {/* Nav */}
          <div className="relative overflow-hidden border-b border-white/10 bg-black/30 backdrop-blur-md">
            <div className="pointer-events-none absolute inset-0">
              <SoccerFieldBanner className="absolute inset-0 h-full w-full text-green-400 opacity-[0.07]" />
            </div>
            <div className="relative mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-6 py-3">
              <Link
                href="/"
                aria-label="World Cuppy home"
                className="flex items-center gap-2 rounded-full px-1 py-1 text-sm font-bold tracking-tight text-white hover:opacity-90"
              >
                <Image
                  src="/world-cuppy-ball.png?v=2026"
                  alt=""
                  width={28}
                  height={28}
                  priority
                  className="rounded-full ring-1 ring-white/20"
                />
                <span className="hidden sm:inline">World Cuppy</span>
              </Link>

              {session && (
                <nav className="hidden items-center gap-1 md:flex">
                  <Link href="/dashboard" className="rounded-lg px-3 py-1.5 text-sm font-medium text-zinc-200 hover:bg-white/10 hover:text-white">
                    Standings
                  </Link>
                  <Link href="/draft" className="rounded-lg px-3 py-1.5 text-sm font-medium text-zinc-200 hover:bg-white/10 hover:text-white">
                    Draft
                  </Link>
                  {(isAdmin || siteOwner) && (
                    <Link href="/admin" className="rounded-lg px-3 py-1.5 text-sm font-medium text-amber-300 hover:bg-amber-400/10 hover:text-amber-200">
                      Admin
                    </Link>
                  )}
                </nav>
              )}

              <AuthButtons
                signedIn={Boolean(session)}
                picksCount={picksCount}
                isAdmin={isAdmin || siteOwner}
              />
            </div>
            <div className="h-0.5 bg-gradient-to-r from-green-400/60 via-yellow-300/40 to-transparent" />
          </div>

          <div className="relative">{children}</div>
        </div>
      </body>
    </html>
  );
}

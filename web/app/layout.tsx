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
import { TEAMS } from "@/lib/teams";

const MANAGERS_PER_LEAGUE = 8;
const LINEUP_SIZE = Math.max(1, Math.ceil(TEAMS.length / MANAGERS_PER_LEAGUE));

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
  description: "World Cuppy game",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getServerSession(authOptions);
  const siteOwner = session ? isSiteOwner(session) : false;

  let leagues: { id: string; name: string }[] | undefined;
  let activeLeagueId: string | null | undefined;
  let activeLeagueName: string | null | undefined;

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
      const memberships = await prisma.leagueMember.findMany({
        where: { userId, league: { deletedAt: null } },
        include: { league: { select: { id: true, name: true } } },
        orderBy: { createdAt: "asc" },
      });

      leagues = memberships.map((m) => m.league);

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { activeLeagueId: true },
      });

      activeLeagueId = user?.activeLeagueId ?? null;

      // If activeLeagueId points to a deleted league (or one you no longer have),
      // fall back to the first available league and persist it.
      const activeStillValid = Boolean(
        activeLeagueId && leagues.some((l) => l.id === activeLeagueId)
      );
      if (!activeStillValid) {
        activeLeagueId = leagues[0]?.id ?? null;
        await prisma.user.update({
          where: { id: userId },
          data: { activeLeagueId },
        });
      }

      activeLeagueName =
        leagues.find((l) => l.id === activeLeagueId)?.name ??
        leagues[0]?.name ??
        null;

      // Header HUD: budget/picks for active league.
      // Keep this lightweight and scoped to the signed-in user.
    }
  }

  let picksCount: number | null = null;
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

    if (userId && activeLeagueId) {
      const count = await prisma.lineupPick.count({
        where: { userId, leagueId: activeLeagueId },
      });
      picksCount = Math.min(LINEUP_SIZE, count);
    }
  }

  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-zinc-950 text-zinc-50`}
      >
        <div className="relative min-h-screen">
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-b from-zinc-950 via-zinc-950 to-zinc-900" />
            <div className="absolute -top-40 left-1/2 h-80 w-[42rem] -translate-x-1/2 rounded-full bg-emerald-500/10 blur-3xl" />
            <div className="absolute -bottom-48 right-[-10rem] h-80 w-[42rem] rounded-full bg-emerald-500/5 blur-3xl" />
          </div>

          <div className="relative overflow-hidden border-b border-white/15 bg-zinc-950/40 backdrop-blur ring-1 ring-inset ring-white/10">
            <div className="pointer-events-none absolute inset-0">
              <SoccerFieldBanner className="absolute inset-0 h-full w-full text-emerald-300 opacity-10 blur-[1px]" />
              <div className="absolute inset-0 bg-gradient-to-b from-zinc-950/0 via-zinc-950/20 to-zinc-950/45" />
            </div>
            <div className="relative mx-auto grid w-full max-w-7xl grid-cols-[auto,1fr,auto] items-center gap-4 px-6 py-3">
              <div aria-hidden="true" className="h-[34px] w-[34px]" />

              {session && activeLeagueName ? (
                <div className="hidden justify-center md:flex">
                  <Link
                    href="/"
                    className="inline-flex items-center gap-2 rounded-full bg-emerald-400/10 px-3 py-1.5 text-xs font-semibold text-emerald-50 ring-1 ring-inset ring-emerald-400/20 hover:bg-emerald-400/15"
                    title="Home"
                  >
                    <span aria-hidden="true">🏆</span>
                    <span>{activeLeagueName} League</span>
                  </Link>
                </div>
              ) : (
                <div />
              )}

              <div className="flex items-center gap-2">
                {siteOwner ? (
                  <Link
                    href="/maintenance"
                    className="inline-flex h-9 items-center rounded-xl bg-amber-400/10 px-3 text-xs font-semibold text-amber-50 ring-1 ring-inset ring-amber-300/20 hover:bg-amber-400/15"
                  >
                    Maintenance
                  </Link>
                ) : null}

                <AuthButtons
                  signedIn={Boolean(session)}
                  leagues={leagues}
                  activeLeagueId={activeLeagueId}
                  activeLeagueName={activeLeagueName}
                  picksCount={picksCount}
                />
              </div>
            </div>

            <Link
              href="/"
              aria-label="World Cuppy home"
              className="absolute bottom-2 right-6 z-10 inline-flex max-w-[70%] items-center gap-2 rounded-full bg-zinc-950/25 px-2 py-1 text-sm font-semibold tracking-tight text-white/90 drop-shadow backdrop-blur-sm ring-1 ring-inset ring-white/10 md:text-base"
              title="Home"
            >
              <Image
                src="/world-cuppy-ball.png?v=2026-02-21"
                alt=""
                width={26}
                height={26}
                priority
                className="rounded-full bg-white/5 ring-1 ring-inset ring-white/15"
              />
              <span className="truncate">World Cuppy</span>
            </Link>
            <div className="h-0.5 w-full bg-gradient-to-r from-amber-300/80 via-yellow-200/50 to-transparent" />
          </div>

          <div className="relative">{children}</div>
        </div>
      </body>
    </html>
  );
}

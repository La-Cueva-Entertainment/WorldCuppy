import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import Image from "next/image";
import { getServerSession } from "next-auth";
import "./globals.css";

import { AuthButtons } from "@/components/AuthButtons";
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
  description: "International Fantasy Fútbol - Draft Nations",
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
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-white text-zinc-900`}
      >
        <div className="min-h-screen">
          {/* Nav */}
          <div className="sticky top-0 z-30 bg-zinc-900" style={{ backgroundColor: '#18181b' }}>
            <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-6 py-3">
              <Link
                href="/"
                aria-label="World Cuppy home"
                className="flex items-center gap-2"
              >
                <Image src="/wcball2.png" alt="" width={56} height={56} className="transition-transform duration-200 hover:rotate-12 hover:scale-110" />
                <span className="hidden text-lg font-bold text-white sm:inline">
                  World <span className="text-yellow-400">Cuppy</span>
                </span>
              </Link>

              {session && (
                <nav className="hidden items-center gap-1 md:flex">
                  <Link href="/dashboard" className="rounded-lg px-3 py-1.5 text-sm font-medium text-white/80 transition-colors hover:bg-white/10 hover:text-white">
                    Standings
                  </Link>
                  <Link href="/draft" className="rounded-lg px-3 py-1.5 text-sm font-medium text-white/80 transition-colors hover:bg-white/10 hover:text-white">
                    Draft
                  </Link>
                  <Link href="/preview" className="rounded-lg px-3 py-1.5 text-sm font-medium text-white/80 transition-colors hover:bg-white/10 hover:text-white">
                    Preview
                  </Link>
                  {(isAdmin || siteOwner) && (
                    <Link href="/admin" className="rounded-lg px-3 py-1.5 text-sm font-medium text-yellow-300 transition-colors hover:bg-white/10 hover:text-yellow-200">
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
          </div>

          <div>{children}</div>
        </div>
      </body>
    </html>
  );
}

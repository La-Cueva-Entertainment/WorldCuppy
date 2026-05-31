import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import Image from "next/image";
import { getServerSession } from "next-auth";
import "./globals.css";

import { AuthButtons } from "@/components/AuthButtons";
import { MobileNav } from "@/components/MobileNav";
import { NavLink } from "@/components/NavLink";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import { ThemeToggle } from "@/components/ThemeToggle";
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
  metadataBase: new URL(process.env.NEXTAUTH_URL ?? "https://worldcuppy.lacueva.us"),
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
      <head>
        {/* Apply stored theme before first paint to avoid flash */}
        <script dangerouslySetInnerHTML={{ __html: `
          try {
            var t = localStorage.getItem('theme') ?? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
            document.documentElement.classList.toggle('dark', t === 'dark');
          } catch(e) {}
        `}} />
        <link rel="manifest" href="/manifest.webmanifest" />
        <meta name="theme-color" content="#18181b" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="World Cuppy" />
        <link rel="apple-touch-icon" href="/wcball-icon.png" />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <ServiceWorkerRegister />
        <div className="min-h-screen">
          {/* Nav — always dark */}
          <div className="sticky top-0 z-30 bg-zinc-900">
            <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-6 py-1">
              <Link
                href="/"
                aria-label="World Cuppy home"
                className="flex items-center gap-2"
              >
                <Image src="/wcball.png" alt="" width={88} height={88} className="transition-transform duration-200 hover:rotate-12 hover:scale-110" />
                <span className="text-base font-bold text-white sm:text-lg">
                  World <span className="text-yellow-400">Cuppy</span>
                </span>
              </Link>

              {session && (
                <nav className="hidden items-center gap-1 md:flex">
                  <NavLink href="/" exact>Home</NavLink>
                  <NavLink href="/standings">Standings</NavLink>
                  <NavLink href="/draft">Draft</NavLink>
                  {(isAdmin || siteOwner) && (
                    <NavLink href="/preview">Preview</NavLink>
                  )}
                  {(isAdmin || siteOwner) && (
                    <Link href="/admin" className="rounded-lg px-3 py-1.5 text-sm font-medium text-yellow-300 transition-colors hover:bg-white/10 hover:text-yellow-200">
                      Admin
                    </Link>
                  )}
                </nav>
              )}

              <div className="flex items-center gap-2">
                <ThemeToggle />
                <AuthButtons
                  signedIn={Boolean(session)}
                  picksCount={picksCount}
                  isAdmin={isAdmin || siteOwner}
                />
                {session && (
                  <MobileNav isAdmin={isAdmin || siteOwner} picksCount={picksCount} />
                )}
              </div>
            </div>
          </div>

          <div>{children}</div>
        </div>
      </body>
    </html>
  );
}

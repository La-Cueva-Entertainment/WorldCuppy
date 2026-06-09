import type { Metadata, Viewport } from "next";
import { Archivo, Hanken_Grotesk, Spline_Sans_Mono } from "next/font/google";
import Link from "next/link";
import { getServerSession } from "next-auth";
import "./globals.css";

import { MobileNav } from "@/components/MobileNav";
import { NavLink } from "@/components/NavLink";
import { BanterNavBtn } from "@/components/BanterNavBtn";
import { SignOutButton } from "@/components/SignOutButton";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import { ThemeToggle } from "@/components/ThemeToggle";
import { PresenceTracker } from "@/components/PresenceTracker";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isSiteOwner } from "@/lib/siteOwner";

const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
});

const hanken = Hanken_Grotesk({
  variable: "--font-hanken",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const splineMono = Spline_Sans_Mono({
  variable: "--font-spline",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXTAUTH_URL ?? "https://worldcuppy.lacueva.us"),
  title: "World Cuppy",
  description: "International Fantasy Fútbol - Draft Nations",
  icons: {
    icon: [
      { url: "/icon/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icon/favicon-16.png", sizes: "16x16", type: "image/png" },
      { url: "/icon/worldcuppy-icon.svg", type: "image/svg+xml" },
    ],
    apple: "/icon/apple-touch-icon.png",
  },
};

/** Brand trophy mark — worldcuppy-mark.svg rendered inline */
function BallMark() {
  return (
    <span
      aria-hidden="true"
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 36,
        height: 36,
        borderRadius: 10,
        background: "linear-gradient(160deg,#1a8a4e,#0c5e34)",
        flexShrink: 0,
      }}
    >
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="#f0d98a" width="24" height="24" aria-hidden="true">
        <rect x="12.5" y="6.5" width="23" height="4.6" rx="1.7"/>
        <path d="M14 11.5 H34 V16 C34 24.5 29.4 28.5 24 28.5 C18.6 28.5 14 24.5 14 16 Z"/>
        <path d="M14.2 13 C7 13 7 21.5 14.8 21.5" fill="none" stroke="#f0d98a" strokeWidth="3"/>
        <path d="M33.8 13 C41 13 41 21.5 33.2 21.5" fill="none" stroke="#f0d98a" strokeWidth="3"/>
        <rect x="22.1" y="28" width="3.8" height="4.4"/>
        <rect x="17.5" y="32" width="13" height="3" rx="1.2"/>
        <path d="M15 41.5 L17.2 35.5 H30.8 L33 41.5 Z"/>
      </svg>
    </span>
  );
}

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
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Apply stored theme before first paint to avoid flash */}
        <script dangerouslySetInnerHTML={{ __html: `
          try {
            var t = localStorage.getItem('wc_theme') ?? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
            document.documentElement.classList.toggle('dark', t === 'dark');
          } catch(e) {}
        `}} />
        {/* Reload on stale deployment: if a /_next/ CSS/JS chunk 404s after a redeploy, force a full reload to pick up the new build's asset hashes */}
        <script dangerouslySetInnerHTML={{ __html: `
          (function(){
            var _reloaded = false;
            window.addEventListener('error', function(e) {
              if (_reloaded) return;
              var el = e.target;
              if (el && (el.tagName === 'LINK' || el.tagName === 'SCRIPT')) {
                var src = el.href || el.src || '';
                if (src.indexOf('/_next/') !== -1) {
                  _reloaded = true;
                  window.location.reload();
                }
              }
            }, true);
          })();
        `}} />
        <link rel="manifest" href="/manifest.webmanifest" />
        <meta name="theme-color" content="#0c5e34" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="World Cuppy" />
        <link rel="icon" type="image/svg+xml" href="/icon/worldcuppy-icon.svg" />
        <link rel="icon" type="image/png" sizes="32x32" href="/icon/favicon-32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/icon/favicon-16.png" />
        <link rel="apple-touch-icon" href="/icon/apple-touch-icon.png" />
      </head>
      <body className={`${archivo.variable} ${hanken.variable} ${splineMono.variable}`}>
        <ServiceWorkerRegister />
        {session && <PresenceTracker />}

        {/* ── Top nav ───────────────────────────────────── */}
        <header className="nav">
          <div className="nav-in">
            {/* Brand */}
            <Link href="/" aria-label="World Cuppy home" className="nav-brand">
              <BallMark />
              <span className="wm">World<b>Cuppy</b></span>
            </Link>

            {/* Desktop nav links */}
            {session && (
              <nav className="nav-links">
                <NavLink href="/" exact>Home</NavLink>
                <NavLink href="/standings">Standings</NavLink>
                <NavLink href="/draft">Draft</NavLink>
                <NavLink href="/lineup">My Teams</NavLink>
                <NavLink href="/banter">Banter</NavLink>
                <NavLink href="/news">News</NavLink>
                {(isAdmin || siteOwner) && (
                  <NavLink href="/admin" className="adm">Admin</NavLink>
                )}
              </nav>
            )}

            <div className="nav-spacer" />

            {/* Right cluster */}
            <div className="nav-right">
              <ThemeToggle />
              {session ? (
                <>
                  <Link
                    href="/profile"
                    aria-label="My profile"
                    className="nav-avatar"
                    title={session.user.name ?? session.user.email ?? "Profile"}
                  >
                    {(session.user.name ?? session.user.email ?? "?")[0].toUpperCase()}
                  </Link>
                  <SignOutButton />
                  <BanterNavBtn />
                  <MobileNav isAdmin={isAdmin || siteOwner} picksCount={picksCount} />
                </>
              ) : (
                <Link href="/login" className="btn btn-primary btn-sm">Sign in</Link>
              )}
            </div>
          </div>
        </header>

        <div>{children}</div>
      </body>
    </html>
  );
}

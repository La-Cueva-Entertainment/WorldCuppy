import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function Home() {
  const session = await getServerSession(authOptions);
  if (session) redirect("/dashboard");

  const playerCount = await prisma.user.count().catch(() => 0);

  return (
    <div className="relative flex min-h-[90vh] flex-col items-center justify-center overflow-hidden text-center">
      {/* Hero background */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url('/hero.jpg')" }}
      />
      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/40 to-black/70" />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center px-6 py-20">
        <div className="mb-4 text-7xl drop-shadow-lg">⚽</div>

        <h1 className="text-5xl font-extrabold tracking-tight text-white drop-shadow-lg md:text-7xl">
          World <span className="text-green-400">Cuppy</span>
        </h1>

        <p className="mt-5 max-w-xl text-lg text-white/85 drop-shadow md:text-xl">
          Draft 6 nations from the 48-team World Cup field. Earn real money for wins, goals, and upsets.
          Follow the bracket live with your friends.
        </p>

        <div className="mt-8 flex flex-wrap justify-center gap-3 text-sm">
          <div className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-white backdrop-blur-sm">
            🏆 6 teams per player
          </div>
          <div className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-white backdrop-blur-sm">
            🐍 Snake draft
          </div>
          <div className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-white backdrop-blur-sm">
            💰 Live earnings
          </div>
          {playerCount > 0 && (
            <div className="rounded-full border border-green-400/40 bg-green-500/20 px-4 py-2 text-green-300 backdrop-blur-sm">
              {playerCount} players registered
            </div>
          )}
        </div>

        <div className="mt-10 flex flex-wrap justify-center gap-4">
          <Link
            href="/login"
            className="inline-flex h-12 items-center rounded-2xl bg-green-500 px-8 text-base font-bold text-white shadow-lg hover:bg-green-400 transition-colors"
          >
            Sign in
          </Link>
          <Link
            href="/register"
            className="inline-flex h-12 items-center rounded-2xl border border-white/30 bg-white/10 px-8 text-base font-semibold text-white backdrop-blur-sm shadow-lg hover:bg-white/20 transition-colors"
          >
            Create account
          </Link>
          <Link
            href="/preview"
            className="inline-flex h-12 items-center rounded-2xl border border-emerald-400/40 bg-emerald-500/20 px-8 text-base font-semibold text-emerald-300 backdrop-blur-sm shadow-lg hover:bg-emerald-500/30 transition-colors"
          >
            👀 Preview
          </Link>
        </div>
      </div>
    </div>
  );
}

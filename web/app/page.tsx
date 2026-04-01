import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function Home() {
  const session = await getServerSession(authOptions);
  if (session) redirect("/dashboard");

  // Count registered players for the teaser
  const playerCount = await prisma.user.count().catch(() => 0);

  return (
    <div className="flex min-h-[80vh] flex-col items-center justify-center px-6 py-20 text-center">
      <div className="mb-6 text-6xl">⚽</div>

      <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 md:text-6xl">
        World{" "}
        <span className="text-green-600">Cuppy</span>
      </h1>

      <p className="mt-4 max-w-lg text-lg text-slate-500">
        Draft 6 nations from the 48-team World Cup field. Earn real money for wins, goals, and upsets.
        Follow the bracket live with your friends.
      </p>

      <div className="mt-8 flex flex-wrap justify-center gap-3 text-sm">
        <div className="rounded-full border border-slate-200 bg-white px-4 py-2 text-slate-600 shadow-sm">
          🏆 6 teams per player
        </div>
        <div className="rounded-full border border-slate-200 bg-white px-4 py-2 text-slate-600 shadow-sm">
          🐍 Snake draft
        </div>
        <div className="rounded-full border border-slate-200 bg-white px-4 py-2 text-slate-600 shadow-sm">
          💰 Live earnings
        </div>
        {playerCount > 0 && (
          <div className="rounded-full border border-green-200 bg-green-50 px-4 py-2 text-green-700">
            {playerCount} players registered
          </div>
        )}
      </div>

      <div className="mt-10 flex flex-wrap justify-center gap-4">
        <Link
          href="/login"
          className="inline-flex h-12 items-center rounded-2xl bg-green-600 px-8 text-base font-bold text-white shadow-sm hover:bg-green-700"
        >
          Sign in
        </Link>
        <Link
          href="/register"
          className="inline-flex h-12 items-center rounded-2xl border border-slate-200 bg-white px-8 text-base font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
        >
          Create account
        </Link>
        <Link
          href="/preview"
          className="inline-flex h-12 items-center rounded-2xl border border-emerald-200 bg-emerald-50 px-8 text-base font-semibold text-emerald-700 shadow-sm hover:bg-emerald-100"
        >
          👀 Preview
        </Link>
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";

export function AuthButtons({
  signedIn,
  picksCount,
  isAdmin,
}: {
  signedIn: boolean;
  picksCount?: number | null;
  isAdmin?: boolean;
}) {
  if (signedIn) {
    return (
      <div className="flex items-center gap-2">
        {typeof picksCount === "number" && (
          <span className="hidden rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200 md:inline">
            {picksCount} picks
          </span>
        )}

        <Link
          href="/lineup"
          className="inline-flex h-9 items-center rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700"
        >
          My Lineup
        </Link>

        {/* Mobile nav links */}
        <Link
          href="/dashboard"
          className="inline-flex h-9 items-center rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 md:hidden"
        >
          Standings
        </Link>

        {isAdmin && (
          <Link
            href="/admin"
            className="inline-flex h-9 items-center rounded-xl border border-amber-300 bg-amber-50 px-3 text-xs font-medium text-amber-700 transition-colors hover:bg-amber-100 md:hidden"
          >
            Admin
          </Link>
        )}

        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/" })}
          className="inline-flex h-9 items-center rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100"
        >
          Sign Out
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <Link
        href="/login"
        className="inline-flex h-9 items-center rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700"
      >
        Sign in
      </Link>
    </div>
  );
}

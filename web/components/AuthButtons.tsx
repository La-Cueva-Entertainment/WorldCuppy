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
          <span className="hidden rounded-full bg-green-500/15 px-3 py-1 text-xs font-semibold text-green-300 ring-1 ring-green-500/30 md:inline">
            {picksCount} picks
          </span>
        )}

        {/* Mobile nav links */}
        <Link
          href="/dashboard"
          className="inline-flex h-9 items-center rounded-xl bg-white/5 px-3 text-xs font-medium text-zinc-100 ring-1 ring-inset ring-white/10 hover:bg-white/10 md:hidden"
        >
          Standings
        </Link>

        {isAdmin && (
          <Link
            href="/admin"
            className="inline-flex h-9 items-center rounded-xl bg-amber-400/10 px-3 text-xs font-medium text-amber-200 ring-1 ring-inset ring-amber-400/20 hover:bg-amber-400/15 md:hidden"
          >
            Admin
          </Link>
        )}

        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/" })}
          className="inline-flex h-9 items-center rounded-xl bg-white/5 px-3 text-xs font-medium text-zinc-100 ring-1 ring-inset ring-white/10 hover:bg-white/10"
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
        className="inline-flex h-9 items-center rounded-xl bg-green-500/15 px-4 text-sm font-semibold text-green-300 ring-1 ring-green-500/30 hover:bg-green-500/20"
      >
        Sign in
      </Link>
    </div>
  );
}

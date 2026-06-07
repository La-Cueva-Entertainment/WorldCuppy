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
          <span className="hidden rounded-full bg-emerald-100 dark:bg-emerald-500/20 px-3 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-200 md:inline">
            {picksCount} picks
          </span>
        )}

        <Link
          href="/profile"
          className="inline-flex h-9 items-center whitespace-nowrap rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700"
        >
          My Profile
        </Link>

        <button
          type="button"
          onClick={async () => { await signOut({ redirect: false }); window.location.href = "/"; }}
          className="hidden md:inline-flex h-9 items-center rounded-xl border border-white/20 bg-white/10 px-3 text-xs font-medium text-white transition-colors hover:bg-white/20"
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
        className="inline-flex h-9 items-center rounded-xl border border-white/40 bg-white/10 px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-white/20"
      >
        Sign in
      </Link>
    </div>
  );
}

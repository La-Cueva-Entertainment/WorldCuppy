"use client";

import { useRouter } from "next/navigation";

const VIEWS = [
  { value: "home",      label: "Home page" },
  { value: "standings", label: "Standings / Bracket" },
  { value: "draft",     label: "Draft board" },
  { value: "profile",   label: "My Profile" },
  { value: "login",     label: "Login page" },
  { value: "register",  label: "Register page" },
  { value: "news",      label: "News page" },
];

export function PreviewSelector({ currentView }: { currentView: string }) {
  const router = useRouter();

  return (
    <div className="flex items-center gap-3">
      <span className="text-xs font-semibold uppercase tracking-widest text-amber-700 dark:text-amber-400">
        Preview
      </span>
      <select
        value={currentView}
        onChange={(e) => router.push(`/preview?view=${e.target.value}`)}
        className="h-8 rounded-lg border border-amber-300 dark:border-amber-500/40 bg-white dark:bg-zinc-800 px-3 text-sm font-medium text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-amber-400"
      >
        {VIEWS.map((v) => (
          <option key={v.value} value={v.value}>{v.label}</option>
        ))}
      </select>
    </div>
  );
}

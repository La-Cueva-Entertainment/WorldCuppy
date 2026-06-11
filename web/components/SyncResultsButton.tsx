"use client";

import { useState } from "react";

type SyncResult = {
  ok: boolean;
  tournament?: string;
  total?: number;
  created?: number;
  updated?: number;
  skipped?: number;
  unknownTeams?: string[];
  error?: string;
};

export function SyncResultsButton() {
  const [status, setStatus] = useState<"idle" | "loading">("idle");
  const [result, setResult] = useState<SyncResult | null>(null);

  async function sync() {
    setStatus("loading");
    setResult(null);
    try {
      const res = await fetch("/api/sync-results", { method: "POST" });
      const data: SyncResult = await res.json();
      setResult(data);
    } catch {
      setResult({ ok: false, error: "Network error — could not reach sync endpoint" });
    } finally {
      setStatus("idle");
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        onClick={sync}
        disabled={status === "loading"}
        className="inline-flex h-9 items-center gap-2 rounded-xl bg-sky-600 px-4 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-60"
      >
        {status === "loading" ? (
          <>
            <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
            Syncing…
          </>
        ) : (
          <>
            <span aria-hidden>↻</span> Sync from football-data.org
          </>
        )}
      </button>

      {result && (
        result.ok ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-800">
            <span className="font-semibold">{result.tournament}</span>
            {" — "}
            {result.created} created · {result.updated} updated · {result.skipped} skipped
            {" "}
            <span className="text-emerald-600">({result.total} total fixtures)</span>
            {result.unknownTeams && result.unknownTeams.length > 0 && (
              <div className="mt-1 text-xs text-amber-700">
                Unknown teams: {result.unknownTeams.join(", ")}
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-800">
            {result.error}
          </div>
        )
      )}
    </div>
  );
}

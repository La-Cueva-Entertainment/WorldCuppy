"use client";

import { useState } from "react";

export function SyncVenuesButton() {
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [result, setResult] = useState<string | null>(null);

  async function handleSync() {
    setState("loading");
    setResult(null);
    try {
      const res = await fetch("/api/sync-venues", { method: "POST" });
      const data = (await res.json()) as {
        updated?: number;
        total?: number;
        fixtureCount?: number;
        venueCount?: number;
        source?: string;
        requestsRemaining?: number | null;
        unmatchedDbKeys?: string[];
        error?: string;
      };
      if (!res.ok) {
        setState("error");
        setResult(data.error ?? `Error ${res.status}`);
        return;
      }
      setState(data.updated === 0 ? "error" : "done");
      const src = data.source ? ` via ${data.source}` : "";
      const rem = data.requestsRemaining != null ? ` · ${data.requestsRemaining} API calls left today` : "";
      if (data.updated === 0) {
        const dbKeys = data.unmatchedDbKeys?.length
          ? `\nDB keys sample: ${data.unmatchedDbKeys.slice(0, 3).join(", ")}`
          : "";
        setResult(`0 updated — ${data.fixtureCount ?? 0} fixtures, ${data.venueCount ?? 0} venues mapped${src}${rem}${dbKeys}`);
      } else {
        setResult(`Updated ${data.updated}/${data.total} matches from ${data.fixtureCount} fixtures${src}${rem}`);
        setTimeout(() => window.location.reload(), 1500);
      }
    } catch {
      setState("error");
      setResult("Network error");
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={handleSync}
        disabled={state === "loading"}
        className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-sky-600 px-3 text-xs font-semibold text-white hover:bg-sky-700 disabled:opacity-50"
      >
        {state === "loading" ? "Syncing…" : "⟳ Sync Venues"}
      </button>
      {result && (
        <span className={`max-w-xs whitespace-pre-wrap text-right text-[11px] ${state === "error" ? "text-rose-400" : "text-emerald-400"}`}>
          {result}
        </span>
      )}
    </div>
  );
}

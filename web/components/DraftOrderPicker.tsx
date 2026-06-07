"use client";

import { useState } from "react";

export interface DraftPlayer {
  id: string;
  label: string;
}

interface Props {
  tournamentId: string;
  players: DraftPlayer[];
  /** Server action to call. Receives formData with `tournamentId` and `orderUserIds` (JSON array). */
  action: (formData: FormData) => Promise<void>;
  submitLabel?: string;
  /** Extra hidden field name/value pairs to include */
  extras?: Record<string, string>;
}

export default function DraftOrderPicker({ tournamentId, players, action, submitLabel = "Start Draft with This Order", extras }: Props) {
  const [order, setOrder] = useState<DraftPlayer[]>(players);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);

  function moveUp(i: number) {
    if (i === 0) return;
    setOrder((prev) => {
      const a = [...prev];
      [a[i - 1], a[i]] = [a[i], a[i - 1]];
      return a;
    });
  }

  function moveDown(i: number) {
    if (i === order.length - 1) return;
    setOrder((prev) => {
      const a = [...prev];
      [a[i], a[i + 1]] = [a[i + 1], a[i]];
      return a;
    });
  }

  // Drag-and-drop handlers
  function onDragStart(i: number) { setDragIdx(i); }
  function onDragEnter(i: number) { setOverIdx(i); }
  function onDragEnd() {
    if (dragIdx !== null && overIdx !== null && dragIdx !== overIdx) {
      setOrder((prev) => {
        const a = [...prev];
        const [removed] = a.splice(dragIdx, 1);
        a.splice(overIdx, 0, removed);
        return a;
      });
    }
    setDragIdx(null);
    setOverIdx(null);
  }

  return (
    <form
      action={action}
      className="space-y-2"
    >
      <input type="hidden" name="tournamentId" value={tournamentId} />
      <input type="hidden" name="orderUserIds" value={JSON.stringify(order.map((p) => p.id))} />
      {extras && Object.entries(extras).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}

      <ol className="space-y-1">
        {order.map((p, i) => (
          <li
            key={p.id}
            draggable
            onDragStart={() => onDragStart(i)}
            onDragEnter={() => onDragEnter(i)}
            onDragEnd={onDragEnd}
            onDragOver={(e) => e.preventDefault()}
            className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm select-none cursor-grab active:cursor-grabbing transition-colors ${
              overIdx === i && dragIdx !== i
                ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-500/10"
                : "border-zinc-200 dark:border-white/10 bg-white dark:bg-white/5"
            }`}
          >
            <span className="w-5 text-xs font-bold text-zinc-400 dark:text-zinc-500 shrink-0">{i + 1}.</span>
            <span className="flex-1 font-medium text-zinc-900 dark:text-white truncate">{p.label}</span>
            <button
              type="button"
              onClick={() => moveUp(i)}
              disabled={i === 0}
              className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 disabled:opacity-20 px-1"
              title="Move up"
            >▲</button>
            <button
              type="button"
              onClick={() => moveDown(i)}
              disabled={i === order.length - 1}
              className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 disabled:opacity-20 px-1"
              title="Move down"
            >▼</button>
          </li>
        ))}
      </ol>

      <button
        type="submit"
        className="mt-3 h-8 w-full rounded-lg bg-amber-500 px-4 text-sm font-semibold text-white hover:bg-amber-600"
      >
        {submitLabel}
      </button>
    </form>
  );
}

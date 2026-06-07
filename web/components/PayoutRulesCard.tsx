"use client";

import { useState } from "react";
import { type PayoutRules } from "@/lib/earnings";

function fmt(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

interface Props {
  rules: PayoutRules;
  isWorldCup: boolean;
}

export default function PayoutRulesCard({ rules, isWorldCup }: Props) {
  const [open, setOpen] = useState(false);

  const rows: { label: string; value: string; sub?: string }[] = [
    // Group Stage
    { label: "Group: Win", value: fmt(rules.groupWinBase), sub: `+ ${fmt(rules.groupWinGdPer)} per goal diff` },
    { label: "Group: Draw", value: fmt(rules.groupDraw) },
    // Knockout rounds
    ...(isWorldCup ? [{ label: "Round of 32: Win", value: fmt(rules.r32WinBase), sub: `+ ${fmt(rules.r32WinGdPer)} per goal diff` }] : []),
    { label: "Round of 16: Win", value: fmt(rules.r16WinBase), sub: `+ ${fmt(rules.r16WinGdPer)} per goal diff` },
    { label: "Quarter Final: Win", value: fmt(rules.qfWinBase), sub: `+ ${fmt(rules.qfWinGdPer)} per goal diff` },
    {
      label: "Semi Final: Win",
      value: fmt(rules.sfWinBase),
      sub: `+ ${fmt(isWorldCup ? rules.sfWinGdPerWC : rules.sfWinGdPerEuros)} per goal diff`,
    },
    ...(isWorldCup ? [{ label: "3rd Place: Win", value: fmt(rules.thirdWinBase), sub: `+ ${fmt(rules.thirdWinGdPer)} per goal diff` }] : []),
    { label: "Final: Winner 🏆", value: fmt(rules.finalWinnerBase), sub: `+ ${fmt(rules.finalWinnerGoalPer)} per goal scored` },
    { label: "Final: Runner-up", value: fmt(rules.finalRunnerUpBase), sub: `+ ${fmt(rules.finalRunnerUpGoalPer)} per goal scored` },
  ];

  return (
    <div className="rounded-2xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-white/5 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
          💰 How Payouts Work
        </span>
        <svg
          className={`h-4 w-4 text-zinc-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="border-t border-zinc-100 dark:border-white/10 px-4 pb-4 pt-3">
          <p className="mb-3 text-xs text-zinc-500 dark:text-zinc-400">
            You earn money for every match your drafted teams play. Higher-stakes rounds pay more.
          </p>
          <div className="space-y-1">
            {rows.map((row) => (
              <div
                key={row.label}
                className="flex items-baseline justify-between gap-2 rounded-lg px-3 py-2 odd:bg-zinc-50 dark:odd:bg-white/5"
              >
                <div className="min-w-0">
                  <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">{row.label}</span>
                  {row.sub && (
                    <span className="ml-1.5 text-xs text-zinc-400 dark:text-zinc-500">{row.sub}</span>
                  )}
                </div>
                <span className="shrink-0 font-mono text-sm font-bold text-emerald-600 dark:text-emerald-400">
                  {row.value}
                </span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-zinc-400 dark:text-zinc-500">
            Losses earn nothing. Draws only pay out in the group stage.
          </p>
        </div>
      )}
    </div>
  );
}

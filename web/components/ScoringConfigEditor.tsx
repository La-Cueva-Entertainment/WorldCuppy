"use client";

import { useState } from "react";
import { type ScoringConfig } from "@/lib/earnings";

function cents(n: number) {
  return `$${(n / 100).toFixed(2)}`;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-zinc-100 last:border-0">
      <span className="text-sm text-zinc-600">{label}</span>
      <span className="text-sm font-semibold text-zinc-900 tabular-nums">{value}</span>
    </div>
  );
}

function Field({
  label,
  name,
  defaultValue,
  hint,
}: {
  label: string;
  name: string;
  defaultValue: number;
  hint?: string;
}) {
  return (
    <label className="grid gap-0.5">
      <span className="text-xs font-medium text-zinc-600">{label}</span>
      {hint && <span className="text-[11px] text-zinc-400">{hint}</span>}
      <div className="flex items-center gap-1">
        <span className="text-sm text-zinc-400">$</span>
        <input
          type="number"
          name={name}
          defaultValue={(defaultValue / 100).toFixed(2)}
          step="0.01"
          min="0"
          required
          className="h-9 w-24 rounded-lg border border-zinc-300 bg-white px-2 text-sm text-zinc-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
        />
      </div>
    </label>
  );
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-2 mt-5 first:mt-0 text-xs font-semibold uppercase tracking-widest text-zinc-400">
      {children}
    </div>
  );
}

interface Props {
  config: ScoringConfig;
  saveAction: (formData: FormData) => Promise<void>;
}

export function ScoringConfigEditor({ config, saveAction }: Props) {
  const [editing, setEditing] = useState(false);
  const c = config;

  if (!editing) {
    return (
      <div>
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs text-zinc-400">
            Applied to all earnings calculations for this tournament.
          </p>
          <button
            onClick={() => setEditing(true)}
            className="h-8 rounded-lg bg-zinc-100 px-3 text-xs font-medium text-zinc-700 hover:bg-zinc-200"
          >
            Edit rules
          </button>
        </div>

        <div className="mb-5 rounded-xl border border-zinc-100 bg-zinc-50 px-4 py-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-widest text-zinc-400">Prize Pool</div>
              <div className="mt-1 text-sm text-zinc-700">
                Buy-in: <span className="font-semibold">{cents(c.buyInCents)}</span> per player
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-zinc-400 mb-1">Payout split</div>
              {c.prizeTiers.map((t) => (
                <div key={t.place} className="text-sm font-semibold text-zinc-700">
                  {t.place === 1 ? "1st" : t.place === 2 ? "2nd" : t.place === 3 ? "3rd" : `${t.place}th"}`}: {t.pct}%
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid gap-x-8 gap-y-0 sm:grid-cols-2">
          <div>
            <SectionHeader>Group Stage</SectionHeader>
            <Row label="Win" value={cents(c.group.win)} />
            <Row label="Draw" value={cents(c.group.draw)} />
            <Row label="Goal difference (per goal)" value={`${cents(c.group.gdPerGoal)}/goal`} />

            <SectionHeader>Round of 32 &amp; Round of 16</SectionHeader>
            <Row label="Win" value={cents(c.r32r16.win)} />
            <Row label="Goal difference (per goal)" value={`${cents(c.r32r16.gdPerGoal)}/goal`} />

            <SectionHeader>Quarter Final</SectionHeader>
            <Row label="Win" value={cents(c.qf.win)} />
            <Row label="Goal difference (per goal)" value={`${cents(c.qf.gdPerGoal)}/goal`} />
          </div>

          <div>
            <SectionHeader>Semi Final</SectionHeader>
            <Row label="Win" value={cents(c.sf.win)} />
            <Row label="GD per goal (World Cup)" value={`${cents(c.sf.gdPerGoalWc)}/goal`} />
            <Row label="GD per goal (Euros)" value={`${cents(c.sf.gdPerGoalEuros)}/goal`} />

            <SectionHeader>3rd Place (World Cup only)</SectionHeader>
            <Row label="Win" value={cents(c.third.win)} />
            <Row label="Goal difference (per goal)" value={`${cents(c.third.gdPerGoal)}/goal`} />

            <SectionHeader>Final</SectionHeader>
            <Row label="Winner base" value={cents(c.final.winnerBase)} />
            <Row label="Runner-up base" value={cents(c.final.runnerUpBase)} />
            <Row label="Goals multiplier (both)" value={`${cents(c.final.goalsMultiplier)}/goal`} />

            <SectionHeader>Odds Jump Bonus</SectionHeader>
            <Row label="2 spots improved" value={`+${cents(c.oddsJump.jump2)}`} />
            <Row label="3+ spots improved" value={`+${cents(c.oddsJump.jump3plus)}`} />
          </div>
        </div>

        {c.bonuses.length > 0 && (
          <>
            <SectionHeader>Custom Bonuses</SectionHeader>
            {c.bonuses.map((b) => (
              <Row key={b.id} label={b.name + (b.description ? ` — ${b.description}` : "")} value={cents(b.amountCents)} />
            ))}
          </>
        )}
      </div>
    );
  }

  return (
    <form
      action={async (fd) => {
        await saveAction(fd);
        setEditing(false);
      }}
    >
      <div className="mb-5 rounded-xl border border-zinc-100 bg-zinc-50 px-4 py-3">
        <SectionHeader>Prize Pool</SectionHeader>
        <div className="flex flex-wrap items-end gap-4">
          <Field label="Buy-in per player" name="buyInCents" defaultValue={c.buyInCents} hint="determines total pot" />
          <div>
            <div className="text-xs font-medium text-zinc-600 mb-0.5">Payout split</div>
            <div className="text-sm text-zinc-500">1st: 65% · 2nd: 35%</div>
          </div>
        </div>
      </div>

      <div className="grid gap-x-10 gap-y-4 sm:grid-cols-2">
        <div className="space-y-4">
          <div>
            <SectionHeader>Group Stage</SectionHeader>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Win" name="group_win" defaultValue={c.group.win} />
              <Field label="Draw" name="group_draw" defaultValue={c.group.draw} />
              <Field label="GD per goal" name="group_gdPerGoal" defaultValue={c.group.gdPerGoal} hint="per goal difference" />
            </div>
          </div>

          <div>
            <SectionHeader>Round of 32 &amp; Round of 16</SectionHeader>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Win" name="r32r16_win" defaultValue={c.r32r16.win} />
              <Field label="GD per goal" name="r32r16_gdPerGoal" defaultValue={c.r32r16.gdPerGoal} />
            </div>
          </div>

          <div>
            <SectionHeader>Quarter Final</SectionHeader>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Win" name="qf_win" defaultValue={c.qf.win} />
              <Field label="GD per goal" name="qf_gdPerGoal" defaultValue={c.qf.gdPerGoal} />
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <SectionHeader>Semi Final</SectionHeader>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Win" name="sf_win" defaultValue={c.sf.win} />
              <Field label="GD/goal (WC)" name="sf_gdPerGoalWc" defaultValue={c.sf.gdPerGoalWc} />
              <Field label="GD/goal (Euros)" name="sf_gdPerGoalEuros" defaultValue={c.sf.gdPerGoalEuros} />
            </div>
          </div>

          <div>
            <SectionHeader>3rd Place (WC only)</SectionHeader>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Win" name="third_win" defaultValue={c.third.win} />
              <Field label="GD per goal" name="third_gdPerGoal" defaultValue={c.third.gdPerGoal} />
            </div>
          </div>

          <div>
            <SectionHeader>Final</SectionHeader>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Winner base" name="final_winnerBase" defaultValue={c.final.winnerBase} />
              <Field label="Runner-up base" name="final_runnerUpBase" defaultValue={c.final.runnerUpBase} />
              <Field label="Goals multiplier" name="final_goalsMultiplier" defaultValue={c.final.goalsMultiplier} hint="applied to both finalists" />
            </div>
          </div>

          <div>
            <SectionHeader>Odds Jump Bonus</SectionHeader>
            <div className="grid grid-cols-2 gap-3">
              <Field label="2 spots improved" name="oddsJump_jump2" defaultValue={c.oddsJump.jump2} />
              <Field label="3+ spots improved" name="oddsJump_jump3plus" defaultValue={c.oddsJump.jump3plus} />
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 flex gap-3">
        <button
          type="submit"
          className="h-9 rounded-xl bg-emerald-600 px-5 text-sm font-semibold text-white hover:bg-emerald-700"
        >
          Save rules
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="h-9 rounded-xl bg-zinc-100 px-5 text-sm font-medium text-zinc-700 hover:bg-zinc-200"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

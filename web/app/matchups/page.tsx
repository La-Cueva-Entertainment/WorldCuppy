import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { CountryFlag } from "@/components/CountryFlag";
import { authOptions } from "@/lib/auth";

const WORLD_CUP_2026_SEASON_ID = "285023";

type FifaLocalizedText = { Locale: string; Description: string };

type FifaTeam = {
  Abbreviation?: string | null;
  TeamName?: FifaLocalizedText[] | null;
};

type FifaMatch = {
  IdMatch: string;
  Date: string;
  LocalDate?: string | null;
  StageName?: FifaLocalizedText[] | null;
  GroupName?: FifaLocalizedText[] | null;
  Home?: FifaTeam | null;
  Away?: FifaTeam | null;
  Stadium?: {
    Name?: FifaLocalizedText[] | null;
    CityName?: FifaLocalizedText[] | null;
  } | null;
};

type FifaCalendarMatchesResponse = {
  Results: FifaMatch[];
};

function pickFirstText(texts: FifaLocalizedText[] | null | undefined) {
  return texts?.[0]?.Description ?? "";
}

function isFirstStage(stageName: string) {
  const s = stageName.trim().toLowerCase();
  return s === "first stage";
}

function formatUtcDateTime(iso: string) {
  const d = new Date(iso);
  const date = d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
  const time = d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  });
  return `${date} · ${time} UTC`;
}

async function MatchupsPageOld() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const matches = await (async () => {
    const url = new URL("https://api.fifa.com/api/v3/calendar/matches");
    url.searchParams.set("language", "en");
    url.searchParams.set("count", "500");
    url.searchParams.set("idSeason", WORLD_CUP_2026_SEASON_ID);

    const res = await fetch(url.toString(), {
      headers: {
        accept: "application/json",
      },
      next: { revalidate: 300 },
    });

    if (!res.ok) return null;

    const json = (await res.json()) as FifaCalendarMatchesResponse;
    return Array.isArray(json.Results) ? json.Results : null;
  })();

  if (!matches) {
    return (
      <div className="min-h-screen">
        <main className="mx-auto w-full max-w-7xl px-6 py-10">
          <h1 className="text-2xl font-semibold tracking-tight text-white">
            Matchups
          </h1>
          <p className="mt-2 text-sm text-zinc-300">Could not load matchups.</p>
        </main>
      </div>
    );
  }

  const now = Date.now();
  const coming = matches
    .filter((m) => {
      const when = Date.parse(m.Date);
      return Number.isFinite(when) && when >= now;
    })
    .sort((a, b) => Date.parse(a.Date) - Date.parse(b.Date));

  // Split the Group Stage into payout windows so each team plays once per window.
  // We do this by counting each team's 1st/2nd/3rd First Stage match in chronological order.
  const firstStageAll = matches
    .filter((m) => isFirstStage(pickFirstText(m.StageName)))
    .sort((a, b) => Date.parse(a.Date) - Date.parse(b.Date));

  const groupWeekByMatchId = new Map<string, 1 | 2 | 3>();
  const firstStageCountByTeam = new Map<string, number>();

  for (const m of firstStageAll) {
    const homeCode = (m.Home?.Abbreviation ?? "").trim();
    const awayCode = (m.Away?.Abbreviation ?? "").trim();

    const nextHome = homeCode
      ? (firstStageCountByTeam.get(homeCode) ?? 0) + 1
      : 1;
    const nextAway = awayCode
      ? (firstStageCountByTeam.get(awayCode) ?? 0) + 1
      : 1;

    // In a properly scheduled group stage, both teams should be on the same round.
    // If not, use the later one to avoid a team appearing twice in an earlier window.
    const round = Math.max(nextHome, nextAway);
    const week = (Math.min(3, Math.max(1, round)) as 1 | 2 | 3) ?? 1;
    groupWeekByMatchId.set(m.IdMatch, week);

    if (homeCode) firstStageCountByTeam.set(homeCode, nextHome);
    if (awayCode) firstStageCountByTeam.set(awayCode, nextAway);
  }

  const GROUP_WEEK_LABELS = [
    "Group Stage · Week 1",
    "Group Stage · Week 2",
    "Group Stage · Week 3",
  ] as const;

  const bySection = new Map<string, FifaMatch[]>();
  for (const m of coming) {
    const stageName = pickFirstText(m.StageName) || "Matches";
    const section = isFirstStage(stageName)
      ? GROUP_WEEK_LABELS[(groupWeekByMatchId.get(m.IdMatch) ?? 1) - 1]
      : stageName;

    const list = bySection.get(section) ?? [];
    list.push(m);
    bySection.set(section, list);
  }

  const getSectionFirstDate = (section: string) => {
    const ms = (bySection.get(section) ?? []).map((m) => Date.parse(m.Date));
    return Math.min(...ms);
  };

  const sections = Array.from(bySection.keys()).sort((a, b) => {
    const aIsGroup = GROUP_WEEK_LABELS.includes(a as (typeof GROUP_WEEK_LABELS)[number]);
    const bIsGroup = GROUP_WEEK_LABELS.includes(b as (typeof GROUP_WEEK_LABELS)[number]);
    if (aIsGroup && bIsGroup) {
      return GROUP_WEEK_LABELS.indexOf(a as (typeof GROUP_WEEK_LABELS)[number]) -
        GROUP_WEEK_LABELS.indexOf(b as (typeof GROUP_WEEK_LABELS)[number]);
    }
    if (aIsGroup) return -1;
    if (bIsGroup) return 1;
    return getSectionFirstDate(a) - getSectionFirstDate(b);
  });

  return (
    <div className="min-h-screen">
      <main className="mx-auto w-full max-w-7xl px-6 py-10">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">
            Matchups
          </h1>
          <p className="mt-1 text-sm text-zinc-300">
            Upcoming FIFA World Cup 2026 fixtures.
          </p>
        </div>

        {coming.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-5 ring-1 ring-inset ring-white/5">
            <div className="text-sm font-medium text-white">No upcoming matches</div>
            <div className="mt-1 text-sm text-zinc-300">
              Check back later.
            </div>
          </div>
        ) : (
          <div className="mt-8 space-y-8">
            {sections.map((section) => {
              const stageMatches = bySection.get(section) ?? [];
              return (
              <section key={section}>
                <div className="flex items-baseline justify-between gap-3">
                  <h2 className="text-sm font-semibold text-zinc-200">{section}</h2>
                  <div className="text-xs text-zinc-400">
                    {stageMatches.length} match{stageMatches.length === 1 ? "" : "es"}
                  </div>
                </div>

                <div className="mt-3 overflow-hidden rounded-2xl border border-white/10 bg-white/5 ring-1 ring-inset ring-white/5">
                  <ul className="divide-y divide-white/10">
                    {stageMatches.map((m) => {
                      const group = pickFirstText(m.GroupName);
                      const home = m.Home?.TeamName?.[0]?.Description ?? "TBD";
                      const away = m.Away?.TeamName?.[0]?.Description ?? "TBD";
                      const homeCode = m.Home?.Abbreviation ?? "";
                      const awayCode = m.Away?.Abbreviation ?? "";
                      const stadium = pickFirstText(m.Stadium?.Name);
                      const city = pickFirstText(m.Stadium?.CityName);

                      return (
                        <li key={m.IdMatch} className="px-4 py-3 sm:px-5">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                                <div className="inline-flex items-center gap-2">
                                  {homeCode ? (
                                    <CountryFlag
                                      code={homeCode}
                                      label={home}
                                      className="h-4 w-6"
                                    />
                                  ) : null}
                                  <span className="text-sm font-semibold text-white">
                                    {home}
                                  </span>
                                </div>
                                <span className="text-xs font-semibold text-zinc-400">
                                  vs
                                </span>
                                <div className="inline-flex items-center gap-2">
                                  {awayCode ? (
                                    <CountryFlag
                                      code={awayCode}
                                      label={away}
                                      className="h-4 w-6"
                                    />
                                  ) : null}
                                  <span className="text-sm font-semibold text-white">
                                    {away}
                                  </span>
                                </div>

                                {group ? (
                                  <span className="rounded-full bg-white/5 px-2 py-0.5 text-xs font-medium text-zinc-200 ring-1 ring-inset ring-white/10">
                                    {group}
                                  </span>
                                ) : null}
                              </div>

                              {stadium || city ? (
                                <div className="mt-1 text-xs text-zinc-300">
                                  {[stadium, city].filter(Boolean).join(" · ")}
                                </div>
                              ) : null}
                            </div>

                            <div className="shrink-0 text-xs font-medium text-zinc-300">
                              {formatUtcDateTime(m.Date)}
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </section>
            )})}
          </div>
        )}
      </main>
    </div>
  );
}

export default async function MatchupsPage({
  searchParams,
}: {
  searchParams?: { stage?: string } | Promise<{ stage?: string }>;
}) {
  const resolvedSearchParams = searchParams
    ? await Promise.resolve(searchParams)
    : undefined;
  const selectedStageParam = (resolvedSearchParams?.stage ?? "").trim();

  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const matches = await (async () => {
    const url = new URL("https://api.fifa.com/api/v3/calendar/matches");
    url.searchParams.set("language", "en");
    url.searchParams.set("count", "500");
    url.searchParams.set("idSeason", WORLD_CUP_2026_SEASON_ID);

    const res = await fetch(url.toString(), {
      headers: {
        accept: "application/json",
      },
      next: { revalidate: 300 },
    });

    if (!res.ok) return null;

    const json = (await res.json()) as FifaCalendarMatchesResponse;
    return Array.isArray(json.Results) ? json.Results : null;
  })();

  if (!matches) {
    return (
      <div className="min-h-screen">
        <main className="mx-auto w-full max-w-7xl px-6 py-10">
          <h1 className="text-2xl font-semibold tracking-tight text-white">
            Matchups
          </h1>
          <p className="mt-2 text-sm text-zinc-300">Could not load matchups.</p>
        </main>
      </div>
    );
  }

  const now = Date.now();
  const coming = matches
    .filter((m) => {
      const when = Date.parse(m.Date);
      return Number.isFinite(when) && when >= now;
    })
    .sort((a, b) => Date.parse(a.Date) - Date.parse(b.Date));

  // Split the Group Stage into payout windows so each team plays once per window.
  // We do this by counting each team's 1st/2nd/3rd First Stage match in chronological order.
  const firstStageAll = matches
    .filter((m) => isFirstStage(pickFirstText(m.StageName)))
    .sort((a, b) => Date.parse(a.Date) - Date.parse(b.Date));

  const groupWeekByMatchId = new Map<string, 1 | 2 | 3>();
  const firstStageCountByTeam = new Map<string, number>();

  for (const m of firstStageAll) {
    const homeCode = (m.Home?.Abbreviation ?? "").trim();
    const awayCode = (m.Away?.Abbreviation ?? "").trim();

    const nextHome = homeCode
      ? (firstStageCountByTeam.get(homeCode) ?? 0) + 1
      : 1;
    const nextAway = awayCode
      ? (firstStageCountByTeam.get(awayCode) ?? 0) + 1
      : 1;

    // In a properly scheduled group stage, both teams should be on the same round.
    // If not, use the later one to avoid a team appearing twice in an earlier window.
    const round = Math.max(nextHome, nextAway);
    const week = (Math.min(3, Math.max(1, round)) as 1 | 2 | 3) ?? 1;
    groupWeekByMatchId.set(m.IdMatch, week);

    if (homeCode) firstStageCountByTeam.set(homeCode, nextHome);
    if (awayCode) firstStageCountByTeam.set(awayCode, nextAway);
  }

  const GROUP_WEEK_LABELS = [
    "Group Stage · Week 1",
    "Group Stage · Week 2",
    "Group Stage · Week 3",
  ] as const;

  const bySection = new Map<string, FifaMatch[]>();
  for (const m of coming) {
    const stageName = pickFirstText(m.StageName) || "Matches";
    const section = isFirstStage(stageName)
      ? GROUP_WEEK_LABELS[(groupWeekByMatchId.get(m.IdMatch) ?? 1) - 1]
      : stageName;

    const list = bySection.get(section) ?? [];
    list.push(m);
    bySection.set(section, list);
  }

  const getSectionFirstDate = (section: string) => {
    const ms = (bySection.get(section) ?? []).map((m) => Date.parse(m.Date));
    return Math.min(...ms);
  };

  const sections = Array.from(bySection.keys()).sort((a, b) => {
    const aIsGroup = GROUP_WEEK_LABELS.includes(
      a as (typeof GROUP_WEEK_LABELS)[number]
    );
    const bIsGroup = GROUP_WEEK_LABELS.includes(
      b as (typeof GROUP_WEEK_LABELS)[number]
    );
    if (aIsGroup && bIsGroup) {
      return (
        GROUP_WEEK_LABELS.indexOf(a as (typeof GROUP_WEEK_LABELS)[number]) -
        GROUP_WEEK_LABELS.indexOf(b as (typeof GROUP_WEEK_LABELS)[number])
      );
    }
    if (aIsGroup) return -1;
    if (bIsGroup) return 1;
    return getSectionFirstDate(a) - getSectionFirstDate(b);
  });

  const selectedSection =
    (selectedStageParam && bySection.has(selectedStageParam)
      ? selectedStageParam
      : sections[0]) ?? "";
  const selectedMatches = selectedSection
    ? (bySection.get(selectedSection) ?? [])
    : [];

  return (
    <div className="min-h-screen">
      <main className="mx-auto w-full max-w-7xl px-6 py-10">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">
            Matchups
          </h1>
          <p className="mt-1 text-sm text-zinc-300">
            Upcoming FIFA World Cup 2026 fixtures.
          </p>
        </div>

        <div className="mt-6 overflow-x-auto">
          <div className="inline-flex gap-2 rounded-2xl border border-white/10 bg-white/5 p-2 ring-1 ring-inset ring-white/5">
            {sections.map((section) => {
              const active = section === selectedSection;
              return (
                <Link
                  key={section}
                  href={{ pathname: "/matchups", query: { stage: section } }}
                  className={[
                    "inline-flex h-9 items-center rounded-xl px-3 text-xs font-semibold ring-1 ring-inset",
                    active
                      ? "bg-emerald-400/10 text-emerald-50 ring-emerald-400/20"
                      : "bg-white/0 text-zinc-200 ring-white/10 hover:bg-white/5",
                  ].join(" ")}
                >
                  {section}
                </Link>
              );
            })}
          </div>
        </div>

        {coming.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-5 ring-1 ring-inset ring-white/5">
            <div className="text-sm font-medium text-white">No upcoming matches</div>
            <div className="mt-1 text-sm text-zinc-300">Check back later.</div>
          </div>
        ) : selectedMatches.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-5 ring-1 ring-inset ring-white/5">
            <div className="text-sm font-medium text-white">No matches</div>
            <div className="mt-1 text-sm text-zinc-300">
              Nothing scheduled for this stage.
            </div>
          </div>
        ) : (
          <section className="mt-8">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-sm font-semibold text-zinc-200">
                {selectedSection}
              </h2>
              <div className="text-xs text-zinc-400">
                {selectedMatches.length} match
                {selectedMatches.length === 1 ? "" : "es"}
              </div>
            </div>

            <div className="mt-3 overflow-hidden rounded-2xl border border-white/10 bg-white/5 ring-1 ring-inset ring-white/5">
              <ul className="divide-y divide-white/10">
                {selectedMatches.map((m) => {
                  const group = pickFirstText(m.GroupName);
                  const home = m.Home?.TeamName?.[0]?.Description ?? "TBD";
                  const away = m.Away?.TeamName?.[0]?.Description ?? "TBD";
                  const homeCode = m.Home?.Abbreviation ?? "";
                  const awayCode = m.Away?.Abbreviation ?? "";
                  const stadium = pickFirstText(m.Stadium?.Name);
                  const city = pickFirstText(m.Stadium?.CityName);

                  return (
                    <li key={m.IdMatch} className="px-4 py-3 sm:px-5">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                            <div className="inline-flex items-center gap-2">
                              {homeCode ? (
                                <CountryFlag
                                  code={homeCode}
                                  label={home}
                                  className="h-4 w-6"
                                />
                              ) : null}
                              <span className="text-sm font-semibold text-white">
                                {home}
                              </span>
                            </div>
                            <span className="text-xs font-semibold text-zinc-400">
                              vs
                            </span>
                            <div className="inline-flex items-center gap-2">
                              {awayCode ? (
                                <CountryFlag
                                  code={awayCode}
                                  label={away}
                                  className="h-4 w-6"
                                />
                              ) : null}
                              <span className="text-sm font-semibold text-white">
                                {away}
                              </span>
                            </div>

                            {group ? (
                              <span className="rounded-full bg-white/5 px-2 py-0.5 text-xs font-medium text-zinc-200 ring-1 ring-inset ring-white/10">
                                {group}
                              </span>
                            ) : null}
                          </div>

                          {stadium || city ? (
                            <div className="mt-1 text-xs text-zinc-300">
                              {[stadium, city].filter(Boolean).join(" · ")}
                            </div>
                          ) : null}
                        </div>

                        <div className="shrink-0 text-xs font-medium text-zinc-300">
                          {formatUtcDateTime(m.Date)}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

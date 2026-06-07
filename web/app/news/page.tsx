import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { NewsImage } from "@/components/NewsImage";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { fetchRss, fmtRelTime } from "@/lib/rss";
import { CountryFlag } from "@/components/CountryFlag";
import { TEAMS } from "@/lib/teams";

const TEAMS_BY_CODE = new Map(TEAMS.map((t) => [t.code, t]));

const SOURCES = ["Fox Sports", "BBC Sport", "ESPN FC", "The Athletic", "Sky Sports", "L'Équipe"];

export default async function NewsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const [items, recentMatches] = await Promise.all([
    fetchRss(12),
    prisma.match.findMany({
      where: { played: true },
      orderBy: [{ matchDate: "desc" }],
      take: 6,
      select: { homeTeam: true, awayTeam: true, homeScore: true, awayScore: true, stage: true },
    }).catch(() => []),
  ]);

  const feature = items[0];
  const rest = items.slice(1);

  return (
    <main className="page">
      <div className="wrap">

        <div className="between" style={{ marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
          <div>
            <div className="kicker grass">Aggregated · auto-updating</div>
            <h1 style={{ fontSize: "clamp(28px,4vw,38px)", marginTop: 4 }}>Football News</h1>
          </div>
          <span className="badge grass">
            <span className="live-dot" />
            {" "}Live RSS
          </span>
        </div>

        <div className="news-grid">
          {/* Main column */}
          <div>
            {/* Feature article */}
            {feature && (
              <Link href={feature.link} target="_blank" rel="noopener noreferrer" className="card feature" style={{ display: "block", textDecoration: "none", color: "inherit" }}>
                <div className="thumb">
                  {feature.largeImageUrl ?? feature.imageUrl
                    ? <NewsImage src={(feature.largeImageUrl ?? feature.imageUrl)!} alt="" className="thumb-img" />
                    : <span>match photo · {feature.title.split(" ").slice(0, 3).join(" ")}</span>}
                </div>
                <div className="body">
                  <span className="badge grass">Match</span>
                  <h2>{feature.title}</h2>
                  {feature.description && <p>{feature.description}</p>}
                  <div className="tag-soft" style={{ marginTop: 14 }}>
                    Fox Sports · {fmtRelTime(feature.pubDate)}
                  </div>
                </div>
              </Link>
            )}

            {/* Article list */}
            <div className="alist">
              {rest.map((item, i) => (
                <Link key={i} href={item.link} target="_blank" rel="noopener noreferrer" className="arow">
                  <div className="thumb">
                    {item.imageUrl
                      ? <NewsImage src={item.imageUrl} alt="" className="thumb-img" />
                      : <span>photo</span>}
                  </div>
                  <div>
                    <h3>{item.title}</h3>
                    {item.description && <p>{item.description}</p>}
                    <div className="meta">Fox Sports · {fmtRelTime(item.pubDate)}</div>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Sidebar */}
          <aside style={{ display: "grid", gap: 18, position: "sticky", top: 80 }}>
            {recentMatches.length > 0 && (
              <section className="card scorebox">
                <div className="kicker" style={{ padding: "8px 8px 4px" }}>Latest scores</div>
                {recentMatches.map((m, i) => {
                  const home = TEAMS_BY_CODE.get(m.homeTeam);
                  const away = TEAMS_BY_CODE.get(m.awayTeam);
                  return (
                    <div key={i} className="sb-row">
                      <CountryFlag code={m.homeTeam} label={home?.name ?? m.homeTeam} className="flag-sm fi-rect" />
                      <span className="nm">{home?.name ?? m.homeTeam}</span>
                      <span className="sc">{m.homeScore ?? "–"}</span>
                      <span className="tag-soft">:</span>
                      <span className="sc">{m.awayScore ?? "–"}</span>
                      <CountryFlag code={m.awayTeam} label={away?.name ?? m.awayTeam} className="flag-sm fi-rect" />
                    </div>
                  );
                })}
              </section>
            )}

            <section className="card card-pad">
              <h2 style={{ fontSize: 16, marginBottom: 10 }}>Sources</h2>
              <div className="sources">
                {SOURCES.map((s) => (
                  <span key={s} className="source-pill">{s}</span>
                ))}
              </div>
            </section>
          </aside>
        </div>

      </div>
    </main>
  );
}


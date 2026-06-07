import Link from "next/link";

import { NewsImage } from "@/components/NewsImage";
import { fetchRss, fmtRelTime } from "@/lib/rss";

const itemStyle: React.CSSProperties = { display: "flex", gap: "12px", padding: "12px 18px", transition: "background .12s" };

export default async function RssFeed({ newsHref = "/news" }: { newsHref?: string } = {}) {
  const allItems = await fetchRss();
  const items = allItems.slice(0, 5);

  return (
    <section className="card">
      <div style={{ display: "flex", alignItems: "center", gap: "8px", borderBottom: "1px solid var(--line-soft)", padding: "14px 18px" }}>
        <h2 style={{ fontSize: "18px", flex: 1 }}>Football news</h2>
        <span className="badge"><span className="live-dot" style={{ background: "var(--grass)" }}></span> RSS</span>
      </div>

      {items.length === 0 ? (
        <div style={{ padding: "32px", textAlign: "center", color: "var(--ink-faint)", fontSize: "14px" }}>
          News unavailable right now.
        </div>
      ) : (
        <>
          <div>
            {items.map((item, i) => (
              <Link
                key={i}
                href={item.link}
                target="_blank"
                rel="noopener noreferrer"
                className="rss-item"
                style={{ ...itemStyle, borderBottom: i < items.length - 1 ? "1px solid var(--line-soft)" : "none" }}
              >
                {item.imageUrl && (
                  <NewsImage
                    src={item.imageUrl}
                    alt=""
                    className="h-14 w-20 shrink-0 rounded-lg object-cover bg-zinc-100 dark:bg-white/10"
                  />
                )}
                <div style={{ minWidth: 0, flex: 1 }}>
                  <p style={{ fontSize: "14px", fontFamily: "var(--font-archivo), Archivo, sans-serif", fontWeight: 700, lineHeight: 1.25, color: "var(--ink)", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", margin: 0 }}>
                    {item.title}
                  </p>
                  {item.pubDate && (
                    <p style={{ marginTop: "5px", fontSize: "12px", color: "var(--ink-faint)" }}>
                      {fmtRelTime(item.pubDate)}
                    </p>
                  )}
                </div>
              </Link>
            ))}
          </div>

          <div style={{ borderTop: "1px solid var(--line-soft)", padding: "12px 18px" }}>
            <Link href={newsHref} className="btn btn-ghost btn-sm btn-block">
              More news →
            </Link>
          </div>
        </>
      )}
    </section>
  );
}

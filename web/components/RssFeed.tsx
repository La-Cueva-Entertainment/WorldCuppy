import Link from "next/link";

import { NewsImage } from "@/components/NewsImage";
import { fetchRss, fmtRelTime } from "@/lib/rss";

export default async function RssFeed({ newsHref = "/news" }: { newsHref?: string } = {}) {
  const allItems = await fetchRss();
  const items = allItems.slice(0, 5);

  return (
    <div className="rounded-2xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-white/5 overflow-hidden">
      <div className="flex items-center gap-2 border-b border-zinc-100 dark:border-white/5 px-4 py-3">
        <span className="h-2 w-2 rounded-full bg-red-500" />
        <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
          World Cup News
        </h2>
        <span className="ml-auto text-[10px] text-zinc-400 dark:text-zinc-500">Fox Sports</span>
      </div>

      {items.length === 0 ? (
        <div className="px-4 py-8 text-center text-sm text-zinc-400 dark:text-zinc-500">
          News unavailable right now.
        </div>
      ) : (
        <>
          <div className="divide-y divide-zinc-100 dark:divide-white/5">
            {items.map((item, i) => (
              <Link
                key={i}
                href={item.link}
                target="_blank"
                rel="noopener noreferrer"
                className="flex gap-3 px-4 py-3 transition-colors hover:bg-zinc-50 dark:hover:bg-white/5 group"
              >
                {item.imageUrl && (
                  <NewsImage
                    src={item.imageUrl}
                    alt=""
                    className="h-14 w-20 shrink-0 rounded-lg object-cover bg-zinc-100 dark:bg-white/10"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold leading-snug text-zinc-900 dark:text-white line-clamp-2 group-hover:text-emerald-600 dark:group-hover:text-emerald-400">
                    {item.title}
                  </p>
                  {item.description && (
                    <p className="mt-0.5 text-[11px] leading-snug text-zinc-500 dark:text-zinc-400 line-clamp-2">
                      {item.description}
                    </p>
                  )}
                  {item.pubDate && (
                    <p className="mt-1 text-[10px] text-zinc-400 dark:text-zinc-500">
                      {fmtRelTime(item.pubDate)}
                    </p>
                  )}
                </div>
              </Link>
            ))}
          </div>

          <div className="border-t border-zinc-100 dark:border-white/5 px-4 py-3">
            <Link
              href={newsHref}
              className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-zinc-50 dark:bg-white/5 px-4 py-2 text-xs font-semibold text-zinc-600 dark:text-zinc-300 transition-colors hover:bg-zinc-100 dark:hover:bg-white/10"
            >
              See more news →
            </Link>
          </div>
        </>
      )}
    </div>
  );
}

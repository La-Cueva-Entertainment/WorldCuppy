import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { NewsImage } from "@/components/NewsImage";
import { authOptions } from "@/lib/auth";
import { fetchRss, fmtRelTime } from "@/lib/rss";

export default async function NewsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const items = await fetchRss(7);

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex items-center gap-4">
        <Link
          href="/"
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-zinc-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 text-xs font-medium text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-white/10"
        >
          ← Home
        </Link>
        <div>
          <h1 className="text-2xl font-extrabold text-zinc-900 dark:text-white">World Cup News</h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            Last 7 days · Fox Sports
          </p>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-white/5 px-6 py-12 text-center">
          <p className="text-zinc-500 dark:text-zinc-400">No recent articles found.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {items.map((item, i) => (
            <Link
              key={i}
              href={item.link}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex gap-4 rounded-2xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-white/5 p-4 transition-colors hover:bg-zinc-50 dark:hover:bg-white/10"
            >
              {item.imageUrl && (
                <NewsImage
                  src={item.imageUrl}
                  alt=""
                  className="h-24 w-36 shrink-0 rounded-xl object-cover bg-zinc-100 dark:bg-white/10"
                />
              )}
              <div className="min-w-0 flex-1">
                <p className="font-semibold leading-snug text-zinc-900 dark:text-white line-clamp-2 group-hover:text-emerald-600 dark:group-hover:text-emerald-400">
                  {item.title}
                </p>
                {item.description && (
                  <p className="mt-1.5 text-sm leading-snug text-zinc-500 dark:text-zinc-400 line-clamp-3">
                    {item.description}
                  </p>
                )}
                <p className="mt-2 text-[11px] text-zinc-400 dark:text-zinc-500">
                  {fmtRelTime(item.pubDate)} · theguardian.com
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}

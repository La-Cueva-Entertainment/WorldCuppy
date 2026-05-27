export type RssItem = {
  title: string;
  link: string;
  description: string;
  pubDate: string;
  pubDateMs: number;
  imageUrl?: string;
};

const RSS_URL =
  "https://api.foxsports.com/v2/content/optimized-rss?partnerKey=MB0Wehpmuj2lUhuRhQaafhBjAJqaPU244mlTDK1i&size=30&tags=soccer%2Fwc%2Fleague%2F12";

// Unwrap CDATA, then strip all HTML tags (handles both raw tags and entity-encoded tags)
function cleanText(raw: string): string {
  let s = raw.trim();
  // 1. Unwrap CDATA
  s = s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");
  // 2. Decode angle-bracket entities FIRST so the tag stripper sees all tags
  s = s.replace(/&lt;/g, "<").replace(/&gt;/g, ">");
  // 3. Strip every HTML/XML tag
  s = s.replace(/<[^>]*>/g, " ");
  // 4. Decode remaining entities
  s = s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#8217;/g, "’")
    .replace(/&#8216;/g, "‘")
    .replace(/&#8220;/g, "“")
    .replace(/&#8221;/g, "”")
    .replace(/&#8230;/g, "…");
  // 5. Collapse whitespace
  return s.replace(/\s+/g, " ").trim();
}

function extractImage(body: string): string | undefined {
  return (
    body.match(/<media:thumbnail[^>]*\surl="([^"]+)"/)?.[1] ??
    body.match(/<media:content[^>]*\surl="([^"]+)"/)?.[1] ??
    body.match(/<enclosure[^>]*\surl="([^"]+)"[^>]*type="image\//)?.[1] ??
    undefined
  );
}

export async function fetchRss(maxAgeDays = 7): Promise<RssItem[]> {
  try {
    const res = await fetch(RSS_URL, { next: { revalidate: 300 } });
    if (!res.ok) return [];
    const xml = await res.text();

    const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;
    const items: RssItem[] = [];
    const itemRe = /<item[^>]*>([\s\S]*?)<\/item>/g;
    let match: RegExpExecArray | null;

    while ((match = itemRe.exec(xml)) !== null) {
      const body = match[1];

      const titleRaw = body.match(/<title[^>]*>([\s\S]*?)<\/title>/)?.[1] ?? "";
      const linkRaw =
        body.match(/<link[^>]*>\s*(https?:\/\/[^\s<]+)\s*<\/link>/)?.[1] ??
        body.match(/<guid[^>]*>(https?:\/\/[^\s<]+)<\/guid>/)?.[1] ??
        "";
      const descRaw = body.match(/<description[^>]*>([\s\S]*?)<\/description>/)?.[1] ?? "";
      const pubDateRaw = body.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/)?.[1] ?? "";

      const title = cleanText(titleRaw);
      const link = cleanText(linkRaw);
      const description = cleanText(descRaw).slice(0, 220);
      const pubDate = cleanText(pubDateRaw);
      const pubDateMs = pubDate ? new Date(pubDate).getTime() : 0;
      const imageUrl = extractImage(body);

      if (!title || !link) continue;
      if (pubDateMs && pubDateMs < cutoff) continue;

      items.push({ title, link, description, pubDate, pubDateMs, imageUrl });
    }

    return items.sort((a, b) => b.pubDateMs - a.pubDateMs);
  } catch {
    return [];
  }
}

export function fmtRelTime(dateStr: string): string {
  try {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  } catch {
    return "";
  }
}

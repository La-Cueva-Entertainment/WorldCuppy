export type RssItem = {
  title: string;
  link: string;
  description: string;
  pubDate: string;
  pubDateMs: number;
  imageUrl?: string;
  largeImageUrl?: string;
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

/** Extract all media URLs with their declared widths, then return { small, large }. */
function extractImages(body: string): { imageUrl?: string; largeImageUrl?: string } {
  // Collect every media:content and media:thumbnail with optional width attr
  const candidates: { url: string; width: number }[] = [];
  const contentRe = /<media:(?:content|thumbnail)[^>]*\surl="([^"]+)"([^>]*)/g;
  let m: RegExpExecArray | null;
  while ((m = contentRe.exec(body)) !== null) {
    const url = m[1];
    const widthMatch = m[2].match(/\bwidth="(\d+)"/);
    const width = widthMatch ? parseInt(widthMatch[1], 10) : 0;
    candidates.push({ url, width });
  }
  // Also pick up enclosure images
  const enclosureMatch = body.match(/<enclosure[^>]*\surl="([^"]+)"[^>]*type="image\//);
  if (enclosureMatch) candidates.push({ url: enclosureMatch[1], width: 0 });

  if (candidates.length === 0) return {};

  candidates.sort((a, b) => a.width - b.width);
  const small = candidates[0].url;
  const large = candidates[candidates.length - 1].url;

  // If no explicit width metadata, try rewriting the URL to request a larger size
  const largeImageUrl = candidates[candidates.length - 1].width > 0 ? large : upsizeUrl(large);

  return { imageUrl: small, largeImageUrl };
}

/** Rewrite CDN URL to request a larger image where possible. */
function upsizeUrl(url: string): string {
  try {
    const u = new URL(url);
    if (u.searchParams.has("width")) { u.searchParams.set("width", "1200"); return u.toString(); }
    if (u.searchParams.has("w")) { u.searchParams.set("w", "1200"); return u.toString(); }
  } catch { /* non-absolute */ }
  // Path-based size tokens like _400.jpg → _1200.jpg or -400w. → -1200w.
  return url
    .replace(/([_-])\d{3,4}(w?)(\.(jpg|jpeg|png|webp))/i, "$11200$2$3")
    .replace(/([?&](?:width|w)=)\d+/, "$11200");
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
      const { imageUrl, largeImageUrl } = extractImages(body);

      if (!title || !link) continue;
      if (pubDateMs && pubDateMs < cutoff) continue;

      items.push({ title, link, description, pubDate, pubDateMs, imageUrl, largeImageUrl });
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

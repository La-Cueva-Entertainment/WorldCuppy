const pageUrl = "https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/teams";

function uniq(items) {
  const seen = new Set();
  const out = [];
  for (const item of items) {
    if (!seen.has(item)) {
      seen.add(item);
      out.push(item);
    }
  }
  return out;
}

function extractScriptSrcs(html) {
  return uniq([...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map((m) => m[1]));
}

function normalizeUrl(src) {
  if (src.startsWith("http://") || src.startsWith("https://")) return src;
  return `https://www.fifa.com${src}`;
}

function extractInterestingStrings(text) {
  const hits = new Set();

  const urlLike = /https?:\/\/[^\s"']+/g;
  for (const m of text.matchAll(urlLike)) {
    const u = m[0];
    if (
      u.includes("fifa") ||
      u.includes("cxm-api") ||
      u.includes("api.") ||
      u.includes("canadamexicousa")
    ) {
      hits.add(u);
    }
  }

  // Also capture interesting path fragments.
  const pathLike = /\/[a-z0-9][a-z0-9\-/._?=&%]{10,}/gi;
  for (const m of text.matchAll(pathLike)) {
    const p = m[0];
    if (
      p.includes("fifaplusweb") ||
      p.includes("canadamexicousa") ||
      p.includes("tournaments") ||
      p.includes("worldcup") ||
      p.includes("teams")
    ) {
      hits.add(p);
    }
  }

  return [...hits];
}

async function fetchText(url) {
  const res = await fetch(url, {
    headers: {
      "user-agent": "Mozilla/5.0",
      "accept-language": "en-US,en;q=0.9",
    },
  });

  if (!res.ok) {
    throw new Error(`Fetch failed ${res.status} for ${url}`);
  }

  return res.text();
}

async function main() {
  const html = await fetchText(pageUrl);
  const scripts = extractScriptSrcs(html).map(normalizeUrl);

  const mainBundle = scripts.find((s) => s.includes("/static/js/main."));
  if (!mainBundle) {
    console.log("No main bundle found. Scripts:\n" + scripts.join("\n"));
    process.exit(2);
  }

  const js = await fetchText(mainBundle);

  const interesting = extractInterestingStrings(js)
    .filter((s) =>
      s.includes("teams") ||
      s.includes("canadamexicousa") ||
      s.includes("fifaplusweb") ||
      s.includes("api.fifa") ||
      s.includes("cxm-api")
    )
    .sort((a, b) => a.localeCompare(b));

  console.log("main bundle", mainBundle);
  console.log("bundle length", js.length);
  console.log("interesting hits", interesting.length);
  console.log(interesting.join("\n"));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

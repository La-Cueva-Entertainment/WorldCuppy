const url = "https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/teams";

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

async function main() {
  const res = await fetch(url, {
    headers: {
      "user-agent": "Mozilla/5.0",
      "accept-language": "en-US,en;q=0.9",
    },
  });

  const html = await res.text();

  const scriptSrcs = uniq(
    [...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map((m) => m[1])
  );

  const linkHrefs = uniq(
    [...html.matchAll(/<link[^>]+href="([^"]+)"/g)].map((m) => m[1])
  );

  console.log("status", res.status);
  console.log("html length", html.length);

  console.log("\nSCRIPT SRCS:");
  for (const src of scriptSrcs) console.log(src);

  console.log("\nLINK HREFS (first 30):");
  for (const href of linkHrefs.slice(0, 30)) console.log(href);

  console.log("\nMARKERS:");
  for (const marker of [
    "cxm-api.fifa.com",
    "api.fifa.com",
    "digitalhub.fifa.com",
    "teams",
    "canadamexicousa2026",
  ]) {
    console.log(marker, html.includes(marker));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

import fs from "node:fs/promises";
import path from "node:path";

function stripDiacritics(input) {
  return input.normalize("NFKD").replace(/\p{Diacritic}/gu, "");
}

function normalizeTeamName(name) {
  const cleaned = stripDiacritics(String(name))
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (cleaned === "usa" || cleaned === "us" || cleaned === "u s a") return "united states";
  if (cleaned === "korea republic" || cleaned === "republic of korea") return "south korea";
  if (cleaned === "ir iran") return "iran";

  return cleaned;
}

function parseArgs(argv) {
  const args = { in: null, out: null };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    const next = argv[i + 1];
    if (a === "--in") {
      args.in = next ?? null;
      i += 1;
    } else if (a === "--out") {
      args.out = next ?? null;
      i += 1;
    }
  }
  return args;
}

const { in: inFile, out: outFile } = parseArgs(process.argv.slice(2));

if (!inFile || !outFile) {
  console.error("Usage: node scripts/import-bovada-odds.mjs --in data/bovada-odds.txt --out data/bovada-odds.json");
  process.exit(1);
}

const inputPath = path.resolve(process.cwd(), inFile);
const outputPath = path.resolve(process.cwd(), outFile);

const raw = await fs.readFile(inputPath, "utf8");

// Matches things like:
// Spain +450
// Bosnia & Herzegovina +30000
// Republic Of Ireland +100000
const lineRe = /^(?<name>.+?)\s+(?<odds>[+-]\d{2,})\s*$/;

const oddsByName = {};
const skipped = [];

for (const line of raw.split(/\r?\n/)) {
  const trimmed = line.trim();
  if (!trimmed) continue;

  const m = trimmed.match(lineRe);
  if (!m?.groups) {
    skipped.push(trimmed);
    continue;
  }

  const name = normalizeTeamName(m.groups.name);
  const odds = Number(m.groups.odds);

  if (!name || !Number.isFinite(odds) || odds === 0) {
    skipped.push(trimmed);
    continue;
  }

  oddsByName[name] = odds;
}

await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.writeFile(outputPath, JSON.stringify(oddsByName, null, 2) + "\n", "utf8");

console.log(`Wrote ${Object.keys(oddsByName).length} teams to ${outFile}`);
if (skipped.length) {
  console.log(`Skipped ${skipped.length} lines (did not match expected format).`);
}

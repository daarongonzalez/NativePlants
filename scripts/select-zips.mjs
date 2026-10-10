#!/usr/bin/env node
/**
 * Build apps/ingest/src/wasatch-zips.ts from the Census ZCTA-to-county file.
 *
 *   node scripts/select-zips.mjs <zcta-county-file> <existing-zips-module> > apps/ingest/src/wasatch-zips.ts
 *
 * The existing list is merged in rather than replaced. ZCTAs approximate ZIPs,
 * and a ZIP we already cover (a PO box ZIP, say) must not silently disappear.
 * What was added is printed to stderr so the pull request can show it.
 */
import { readFileSync } from "node:fs";
import { EXCLUDED_ZIPS, renderZipsModule, selectZctas, zipsFromModule } from "./lib/reference-data.mjs";

const [zctaFile, existingFile] = process.argv.slice(2);
if (!zctaFile || !existingFile) {
  console.error("usage: node scripts/select-zips.mjs <zcta-county-file> <existing-zips-module>");
  process.exit(2);
}

const fromCensus = selectZctas(readFileSync(zctaFile, "utf8"));
const existing = zipsFromModule(readFileSync(existingFile, "utf8"));

// An empty or tiny result means the file changed shape, not that the market
// shrank. Refuse to overwrite a working list with it.
if (fromCensus.length < 50) {
  console.error(`Only ${fromCensus.length} ZCTAs matched the four counties. Expected well over 50.`);
  process.exit(1);
}

const merged = [...new Set([...existing, ...fromCensus])]
  .filter((z) => !EXCLUDED_ZIPS.includes(z))
  .sort();
const added = merged.filter((z) => !existing.includes(z));
const keptOnly = existing.filter((z) => !fromCensus.includes(z));

console.error(`Census ZCTAs in market: ${fromCensus.length}`);
console.error(`Previous list:          ${existing.length}`);
console.error(`Merged list:            ${merged.length}`);
console.error(`Added (${added.length}): ${added.join(" ") || "none"}`);
console.error(`Kept from previous list but not in Census file (${keptOnly.length}): ${keptOnly.join(" ") || "none"}`);

process.stdout.write(renderZipsModule(merged));

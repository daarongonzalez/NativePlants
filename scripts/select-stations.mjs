#!/usr/bin/env node
/**
 * Print candidate NCEI station ids, one per line, from the GHCN-Daily
 * inventory.
 *
 *   node scripts/select-stations.mjs <ghcnd-stations.txt>
 *
 * Candidates are Utah stations inside the market bounding box. Many will have
 * no 1991-2020 normals file, and some files lack complete 32F normals; the
 * workflow tolerates the first and parse-noaa-frost.mjs reports the second.
 */
import { readFileSync } from "node:fs";
import { candidateStations, parseGhcndStations } from "./lib/reference-data.mjs";

const file = process.argv[2];
if (!file) {
  console.error("usage: node scripts/select-stations.mjs <ghcnd-stations.txt>");
  process.exit(2);
}

const all = parseGhcndStations(readFileSync(file, "utf8"));
const candidates = candidateStations(all);

if (all.length < 1000 || candidates.length === 0) {
  console.error(`Inventory parsed ${all.length} stations, ${candidates.length} candidates. The file format may have changed.`);
  process.exit(1);
}

console.error(`${all.length} stations in inventory, ${candidates.length} candidates in the market box`);
for (const s of candidates) console.log(s.id);

#!/usr/bin/env node
/**
 * Finds candidate photos for every plant in the sheet, for the reviewer to
 * accept or reject. Nothing found here is shown to gardeners until it is.
 *
 *   NODE_USE_ENV_PROXY=1 node scripts/find-plant-images.mjs [--per-plant 4]
 *
 * (NODE_USE_ENV_PROXY makes Node's fetch use the session proxy; harmless elsewhere.)
 *
 * Source: iNaturalist research-grade observations (the species is confirmed
 * by the community). Only photos licensed CC0 or CC BY are kept: our scope
 * rules out CC BY-NC (a paid product is commercial use), and leaves CC BY-SA
 * out because cropping to our fixed shapes could count as an adaptation.
 * Utah photos come first, so plants look the way they grow here.
 *
 * Writes data/plants/image-candidates.json. Each candidate keeps its licence,
 * the photographer's credit and a link to the photo's page, because the
 * credit has to be shown wherever the image appears.
 */
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SHEET = join(ROOT, "data/plants/wasatch-plants.csv");
const OUT = join(ROOT, "data/plants/image-candidates.json");
const API = "https://api.inaturalist.org/v1";
const USER_AGENT = "NativoPlantReview/0.1 (finding openly licensed plant photos for expert review)";
const LICENSES = ["cc0", "cc-by"];
const UTAH_PLACE_ID = 52;

const perPlantArg = process.argv.indexOf("--per-plant");
const PER_PLANT = perPlantArg > -1 ? Number(process.argv[perPlantArg + 1]) : 4;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** iNaturalist asks for about one request a second. */
async function get(path) {
  await sleep(1100);
  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await fetch(`${API}${path}`, { headers: { "User-Agent": USER_AGENT, Accept: "application/json" } });
    if (res.ok) return res.json();
    if (res.status === 429 || res.status >= 500) {
      await sleep(attempt * 5000);
      continue;
    }
    throw new Error(`${res.status} for ${path}`);
  }
  throw new Error(`gave up on ${path}`);
}

/** The scientific names in the sheet. Plain split is safe: names never contain commas. */
async function readSheet() {
  const [head, ...rows] = (await readFile(SHEET, "utf8")).trim().split("\n");
  const cols = head.split(",");
  const sci = cols.indexOf("scientific_name");
  const common = cols.indexOf("common_names");
  return rows.map((r) => {
    const v = r.split(",");
    return { scientificName: v[sci], commonName: (v[common] ?? "").split("|")[0] };
  });
}

/**
 * The iNaturalist species for a sheet name. Accepts a match on a synonym too
 * (iNaturalist files Mahonia repens as Berberis repens, for one), and records
 * the name it used so the reviewer can see the switch.
 */
async function findTaxon(name) {
  const data = await get(`/taxa?q=${encodeURIComponent(name)}&rank=species,subspecies,variety&per_page=10`);
  const lower = name.toLowerCase();
  return (
    data.results.find((t) => t.name.toLowerCase() === lower) ??
    data.results.find((t) => (t.matched_term ?? "").toLowerCase() === lower) ??
    null
  );
}

const LICENSE_LABELS = { cc0: "CC0", "cc-by": "CC BY" };

function toCandidate(photo, obs, inUtah) {
  const medium = photo.url.replace("/square.", "/medium.");
  return {
    source: "inaturalist",
    photoId: photo.id,
    imageUrl: medium.replace("/medium.", "/large."),
    thumbUrl: medium,
    pageUrl: `https://www.inaturalist.org/photos/${photo.id}`,
    observationUrl: `https://www.inaturalist.org/observations/${obs.id}`,
    license: LICENSE_LABELS[photo.license_code] ?? photo.license_code,
    credit: photo.attribution,
    width: photo.original_dimensions?.width ?? null,
    height: photo.original_dimensions?.height ?? null,
    observedOn: obs.observed_on ?? null,
    place: obs.place_guess ?? null,
    inUtah,
  };
}

async function photosFor(taxonId) {
  const picked = [];
  const seenObs = new Set();
  for (const inUtah of [true, false]) {
    if (picked.length >= PER_PLANT) break;
    const place = inUtah ? `&place_id=${UTAH_PLACE_ID}` : "";
    const data = await get(
      `/observations?taxon_id=${taxonId}&quality_grade=research&photo_license=${LICENSES.join(",")}` +
        `&photos=true&order_by=votes&per_page=30${place}`,
    );
    for (const obs of data.results) {
      if (picked.length >= PER_PLANT) break;
      if (seenObs.has(obs.id)) continue;
      // One photo per observation, so the set shows different plants and settings.
      const photo = obs.photos.find((p) => LICENSES.includes(p.license_code));
      if (!photo) continue;
      seenObs.add(obs.id);
      picked.push(toCandidate(photo, obs, inUtah));
    }
  }
  return picked;
}

async function main() {
  const plants = await readSheet();
  const out = { generatedAt: new Date().toISOString(), source: "iNaturalist research-grade observations", licenses: ["CC0", "CC BY"], plants: {} };
  for (const p of plants) {
    try {
      const taxon = await findTaxon(p.scientificName);
      if (!taxon) {
        out.plants[p.scientificName] = { taxonId: null, note: "No exact iNaturalist match", candidates: [] };
        console.log(`  ✗ ${p.scientificName}: no exact match`);
        continue;
      }
      const candidates = await photosFor(taxon.id);
      const inatName = taxon.name === p.scientificName ? null : taxon.name;
      out.plants[p.scientificName] = {
        taxonId: taxon.id,
        taxonUrl: `https://www.inaturalist.org/taxa/${taxon.id}`,
        ...(inatName ? { note: `iNaturalist lists this plant as ${inatName}` } : {}),
        candidates,
      };
      console.log(
        `  ${candidates.length ? "✓" : "–"} ${p.scientificName}${inatName ? ` (as ${inatName})` : ""}: ${candidates.length} (${candidates.filter((c) => c.inUtah).length} in Utah)`,
      );
    } catch (error) {
      out.plants[p.scientificName] = { taxonId: null, note: String(error), candidates: [] };
      console.log(`  ✗ ${p.scientificName}: ${error}`);
    }
  }
  await writeFile(OUT, JSON.stringify(out, null, 2) + "\n");
  const total = Object.values(out.plants).reduce((n, p) => n + p.candidates.length, 0);
  console.log(`Wrote ${total} candidates for ${plants.length} plants to ${OUT}`);
}

main();

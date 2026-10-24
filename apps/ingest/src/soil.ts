import { createDatabase, multiPolygonFromWkt, recordProvenance, schema } from "@np/db";
import { SoilDataAccessClient } from "@np/sources";
import { inArray } from "drizzle-orm";
import type { IngestEnv, IngestResult } from "./types";

/**
 * SSURGO soil ingestion, through USDA Soil Data Access.
 *
 * The largest job: tens of thousands of map units across the launch counties.
 * It never runs with the monthly cron; run it by hand from the Run ingestion
 * workflow (choose `soil`) when the survey changes, roughly annually. It is
 * safe to re-run: units are replaced, not duplicated.
 *
 * It runs in slices. One Worker request is cut off by Cloudflare at about 100
 * seconds, and a full load takes several minutes, so each request does about a
 * minute of work and hands back a cursor ("UT611:75" is survey area UT611,
 * starting at its 76th map unit). The workflow calls again with the cursor
 * until there is none. A slice that is cut off anyway loses at most one batch
 * and the same cursor can simply be sent again.
 *
 * Survey areas are listed by symbol. A name search missed Ogden Valley (Eden)
 * on the first load, because the area covering it is named for Morgan County.
 * A symbol the service no longer returns is reported, so a renamed or retired
 * survey shows up in the output instead of silently dropping out.
 *
 * Provenance is recorded per survey area (record id = area symbol), once the
 * area is finished, not per map unit; tens of thousands of identical rows would
 * say nothing the area row does not.
 */

/**
 * SSURGO survey areas that cover any part of Salt Lake, Utah, Davis or Weber
 * counties, taken from the survey catalogue on 24 October 2026. Some also cover
 * neighbouring counties, so a few map units fall outside the market; that is
 * harmless, and cheaper than clipping.
 *
 *  UT607 Davis-Weber Area
 *  UT608 Fairfield-Nephi Area (Cedar Valley, west Utah County)
 *  UT609 Morgan Area (Morgan County and part of Weber County, incl. Ogden Valley)
 *  UT611 Tooele Area (parts of Davis County among others)
 *  UT612 Salt Lake Area
 *  UT613 Summit Area (parts of Salt Lake County among others)
 *  UT621 Utah County, Central Part
 *  UT622 Heber Valley Area (part of Utah County)
 *  UT627 Sanpete Valley Area (part of Utah County)
 */
export const WASATCH_SURVEY_AREAS = [
  "UT607",
  "UT608",
  "UT609",
  "UT611",
  "UT612",
  "UT613",
  "UT621",
  "UT622",
  "UT627",
] as const;

/** Map units fetched per batch. Geometry is the heavy part of each response. */
const BATCH = 25;

/**
 * Stop starting new batches after this long. Cloudflare cuts a request at about
 * 100 s, and one batch can take 10 s or more, so this leaves a wide margin.
 */
const DEFAULT_BUDGET_MS = 55_000;

const SOURCE_URL = "https://sdmdataaccess.nrcs.usda.gov/";

/** Wrapped, not bare — see the note in zones.ts on Illegal invocation. */
const defaultFetch: typeof fetch = (...args) => fetch(...args);

export interface SoilCursor {
  area: string;
  offset: number;
}

/** "UT611:75" to its parts, or null when it is not a cursor for one of our areas. */
export function parseSoilCursor(raw: string, allowed: readonly string[] = WASATCH_SURVEY_AREAS): SoilCursor | null {
  const match = /^(UT\d{3}):(\d{1,7})$/.exec(raw);
  if (!match || !allowed.includes(match[1]!)) return null;
  return { area: match[1]!, offset: Number(match[2]) };
}

/** The cursor for the next slice, or null when the area is finished. */
export function nextSoilCursor(area: string, processedTo: number, total: number): string | null {
  return processedTo >= total ? null : `${area}:${processedTo}`;
}

export interface SoilSliceResult extends IngestResult {
  /** Send this back as the cursor to continue, or null when this survey area is finished. */
  next: string | null;
}

export class SoilJob {
  readonly name = "soil";
  private readonly client: SoilDataAccessClient;

  constructor(
    private readonly areaSymbols: readonly string[] = WASATCH_SURVEY_AREAS,
    fetchImpl: typeof fetch = defaultFetch,
    private readonly budgetMs: number = DEFAULT_BUDGET_MS,
    private readonly now: () => number = Date.now,
  ) {
    this.client = new SoilDataAccessClient(fetchImpl);
  }

  /** The survey areas to load, one request chain each. */
  plan(): readonly string[] {
    return this.areaSymbols;
  }

  cursor(raw: string): SoilCursor | null {
    return parseSoilCursor(raw, this.areaSymbols);
  }

  async runSlice(env: IngestEnv, cursor: SoilCursor): Promise<SoilSliceResult> {
    const started = this.now();
    const warnings: string[] = [];
    const empty = (reason: string): SoilSliceResult => ({
      job: this.name,
      rowsWritten: 0,
      rowsSkipped: 0,
      warnings: [reason],
      next: null,
    });

    const [area] = await this.client.getSurveyAreas([cursor.area]);
    if (!area) return empty(`${cursor.area} is not in the survey catalogue (renamed or retired?).`);

    const units = await this.client.listMapUnits(cursor.area);
    if (units.length === 0) return empty(`${cursor.area} lists no map units.`);

    const names = new Map(units.map((u) => [u.mukey, u.name]));
    const db = createDatabase(env.HYPERDRIVE.connectionString);

    let position = cursor.offset;
    let rowsWritten = 0;
    const noGeometry: string[] = [];

    while (position < units.length && (position === cursor.offset || this.now() - started < this.budgetMs)) {
      const batch = units.slice(position, position + BATCH).map((u) => u.mukey);
      const geometries = await this.client.fetchGeometries(batch);
      const soilByKey = new Map((await this.client.fetchSoilForUnits(batch)).map((s) => [s.mukey, s]));

      const withGeometry = new Set(geometries.map((g) => g.mukey));
      for (const key of batch) if (!withGeometry.has(key)) noGeometry.push(key);

      for (const g of geometries) {
        const name = names.get(g.mukey) ?? "";
        await db
          .insert(schema.soilMapUnits)
          .values({ mukey: g.mukey, name, surveyArea: cursor.area, geom: multiPolygonFromWkt(g.wkt) })
          .onConflictDoUpdate({
            target: schema.soilMapUnits.mukey,
            set: { name, surveyArea: cursor.area, geom: multiPolygonFromWkt(g.wkt) },
          });
      }

      // Replace, don't append: a re-run must not double a unit's horizons.
      const written = geometries.map((g) => g.mukey);
      if (written.length > 0) {
        await db.delete(schema.soilProperties).where(inArray(schema.soilProperties.mukey, written));

        const properties = written.flatMap((mukey) => {
          const soil = soilByKey.get(mukey);
          return (soil?.horizons ?? []).map((h) => ({
            mukey,
            depthTopCm: h.depthTopCm,
            depthBottomCm: h.depthBottomCm,
            ph: h.ph,
            sandPct: h.sandPct,
            siltPct: h.siltPct,
            clayPct: h.clayPct,
            organicMatterPct: h.organicMatterPct,
            availableWaterCapacity: h.availableWaterCapacity,
            drainageClass: soil?.drainageClass ?? null,
          }));
        });
        if (properties.length > 0) await db.insert(schema.soilProperties).values(properties);
      }

      rowsWritten += geometries.length;
      position += batch.length;
    }

    const next = nextSoilCursor(cursor.area, position, units.length);

    if (noGeometry.length > 0) {
      warnings.push(`${cursor.area}: ${noGeometry.length} map units have no polygons (first few: ${noGeometry.slice(0, 5).join(" ")})`);
    }
    warnings.push(`${cursor.area} ${area.areaName}: units ${cursor.offset + 1} to ${position} of ${units.length}`);

    if (next === null) {
      const retrievedAt = new Date();
      await recordProvenance(db, [
        {
          tableName: "soil_map_units",
          recordId: cursor.area,
          source: "ssurgo",
          license: "Public domain (US Government work)",
          citation: `Soil Survey Staff, NRCS, USDA. Soil Survey Geographic Database (SSURGO), ${area.areaName} (${cursor.area}), via Soil Data Access, accessed ${retrievedAt.toISOString().slice(0, 10)}.`,
          sourceUrl: SOURCE_URL,
          retrievedAt,
        },
      ]);
    }

    return { job: this.name, rowsWritten, rowsSkipped: noGeometry.length, warnings, next };
  }
}

import { createDatabase, multiPolygonFromWkt, recordProvenance, schema } from "@np/db";
import { SoilDataAccessClient, type MapUnitSoil } from "@np/sources";
import { inArray } from "drizzle-orm";
import type { IngestEnv, IngestJob, IngestResult } from "./types";

/**
 * SSURGO soil ingestion, through USDA Soil Data Access.
 *
 * The largest job: tens of thousands of map units across the four launch
 * counties. It therefore never runs with the monthly cron; run it by hand
 * (`POST /__run?job=soil`) when the survey changes, which is roughly annually.
 * It is safe to re-run: units are replaced, not duplicated.
 *
 * Survey areas are listed by symbol. A name search missed Ogden Valley (Eden)
 * on the first load, because the area covering it is named for Morgan County.
 * A symbol the service no longer returns is reported as a warning, so a renamed
 * or retired survey shows up in the output instead of silently dropping out.
 *
 * Provenance is recorded per survey area (record id = area symbol), not per
 * map unit; tens of thousands of identical rows would say nothing the area row
 * does not.
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

/** Map units fetched per geometry request. Geometry is the heavy part of each response. */
const GEOMETRY_BATCH = 25;

const SOURCE_URL = "https://sdmdataaccess.nrcs.usda.gov/";

/** Wrapped, not bare — see the note in zones.ts on Illegal invocation. */
const defaultFetch: typeof fetch = (...args) => fetch(...args);

export class SoilJob implements IngestJob {
  readonly name = "soil";
  private readonly client: SoilDataAccessClient;

  constructor(
    private readonly areaSymbols: readonly string[] = WASATCH_SURVEY_AREAS,
    fetchImpl: typeof fetch = defaultFetch,
  ) {
    this.client = new SoilDataAccessClient(fetchImpl);
  }

  async run(env: IngestEnv): Promise<IngestResult> {
    const warnings: string[] = [];
    let rowsWritten = 0;
    let rowsSkipped = 0;

    const areas = await this.client.getSurveyAreas(this.areaSymbols);
    if (areas.length === 0) {
      return { job: this.name, rowsWritten: 0, rowsSkipped: 0, warnings: ["None of the survey area symbols were found."] };
    }
    const found = new Set(areas.map((a) => a.areaSymbol));
    const absent = this.areaSymbols.filter((s) => !found.has(s));
    if (absent.length > 0) warnings.push(`Survey areas not in the catalogue (renamed or retired?): ${absent.join(" ")}`);
    warnings.push(`Survey areas: ${areas.map((a) => `${a.areaSymbol} ${a.areaName}`).join("; ")}`);

    const db = createDatabase(env.HYPERDRIVE.connectionString);

    for (const area of areas) {
      const units = await this.client.listMapUnits(area.areaSymbol);
      const soilByKey = new Map<string, MapUnitSoil>();
      for (const s of await this.client.fetchSoil(area.areaSymbol)) soilByKey.set(s.mukey, s);

      const names = new Map(units.map((u) => [u.mukey, u.name]));
      const keys = units.map((u) => u.mukey);
      let areaWritten = 0;
      const noGeometry: string[] = [];

      for (let i = 0; i < keys.length; i += GEOMETRY_BATCH) {
        const batch = keys.slice(i, i + GEOMETRY_BATCH);
        const geometries = await this.client.fetchGeometries(batch);
        const withGeometry = new Set(geometries.map((g) => g.mukey));
        for (const key of batch) if (!withGeometry.has(key)) noGeometry.push(key);
        if (geometries.length === 0) continue;

        for (const g of geometries) {
          await db
            .insert(schema.soilMapUnits)
            .values({
              mukey: g.mukey,
              name: names.get(g.mukey) ?? "",
              surveyArea: area.areaSymbol,
              geom: multiPolygonFromWkt(g.wkt),
            })
            .onConflictDoUpdate({
              target: schema.soilMapUnits.mukey,
              set: {
                name: names.get(g.mukey) ?? "",
                surveyArea: area.areaSymbol,
                geom: multiPolygonFromWkt(g.wkt),
              },
            });
        }

        // Replace, don't append: a re-run must not double a unit's horizons.
        const written = geometries.map((g) => g.mukey);
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

        areaWritten += geometries.length;
      }

      rowsWritten += areaWritten;
      rowsSkipped += noGeometry.length;
      if (noGeometry.length > 0) {
        warnings.push(`${area.areaSymbol}: ${noGeometry.length} map units have no polygons (first few: ${noGeometry.slice(0, 5).join(" ")})`);
      }

      if (areaWritten > 0) {
        const retrievedAt = new Date();
        await recordProvenance(db, [
          {
            tableName: "soil_map_units",
            recordId: area.areaSymbol,
            source: "ssurgo",
            license: "Public domain (US Government work)",
            citation: `Soil Survey Staff, NRCS, USDA. Soil Survey Geographic Database (SSURGO), ${area.areaName} (${area.areaSymbol}), via Soil Data Access, accessed ${retrievedAt.toISOString().slice(0, 10)}.`,
            sourceUrl: SOURCE_URL,
            retrievedAt,
          },
        ]);
      }
    }

    return { job: this.name, rowsWritten, rowsSkipped, warnings };
  }
}

import { SourceShapeError } from "./types";

/**
 * USDA Soil Data Access (SDA), the query service in front of SSURGO.
 *
 * You POST a T-SQL query and get rows back. There is no API key. Responses
 * are capped (about 100,000 rows or 32 MB), so callers ask for one survey area
 * or one small batch of map units at a time.
 *
 * Written from the service documentation. The container this was written in
 * cannot reach the host, so the first real response is the first test of these
 * field names. Run the "Live source check" workflow to compare.
 */

const ENDPOINT = "https://SDMDataAccess.sc.egov.usda.gov/Tabular/post.rest";

/** Wrapped, not bare — see the note in geocode.ts on Illegal invocation. */
const defaultFetch: typeof fetch = (...args) => fetch(...args);

export type SdaRow = Record<string, string | null>;

/** One horizon of the dominant component of a map unit. Depths in cm. */
export interface SoilHorizon {
  depthTopCm: number;
  depthBottomCm: number;
  ph: number | null;
  sandPct: number | null;
  siltPct: number | null;
  clayPct: number | null;
  organicMatterPct: number | null;
  availableWaterCapacity: number | null;
}

export interface MapUnitSoil {
  mukey: string;
  /** Normalised to our drainage enum, or null when the survey gives none. */
  drainageClass: string | null;
  componentName: string;
  componentPct: number | null;
  horizons: SoilHorizon[];
}

export interface SurveyArea {
  areaSymbol: string;
  areaName: string;
}

export interface MapUnit {
  mukey: string;
  name: string;
}

export interface MapUnitGeometry {
  mukey: string;
  /** WKT in WGS84 (SRID 4326): POLYGON or MULTIPOLYGON. */
  wkt: string;
}

/** SDA drainage wording to the enum in @np/shared. Anything else becomes null. */
export function normalizeDrainageClass(raw: string | null): string | null {
  if (!raw) return null;
  const key = raw.trim().toLowerCase().replaceAll(" ", "_");
  const known = new Set([
    "excessively_drained",
    "somewhat_excessively_drained",
    "well_drained",
    "moderately_well_drained",
    "somewhat_poorly_drained",
    "poorly_drained",
    "very_poorly_drained",
  ]);
  return known.has(key) ? key : null;
}

function num(raw: string | null | undefined): number | null {
  if (raw === null || raw === undefined || raw.trim() === "") return null;
  const value = Number(raw);
  return Number.isNaN(value) ? null : value;
}

/** SDA string literals: double any single quote. Survey area symbols are alphanumeric, but never trust it. */
function literal(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

/**
 * Parse an SDA `JSON+COLUMNNAME` body: `{"Table":[["col","col"],["v","v"],...]}`.
 * The first row is the column names. A query with no rows returns an empty body
 * or no `Table` key, which is not an error.
 */
export function parseSdaTable(text: string): SdaRow[] {
  if (text.trim() === "") return [];

  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    // SDA reports SQL errors as plain text or XML with HTTP 200.
    throw new SourceShapeError("sda", `response is not JSON: ${text.slice(0, 160)}`);
  }

  const table = (body as { Table?: unknown }).Table;
  if (table === undefined) return [];
  if (!Array.isArray(table) || table.length === 0 || !Array.isArray(table[0])) {
    throw new SourceShapeError("sda", "Table is not an array of rows");
  }

  const columns = table[0] as string[];
  return (table.slice(1) as (string | null)[][]).map((cells) => {
    const row: SdaRow = {};
    columns.forEach((name, i) => {
      row[name.toLowerCase()] = cells[i] ?? null;
    });
    return row;
  });
}

function requireString(row: SdaRow, column: string): string {
  const value = row[column];
  if (value === null || value === undefined || value === "") {
    throw new SourceShapeError("sda", `row is missing "${column}"`);
  }
  return value;
}

/**
 * Pick each map unit's dominant component and keep its horizons.
 *
 * `rows` is one row per (component, horizon), as returned by the horizon
 * query. The dominant component is the one with the largest `comppct_r`; a
 * tie goes to the first listed. Components with no horizons (water, rock
 * outcrop, urban land) still produce a unit with an empty horizon list, so the
 * caller can tell "no data in the survey" from "not surveyed".
 */
export function dominantComponents(rows: SdaRow[]): MapUnitSoil[] {
  const byUnit = new Map<string, Map<string, SdaRow[]>>();
  for (const row of rows) {
    const mukey = requireString(row, "mukey");
    const cokey = requireString(row, "cokey");
    const components = byUnit.get(mukey) ?? new Map<string, SdaRow[]>();
    const list = components.get(cokey) ?? [];
    list.push(row);
    components.set(cokey, list);
    byUnit.set(mukey, components);
  }

  const result: MapUnitSoil[] = [];
  for (const [mukey, components] of byUnit) {
    let best: SdaRow[] | null = null;
    let bestPct = -1;
    for (const list of components.values()) {
      const pct = num(list[0]?.["comppct_r"]) ?? 0;
      if (pct > bestPct) {
        best = list;
        bestPct = pct;
      }
    }
    if (!best || !best[0]) continue;
    const first = best[0];

    const horizons: SoilHorizon[] = [];
    for (const row of best) {
      const top = num(row["hzdept_r"]);
      const bottom = num(row["hzdepb_r"]);
      // A LEFT JOIN yields a row with null depths for a component with no horizons.
      if (top === null || bottom === null || bottom <= top) continue;
      horizons.push({
        depthTopCm: top,
        depthBottomCm: bottom,
        ph: num(row["ph1to1h2o_r"]),
        sandPct: num(row["sandtotal_r"]),
        siltPct: num(row["silttotal_r"]),
        clayPct: num(row["claytotal_r"]),
        organicMatterPct: num(row["om_r"]),
        availableWaterCapacity: num(row["awc_r"]),
      });
    }
    horizons.sort((a, b) => a.depthTopCm - b.depthTopCm);

    result.push({
      mukey,
      drainageClass: normalizeDrainageClass(first["drainagecl"] ?? null),
      componentName: first["compname"] ?? "",
      componentPct: bestPct < 0 ? null : bestPct,
      horizons,
    });
  }
  return result;
}

export class SoilDataAccessClient {
  constructor(private readonly fetchImpl: typeof fetch = defaultFetch) {}

  async query(sql: string): Promise<SdaRow[]> {
    const response = await this.fetchImpl(ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ query: sql, format: "JSON+COLUMNNAME" }),
    });
    if (!response.ok) {
      throw new SourceShapeError("sda", `HTTP ${response.status}`);
    }
    return parseSdaTable(await response.text());
  }

  /** Survey areas whose name matches any of the given prefixes, e.g. "Salt Lake". */
  async findSurveyAreas(namePrefixes: readonly string[]): Promise<SurveyArea[]> {
    const where = namePrefixes.map((p) => `areaname LIKE ${literal(`${p}%`)}`).join(" OR ");
    const rows = await this.query(
      `SELECT areasymbol, areaname FROM sacatalog WHERE areasymbol LIKE 'UT%' AND (${where}) ORDER BY areasymbol`,
    );
    return rows.map((r) => ({ areaSymbol: requireString(r, "areasymbol"), areaName: requireString(r, "areaname") }));
  }

  /** Survey areas by exact symbol. A symbol missing from the result was renamed or dropped. */
  async getSurveyAreas(symbols: readonly string[]): Promise<SurveyArea[]> {
    if (symbols.length === 0) return [];
    const rows = await this.query(
      `SELECT areasymbol, areaname FROM sacatalog WHERE areasymbol IN (${symbols.map(literal).join(",")}) ORDER BY areasymbol`,
    );
    return rows.map((r) => ({ areaSymbol: requireString(r, "areasymbol"), areaName: requireString(r, "areaname") }));
  }

  async listMapUnits(areaSymbol: string): Promise<MapUnit[]> {
    const rows = await this.query(
      `SELECT m.mukey, m.muname FROM legend l JOIN mapunit m ON m.lkey = l.lkey ` +
        `WHERE l.areasymbol = ${literal(areaSymbol)} ORDER BY m.mukey`,
    );
    return rows.map((r) => ({ mukey: requireString(r, "mukey"), name: r["muname"] ?? "" }));
  }

  /**
   * One merged geometry per map unit. A map unit usually has many polygons
   * across the survey area; our table keeps one row per unit, so they are
   * unioned here rather than stored separately.
   */
  async fetchGeometries(mukeys: readonly string[]): Promise<MapUnitGeometry[]> {
    if (mukeys.length === 0) return [];
    const list = mukeys.map(literal).join(",");
    const rows = await this.query(
      `SELECT mukey, geometry::UnionAggregate(mupolygongeo).STAsText() AS wkt ` +
        `FROM mupolygon WHERE mukey IN (${list}) GROUP BY mukey`,
    );
    return rows
      .filter((r) => r["wkt"])
      .map((r) => ({ mukey: requireString(r, "mukey"), wkt: requireString(r, "wkt") }));
  }

  async fetchSoil(areaSymbol: string): Promise<MapUnitSoil[]> {
    const rows = await this.query(
      `SELECT m.mukey, c.cokey, c.compname, c.comppct_r, c.drainagecl, ` +
        `h.hzdept_r, h.hzdepb_r, h.ph1to1h2o_r, h.sandtotal_r, h.silttotal_r, h.claytotal_r, h.om_r, h.awc_r ` +
        `FROM legend l JOIN mapunit m ON m.lkey = l.lkey ` +
        `JOIN component c ON c.mukey = m.mukey AND c.majcompflag = 'Yes' ` +
        `LEFT JOIN chorizon h ON h.cokey = c.cokey ` +
        `WHERE l.areasymbol = ${literal(areaSymbol)} ` +
        `ORDER BY m.mukey, c.comppct_r DESC, c.cokey, h.hzdept_r`,
    );
    return dominantComponents(rows);
  }
}

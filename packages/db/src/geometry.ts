import { sql } from "drizzle-orm";
import { customType } from "drizzle-orm/pg-core";

/**
 * PostGIS geometry columns.
 *
 * Drizzle has no native PostGIS type, so these map to the underlying SQL
 * types and hand back WKT strings. Read them with ST_AsGeoJSON in a query
 * rather than parsing WKT in application code.
 *
 * SRID 4326 throughout — WGS84 lat/lon, what GPS and every data source we
 * ingest speaks. Mixing SRIDs is the classic silent spatial bug: queries
 * return empty rather than erroring.
 */
export const point = customType<{ data: string; driverData: string }>({
  dataType: () => "geometry(Point, 4326)",
});

export const multiPolygon = customType<{ data: string; driverData: string }>({
  dataType: () => "geometry(MultiPolygon, 4326)",
});

/**
 * A MultiPolygon from WKT, repaired if the source outline is invalid.
 *
 * Soil Data Access unions many polygons per map unit, and the result
 * occasionally has self-intersecting rings (6 of 471 units on the first load).
 * `ST_Covers` against an invalid shape can answer wrongly or fail, so every
 * shape is run through `ST_MakeValid` on the way in. `ST_CollectionExtract(…, 3)`
 * keeps only polygons, because repair can leave stray lines or points behind.
 */
export function multiPolygonFromWkt(wkt: string) {
  return sql`ST_Multi(ST_CollectionExtract(ST_MakeValid(ST_GeomFromText(${wkt}, 4326)), 3))`;
}

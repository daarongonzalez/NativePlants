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

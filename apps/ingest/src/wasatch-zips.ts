/**
 * ZIP codes for the launch market: Salt Lake, Utah, Davis and Weber counties.
 *
 * GENERATED - do not edit by hand. Regenerate by running the "Refresh
 * reference data" workflow, or:
 *
 *   node scripts/select-zips.mjs <census-zcta-county-file> apps/ingest/src/wasatch-zips.ts
 *
 * Source: U.S. Census Bureau 2020 ZCTA-to-county relationship file. A ZCTA is
 * kept when at least 10% of its land area is inside the four counties. ZCTAs
 * approximate ZIP codes but are not identical, so ZIPs from the previous list
 * are kept as well.
 *
 * A ZIP that is missing here means a real gardener hears "we do not cover your
 * area yet" for an address we do intend to cover.
 */
export const WASATCH_FRONT_ZIPS: readonly string[] = [
  "84003", "84004", "84005", "84006", "84009", "84010", "84013", "84014",
  "84015", "84020", "84025", "84037", "84040", "84041", "84042", "84043",
  "84044", "84045", "84047", "84054", "84056", "84057", "84058", "84059",
  "84062", "84065", "84067", "84070", "84075", "84081", "84084", "84087",
  "84088", "84092", "84093", "84094", "84095", "84096", "84097", "84101",
  "84102", "84103", "84104", "84105", "84106", "84107", "84108", "84109",
  "84111", "84112", "84113", "84114", "84115", "84116", "84117", "84118",
  "84119", "84120", "84121", "84123", "84124", "84128", "84129", "84138",
  "84150", "84180", "84310", "84315", "84317", "84401", "84403", "84404",
  "84405", "84408", "84414", "84601", "84602", "84604", "84606", "84626",
  "84629", "84633", "84651", "84653", "84655", "84660", "84663", "84664",
];

/**
 * ZIP codes for the launch market: Salt Lake, Utah, Davis and Weber counties.
 *
 * A hand-maintained list rather than a discovered one. Enumerating US ZIPs
 * would mean tens of thousands of requests against a volunteer-run service
 * for data outside our market, and this list is small enough to review.
 *
 * INCOMPLETE — this is a starting set covering the main population centres,
 * not every ZIP on the Wasatch Front. Expand it against a Census ZCTA list
 * for the four counties before launch; a missing ZIP means a real gardener
 * gets "we do not cover your area yet" for an address we do intend to cover.
 */
export const WASATCH_FRONT_ZIPS: readonly string[] = [
  // Salt Lake County
  "84101", "84102", "84103", "84104", "84105", "84106", "84107", "84108",
  "84109", "84111", "84112", "84115", "84116", "84117", "84118", "84119",
  "84120", "84121", "84123", "84124", "84128",
  "84020", "84047", "84065", "84070", "84081", "84084", "84088", "84092",
  "84093", "84094", "84095",
  // Utah County
  "84003", "84004", "84005", "84042", "84043", "84045", "84057", "84058",
  "84059", "84062", "84097", "84601", "84604", "84606", "84660", "84664",
  // Davis County
  "84010", "84014", "84015", "84025", "84037", "84040", "84041", "84054",
  "84056", "84075", "84087",
  // Weber County
  "84401", "84403", "84404", "84405", "84414", "84315", "84317", "84310",
];

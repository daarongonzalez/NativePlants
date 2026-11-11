/**
 * The yard estimate: what we can work out about a lot from public records and
 * an aerial photo, before the gardener draws anything. Shared so the API and
 * the pages agree on its shape.
 *
 * Every figure is an estimate and says so. The rebate program measures the
 * area itself at its first site visit.
 */

/** A point in metres on the drawing: x to the right, y down, from the top-left of the photo. */
export type DrawingPoint = [number, number];

export type YardZoneKind = "front" | "back" | "side";

export interface YardZone {
  kind: YardZoneKind;
  /** All open ground in this part of the lot. */
  areaSqft: number;
  /** Ground the photo shows growing: lawn, trees, shrubs and beds. Null if the photo could not be read. */
  plantedSqft: number | null;
  /** Ground the photo shows bare or paved: driveway, paths, patio, gravel. Null if the photo could not be read. */
  bareSqft: number | null;
  /** Rough size of this part, along the street and away from it, for the planner. */
  widthFt: number;
  depthFt: number;
}

export interface YardEstimate {
  /** From the county's records, via the Utah Geospatial Resource Center. */
  parcel: {
    county: string;
    /** "address": matched on house number and street; "nearest": the closest lot to the point. */
    matchedBy: "address" | "nearest";
    lotSqft: number;
    /** Floor area as the county records it, which is not the footprint. */
    recordedBuildingSqft: number | null;
    floors: number | null;
    builtYear: number | null;
    propertyClass: string | null;
    /** When the county's records were last updated. */
    recordsAsOf: string | null;
  };
  /** The house and any other buildings on the lot, as the photo outline shows them. */
  buildingSqft: number;
  /** Lot minus buildings. */
  openSqft: number;
  /** Null when the photo service did not answer: the outlines still give the yard sizes. */
  plantedSqft: number | null;
  bareSqft: number | null;
  zones: YardZone[];
  /** The aerial photo the green and bare areas were read from. */
  photo: {
    /** False when the photo service did not answer in time; the page then shows the outlines only. */
    read: boolean;
    /** A natural-colour image of the lot, served by the US Geological Survey. */
    url: string;
    takenOn: string | null;
    metresPerPixel: number;
    source: string;
  };
  /** Shapes to draw over the photo, in metres from its top-left corner. */
  drawing: {
    widthM: number;
    heightM: number;
    lot: DrawingPoint[];
    buildings: DrawingPoint[][];
    /** The lot edge we take to face the street. */
    street: [DrawingPoint, DrawingPoint] | null;
    /**
     * One character per photo pixel, row by row: "p" planted, "b" bare,
     * "u" not read, "h" building, "." outside the lot. Lets the page show what was counted.
     */
    cells: { columns: number; rows: number; codes: string };
  };
  /** Plain warnings, e.g. a large or shared lot, or a photo taken outside the growing season. */
  caveats: string[];
}

export const SQFT_PER_M2 = 10.7639;

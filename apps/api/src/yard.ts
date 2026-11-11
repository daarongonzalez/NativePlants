import { blankGrid, measureYard, toDrawing, toUtm12, type NdviGrid } from "@np/engine";
import type { YardEstimate } from "@np/shared";
import { chooseLot, naipImageUrl, type LotRecord, type UtahYardSources, type UtmRing } from "@np/sources";

/**
 * The yard estimate for a point: find the lot, its buildings and the aerial
 * photo, then measure. Nothing here is saved.
 */

/** Room around the lot in the photo, in metres, so its edges are visible. */
const MARGIN_M = 6;
/** The photo's own resolution. Large lots are read more coarsely to keep the work small. */
const NATIVE_M = 0.6;
const MAX_CELLS_ACROSS = 220;
/** Above this, the lot is not a typical home lot, and the estimate says so. */
const LARGE_LOT_SQFT = 43_560;

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export type YardOutcome =
  | { ok: true; estimate: YardEstimate }
  | { ok: false; reason: "no_lot" | "lot_too_large" };

function bounds(rings: UtmRing[]): [number, number, number, number] {
  const pts = rings.flat();
  return [
    Math.min(...pts.map((p) => p[0])),
    Math.min(...pts.map((p) => p[1])),
    Math.max(...pts.map((p) => p[0])),
    Math.max(...pts.map((p) => p[1])),
  ];
}

export async function estimateYard(
  sources: Pick<UtahYardSources, "lotsNear" | "buildingsIn" | "infrared" | "photoDate">,
  place: { latitude: number; longitude: number; address: string | null },
): Promise<YardOutcome> {
  const point = toUtm12(place.latitude, place.longitude);
  const lots = await sources.lotsNear(place.latitude, place.longitude);
  const chosen = chooseLot(lots, point, place.address);
  if (!chosen) return { ok: false, reason: "no_lot" };
  const { lot, matchedBy } = chosen;

  const [lx0, ly0, lx1, ly1] = bounds(lot.rings);
  const span = Math.max(lx1 - lx0, ly1 - ly0) + 2 * MARGIN_M;
  // A field or a campus is not something this estimate can help with.
  if (span > 600) return { ok: false, reason: "lot_too_large" };
  const metresPerPixel = Math.max(NATIVE_M, span / MAX_CELLS_ACROSS);
  const box: [number, number, number, number] = [lx0 - MARGIN_M, ly0 - MARGIN_M, lx1 + MARGIN_M, ly1 + MARGIN_M];

  // The photo is a bonus: if its service is slow or down, the outlines still
  // give the lot, the house and the yard sizes.
  const [buildings, infrared, takenOn] = await Promise.all([
    sources.buildingsIn([lx0, ly0, lx1, ly1]),
    sources.infrared(box, metresPerPixel).catch((error: unknown) => {
      console.warn("yard: photo not read", String(error));
      return null;
    }),
    sources.photoDate(place.latitude, place.longitude).catch(() => null),
  ]);
  const grid: NdviGrid = infrared ?? blankGrid(box, metresPerPixel);

  const m = measureYard({ lot: lot.rings, buildings, grid, streetPoint: point });

  const widthM = Math.round(grid.columns * grid.metresPerPixel * 100) / 100;
  const heightM = Math.round(grid.rows * grid.metresPerPixel * 100) / 100;
  // A sharper photo for people to look at than the one measured: up to 2 pixels a metre.
  const viewScale = Math.min(2, 800 / Math.max(widthM, heightM));
  const photoUrl = naipImageUrl(box, Math.round(widthM * viewScale), Math.round(heightM * viewScale)).toString();

  return {
    ok: true,
    estimate: {
      parcel: {
        county: lot.county,
        matchedBy,
        lotSqft: m.lotSqft,
        recordedBuildingSqft: lot.buildingSqft,
        floors: lot.floors,
        builtYear: lot.builtYear,
        propertyClass: lot.propertyClass,
        recordsAsOf: lot.recordsAsOf,
      },
      buildingSqft: m.buildingSqft,
      openSqft: m.openSqft,
      plantedSqft: m.plantedSqft,
      bareSqft: m.bareSqft,
      zones: m.zones,
      photo: {
        read: infrared !== null,
        url: photoUrl,
        takenOn,
        metresPerPixel: Math.round(grid.metresPerPixel * 100) / 100,
        source: "USDA National Agriculture Imagery Program, via the US Geological Survey",
      },
      drawing: {
        widthM,
        heightM,
        lot: lot.rings[0]!.map((p) => toDrawing(grid, p)),
        buildings: m.buildings.map((b) => b.map((p) => toDrawing(grid, p))),
        street: [toDrawing(grid, m.street[0]), toDrawing(grid, m.street[1])],
        cells: m.cells,
      },
      caveats: [
        ...(infrared ? [] : ["We could not read the aerial photo just now, so planted and bare areas are missing. Try again later."]),
        ...caveatsFor(lot, matchedBy, m.lotSqft, m.buildingSqft, infrared ? takenOn : null),
      ],
    },
  };
}

/** Plain warnings about this particular estimate. */
export function caveatsFor(
  lot: LotRecord,
  matchedBy: "address" | "nearest",
  lotSqft: number,
  buildingSqft: number,
  takenOn: string | null,
): string[] {
  const out: string[] = [];
  if (matchedBy === "nearest") {
    out.push("We could not match your address to a lot exactly, so we used the nearest one. Check the outline is yours.");
  }
  if ((lot.houseCount ?? 1) > 1 || (lot.propertyClass && !/resid/i.test(lot.propertyClass))) {
    out.push("County records list this lot as shared or not a single home. The estimate covers the whole lot.");
  }
  if (lotSqft > LARGE_LOT_SQFT) {
    out.push("This is a large lot, so the estimate is rougher than usual. Plan one area at a time.");
  }
  if (lot.buildingSqft && lot.floors && lot.floors >= 1 && buildingSqft < (lot.buildingSqft / lot.floors) * 0.6) {
    out.push("The house outline looks smaller than county records suggest. An addition may be missing from the outline.");
  }
  if (takenOn) {
    const month = Number(takenOn.slice(5, 7));
    if (month < 5 || month > 9) {
      out.push(
        `The photo was taken in ${MONTHS[month - 1]} ${takenOn.slice(0, 4)}, outside the growing season, so some lawn may read as bare.`,
      );
    }
  }
  out.push("Bare ground right next to the house can include roof edges, decks or a patio.");
  out.push("Trees count as planted area. Their shade is not plant cover for the rebate.");
  return out;
}

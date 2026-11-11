# Yard estimate

Status: built 11 November 2026.

When a gardener enters an address, the report page now estimates their yard:
the lot, the house, how much ground is planted or bare, and the front, back
and side yards. The gardener picks the part they will plan first and says how
much of it is lawn. The planner then opens at about that size, and the plan
records the estimate it started from.

It is an estimate, not a survey, and every page says so. The rebate program
measures the area itself at its first site visit.

## Where the numbers come from

All free and public. No map provider and no key.

| What | Source | Notes |
|---|---|---|
| Lot outline, building floor area, floors, year built | County parcel records, published by UGRC (Salt Lake, Utah, Davis, Weber) | Updated once a year after the tax roll. We never request values or owner fields. |
| Building outlines | Microsoft building footprints, via UGRC | Traced from 2018 imagery. Lined up with the photo for each lot (see below). Open data under the ODbL licence. |
| Planted and bare ground | USDA NAIP aerial photo, via the US Geological Survey | 60 cm a pixel, with a near-infrared band. The service currently serves 2021 photos for Salt Lake City, some taken in November. |

## How it is worked out

`packages/engine/src/yard.ts` (pure, tested) does the measuring:

1. **Find the lot.** Search 40 m around the address point in all four
   counties. Pick the lot whose address matches (house number and street
   name). If several parcels share it, take the biggest; failing a match,
   take the nearest, and say so. The Census geocoder puts addresses on the
   street, not inside the lot, which is why this is a search, not a lookup.
2. **Line up the buildings.** Outlines often sit a few feet off the roofs in
   a newer photo. Each outline is nudged up to 6 pixels each way, to where it
   covers the least growing ground (roofs do not grow).
3. **Sort every pixel inside the lot** into building, planted (infrared
   reading above 0.15) or bare.
4. **Split the yard.** The lot edge nearest the address point faces the
   street. Ground between it and the house is the front yard, ground beyond
   the house is the backyard, and the rest is side yard. The biggest
   building sets these lines; garages and sheds count as built-on ground.
5. **Scale** pixel counts so they add up to the lot outline's own area.

The page then starts the planner from the chosen zone
(`apps/web/app/lib/yard.ts`): about the lawn the gardener entered, in 5 ft
squares, never deeper than the yard and within the planner's 4,000 sq ft.

## When something is missing

- **The photo service is down or slow** (it often answers "gateway timeout"
  for a few seconds): one retry, then the estimate carries on without it.
  Lot, house and yard sizes still show; planted and bare say "Not read".
- **No lot found** (outside our counties, or not in the records): the report
  says so, and the planner works as before with a default size.
- **The county services fail**: the same.

The yard route caches a full answer at the edge for an hour, so the report
and the planner do not ask the services twice.

## Tested on

Six real lots across all four counties, through the live services. All six
matched their lot by address; five read the photo first time, and the one
that did not still gave its lot and yard sizes. Each took about 3 seconds.

## Known limits

- **Trees and lawn both read as planted.** The photo cannot tell them apart.
  The page calls it "planted" and asks the gardener how much is lawn. Utah's
  lidar (laser height scans) could separate trees, but the Wasatch Front scan
  dates from 2013 to 2014.
- **Bare ground next to the house** can be roof edges, decks or a patio,
  where the outline is smaller than the real roof.
- **Corner lots** have two street sides; the estimate picks the one nearest
  the address point.
- **The photo date** comes from a slow catalogue query and is often missing.
  When it is known and falls outside May to September, the page warns that
  some lawn may read as bare.
- **The USDA's 2024 Utah photos** are not reachable from the service we use,
  and UGRC's 6-inch 2024 photos are licensed to public bodies and their
  partners only. A water district partnership would give us both sharper
  photos and permission to let gardeners trace their yard.

## Code

- `packages/engine/src/yard.ts`: measuring, alignment, UTM conversion
- `packages/sources/src/yard.ts`: parcels, buildings, the photo
- `packages/sources/src/png.ts`: reads the photo in a Worker, no library
- `apps/api/src/yard.ts` and `POST /v1/public/yard`: puts them together
- `apps/web/app/components/flow/YardPanel.tsx`: the report section
- `apps/web/app/lib/yard.ts`: the planner's starting size and the link

import type { Plant, SiteProfile } from "@np/shared";

/**
 * Hand-checked fixtures for the Wasatch Front, our launch market.
 *
 * These values are realistic but illustrative, and they are NOT yet reviewed
 * by a horticulturist. Before V1 ships, every plant record here must be
 * verified by the named reviewer and `reviewStatus` moved to "reviewed".
 * Until then, treat failures here as a signal about the engine's behaviour,
 * not as horticultural truth.
 */

const PROV = {
  source: "ssurgo",
  confidence: "high",
  retrievedAt: "2026-09-01T00:00:00.000Z",
} as const;

const USER_PROV = {
  source: "user_reported",
  confidence: "medium",
  retrievedAt: "2026-09-01T00:00:00.000Z",
} as const;

/**
 * A typical Salt Lake valley back yard: alkaline clay loam, zone 7b, full sun.
 * The pH near 8.0 is the defining feature of Wasatch Front soils and the
 * single most common reason national plant advice fails here.
 */
export const sltSunnyClay: SiteProfile = {
  siteId: "11111111-1111-4111-8111-111111111111",
  resolvedAt: "2026-09-01T00:00:00.000Z",
  latitude: 40.7608,
  longitude: -111.891,
  zoneOrdinal: { value: 72, provenance: { ...PROV, source: "usda_phzm" } },
  frost: {
    value: {
      lastSpringP10: "05-08",
      lastSpringP50: "04-24",
      lastSpringP90: "04-09",
      firstFallP10: "10-05",
      firstFallP50: "10-19",
      firstFallP90: "11-02",
      frostFreeDays: 178,
    },
    provenance: { ...PROV, source: "noaa_normals" },
  },
  ph: { value: 8.0, provenance: PROV },
  sandPct: { value: 32, provenance: PROV },
  siltPct: { value: 34, provenance: PROV },
  clayPct: { value: 34, provenance: PROV },
  drainageClass: { value: "moderately_well_drained", provenance: PROV },
  sunHoursSummer: { value: 8.5, provenance: { ...PROV, source: "solar_geometry" } },
  constraints: {
    deerPressure: false,
    pets: true,
    youngChildren: false,
    irrigationAvailable: true,
    hoaRestrictions: false,
  },
};

/** The same valley, but a shaded north-side bed with no irrigation run to it. */
export const sltShadedDry: SiteProfile = {
  ...sltSunnyClay,
  siteId: "22222222-2222-4222-8222-222222222222",
  sunHoursSummer: { value: 3.0, provenance: { ...USER_PROV, source: "user_reported" } },
  constraints: { ...sltSunnyClay.constraints, irrigationAvailable: false },
};

function plant(overrides: Partial<Plant> & Pick<Plant, "id" | "scientificName" | "commonNames">): Plant {
  return {
    family: "Unknown",
    phMin: 6.0,
    phOptimum: 7.0,
    phMax: 8.0,
    sun: { minHours: 6, maxHours: 12 },
    waterUse: "moderate",
    drainageTolerated: ["well_drained", "moderately_well_drained"],
    zoneMinOrdinal: 41,
    zoneMaxOrdinal: 92,
    matureHeightCm: 90,
    matureWidthCm: 60,
    bloomStartMonth: 5,
    bloomEndMonth: 7,
    nativeStatus: "adapted",
    deerResistant: false,
    pollinatorValue: "moderate",
    edible: false,
    goodForCutting: false,
    toxicityNote: null,
    curatedBy: "fixture",
    curatedAt: "2026-09-01T00:00:00.000Z",
    reviewStatus: "draft",
    ...overrides,
  };
}

/** Utah native. Thrives in exactly the alkaline clay that defeats most imports. */
export const firecrackerPenstemon = plant({
  id: "aaaaaaaa-0000-4000-8000-000000000001",
  scientificName: "Penstemon eatonii",
  commonNames: ["Firecracker Penstemon", "Eaton's Penstemon"],
  family: "Plantaginaceae",
  phMin: 6.5,
  phOptimum: 7.8,
  phMax: 8.5,
  sun: { minHours: 6, maxHours: 14 },
  waterUse: "very_low",
  drainageTolerated: ["well_drained", "moderately_well_drained", "somewhat_excessively_drained"],
  zoneMinOrdinal: 41,
  zoneMaxOrdinal: 91,
  matureHeightCm: 90,
  matureWidthCm: 45,
  nativeStatus: "native",
  deerResistant: true,
  pollinatorValue: "high",
});

/** Utah native shrub, very drought tolerant once established. */
export const skunkbushSumac = plant({
  id: "aaaaaaaa-0000-4000-8000-000000000002",
  scientificName: "Rhus trilobata",
  commonNames: ["Skunkbush Sumac", "Three-leaf Sumac"],
  family: "Anacardiaceae",
  phMin: 6.0,
  phOptimum: 7.5,
  phMax: 8.5,
  sun: { minHours: 4, maxHours: 14 },
  waterUse: "very_low",
  drainageTolerated: [
    "well_drained",
    "moderately_well_drained",
    "somewhat_excessively_drained",
    "excessively_drained",
  ],
  matureHeightCm: 200,
  matureWidthCm: 250,
  nativeStatus: "native",
  deerResistant: true,
  pollinatorValue: "moderate",
});

/** Widely adapted, tolerates alkaline soil, good cut flower. */
export const yarrow = plant({
  id: "aaaaaaaa-0000-4000-8000-000000000003",
  scientificName: "Achillea millefolium",
  commonNames: ["Common Yarrow"],
  family: "Asteraceae",
  phMin: 5.5,
  phOptimum: 7.0,
  phMax: 8.2,
  sun: { minHours: 6, maxHours: 14 },
  waterUse: "low",
  zoneMinOrdinal: 31,
  zoneMaxOrdinal: 92,
  nativeStatus: "regionally_native",
  deerResistant: true,
  pollinatorValue: "high",
  goodForCutting: true,
});

/** The classic wrong answer. Big-box stores sell these across the Wasatch Front. */
export const highbushBlueberry = plant({
  id: "aaaaaaaa-0000-4000-8000-000000000004",
  scientificName: "Vaccinium corymbosum",
  commonNames: ["Highbush Blueberry"],
  family: "Ericaceae",
  phMin: 4.5,
  phOptimum: 5.0,
  phMax: 5.5,
  waterUse: "high",
  zoneMinOrdinal: 31,
  zoneMaxOrdinal: 81,
  edible: true,
  pollinatorValue: "moderate",
});

/** Rejected on drainage, not pH — a different exclusion path. */
export const marshMarigold = plant({
  id: "aaaaaaaa-0000-4000-8000-000000000005",
  scientificName: "Caltha palustris",
  commonNames: ["Marsh Marigold"],
  family: "Ranunculaceae",
  phMin: 6.0,
  phOptimum: 7.0,
  phMax: 8.0,
  drainageTolerated: ["poorly_drained", "very_poorly_drained"],
  waterUse: "high",
  toxicityNote: "Sap can irritate skin; all parts toxic if eaten raw.",
});

/** Too tender for a zone 7b winter. */
export const bougainvillea = plant({
  id: "aaaaaaaa-0000-4000-8000-000000000006",
  scientificName: "Bougainvillea glabra",
  commonNames: ["Paper Flower"],
  family: "Nyctaginaceae",
  zoneMinOrdinal: 91,
  zoneMaxOrdinal: 111,
  waterUse: "low",
});

export const wasatchCatalogue: Plant[] = [
  firecrackerPenstemon,
  skunkbushSumac,
  yarrow,
  highbushBlueberry,
  marshMarigold,
  bougainvillea,
];

import type { Plant, WaterUse, NativeStatus } from "@np/shared";
import type { plants } from "./schema";

type PlantRow = typeof plants.$inferSelect;

/**
 * Storage shape to domain shape.
 *
 * The table stores sun as two flat columns because that is what indexes and
 * queries well; the domain type nests them because that is what reads well in
 * the engine. Rather than bend one to the other, the boundary is explicit and
 * lives here — so the engine never sees a database row and the schema is free
 * to change independently.
 */
export function toDomainPlant(row: PlantRow): Plant {
  return {
    id: row.id,
    scientificName: row.scientificName,
    commonNames: row.commonNames,
    family: row.family,

    phMin: row.phMin,
    phOptimum: row.phOptimum,
    phMax: row.phMax,

    sun: { minHours: row.sunMinHours, maxHours: row.sunMaxHours },
    waterUse: row.waterUse as WaterUse,
    drainageTolerated: row.drainageTolerated,

    zoneMinOrdinal: row.zoneMinOrdinal,
    zoneMaxOrdinal: row.zoneMaxOrdinal,

    matureHeightCm: row.matureHeightCm,
    matureWidthCm: row.matureWidthCm,

    bloomStartMonth: row.bloomStartMonth,
    bloomEndMonth: row.bloomEndMonth,

    nativeStatus: row.nativeStatus as NativeStatus,
    deerResistant: row.deerResistant,
    pollinatorValue: row.pollinatorValue as Plant["pollinatorValue"],
    edible: row.edible,
    goodForCutting: row.goodForCutting,
    toxicityNote: row.toxicityNote,

    curatedBy: row.curatedBy,
    curatedAt: row.curatedAt.toISOString(),
    reviewStatus: row.reviewStatus as Plant["reviewStatus"],
  };
}

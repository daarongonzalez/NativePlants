/**
 * The plants drawn in Nativo Garden (app/assets/nativo-garden.riv), with the
 * words the game shows for each. The drawings are made by the game's own
 * script, so this list is how the review page knows which plants have one.
 *
 * Copied from the game file on 9 November 2026. When the game changes, update
 * this list: the review page compares the game's words with the plant sheet.
 */
export interface GardenSprite {
  /** As named in the game. */
  gameName: string;
  shortName: string;
  scientificName: string;
  /** The game's one-line description, or null if it shows none. */
  gameText: string | null;
}

export const GARDEN_SPRITES: GardenSprite[] = [
  { gameName: "Firecracker penstemon", shortName: "Penstemon", scientificName: "Penstemon eatonii", gameText: "Low water. Blooms April to June." },
  // The game draws Desert globemallow; the sheet has Scarlet globemallow (Sphaeralcea coccinea). See matchSprite.
  { gameName: "Desert globemallow", shortName: "Globemallow", scientificName: "Sphaeralcea ambigua", gameText: "Very low water. Blooms May to August." },
  { gameName: "Sulphur-flower buckwheat", shortName: "Buckwheat", scientificName: "Eriogonum umbellatum", gameText: "Very low water. Blooms June to August." },
  { gameName: "Blue flax", shortName: "Blue flax", scientificName: "Linum lewisii", gameText: "Low water. Blooms May to August." },
  { gameName: "Blanketflower", shortName: "Blanketflower", scientificName: "Gaillardia aristata", gameText: "Low water. Blooms June to September." },
  { gameName: "Yarrow", shortName: "Yarrow", scientificName: "Achillea millefolium", gameText: null },
  { gameName: "Showy milkweed", shortName: "Milkweed", scientificName: "Asclepias speciosa", gameText: "Low water. Blooms June to August." },
  { gameName: "Purple sage", shortName: "Purple sage", scientificName: "Salvia dorrii", gameText: "Very low water. Blooms May to July." },
  { gameName: "Prairie coneflower", shortName: "Coneflower", scientificName: "Ratibida columnifera", gameText: null },
  { gameName: "Blue grama", shortName: "Blue grama", scientificName: "Bouteloua gracilis", gameText: "Very low water. Seed heads July to September." },
];

/**
 * The game's drawing for a plant. An exact name match first. Failing that, a
 * same-genus match, flagged, but only for a game plant that is not in the
 * catalogue under its own name: so the reviewer sees when the game draws a
 * different species (Desert globemallow) from the sheet's (Scarlet
 * globemallow), without every penstemon claiming the firecracker's drawing.
 */
export function matchSprite(
  scientificName: string,
  catalogue: ReadonlySet<string>,
): { sprite: GardenSprite; exact: boolean } | null {
  const exact = GARDEN_SPRITES.find((s) => s.scientificName === scientificName);
  if (exact) return { sprite: exact, exact: true };
  const genus = scientificName.split(" ")[0];
  const orphan = GARDEN_SPRITES.find((s) => !catalogue.has(s.scientificName) && s.scientificName.split(" ")[0] === genus);
  return orphan ? { sprite: orphan, exact: false } : null;
}

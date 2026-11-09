import { describe, expect, it } from "vitest";
import type { PlanPlant } from "@np/shared";
import { MAX_QUANTITY, addPlant, parseList, removePlant, savePlanPlants, setQuantity, totalPlants } from "./plant-list";

const plant = (id: string, commonName = `Plant ${id}`): PlanPlant => ({
  id,
  commonName,
  scientificName: "Testus plantus",
  matureHeightCm: 60,
  matureWidthCm: 90,
  lifeCycle: "perennial",
  plantForm: "wildflower",
  staysUnder24In: false,
  reviewStatus: "draft",
});

const NOW = "2026-11-08T12:00:00.000Z";

describe("plant list", () => {
  it("adds a plant once, with a quantity of one", () => {
    const once = addPlant([], plant("a"), NOW);
    expect(once).toHaveLength(1);
    expect(once[0]).toMatchObject({ id: "a", quantity: 1, savedAt: NOW });
    expect(addPlant(once, plant("a"), NOW)).toBe(once);
  });

  it("saves a plan's counts without doubling on a second save", () => {
    const items = [
      { plant: plant("a"), count: 12 },
      { plant: plant("b"), count: 3 },
    ];
    const first = savePlanPlants(addPlant([], plant("a"), NOW), items, NOW);
    expect(first.map((p) => [p.id, p.quantity])).toEqual([
      ["a", 12],
      ["b", 3],
    ]);
    expect(savePlanPlants(first, items, NOW)).toEqual(first);
    expect(totalPlants(first)).toBe(15);
  });

  it("keeps quantities between one and the maximum", () => {
    const list = addPlant([], plant("a"), NOW);
    expect(setQuantity(list, "a", 0)[0]!.quantity).toBe(1);
    expect(setQuantity(list, "a", 5000)[0]!.quantity).toBe(MAX_QUANTITY);
    expect(setQuantity(list, "a", 4.6)[0]!.quantity).toBe(5);
  });

  it("removes a plant", () => {
    const list = addPlant(addPlant([], plant("a"), NOW), plant("b"), NOW);
    expect(removePlant(list, "a").map((p) => p.id)).toEqual(["b"]);
  });

  it("reads storage safely", () => {
    expect(parseList(null)).toEqual([]);
    expect(parseList("not json")).toEqual([]);
    expect(parseList('{"id":"a"}')).toEqual([]);
    const good = addPlant([], plant("a"), NOW);
    expect(parseList(JSON.stringify([...good, { id: 3 }, null]))).toEqual(good);
  });
});

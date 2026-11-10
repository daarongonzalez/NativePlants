import { describe, expect, it } from "vitest";
import type { ReviewPlant } from "@np/shared";
import { GARDEN_SPRITES, matchSprite } from "../content/garden-sprites";
import {
  bloomText,
  choosePhoto,
  counts,
  factGroups,
  gameTextMismatches,
  matchesFilter,
  nextPlantId,
  photoGaps,
  reviewState,
  sizeText,
} from "./review";

const plant = (id: string, over: Partial<ReviewPlant> = {}): ReviewPlant => ({
  id,
  scientificName: `Testus ${id}`,
  commonNames: [`Plant ${id}`],
  family: "Testaceae",
  phMin: 6,
  phOptimum: 7,
  phMax: 8.5,
  sunMinHours: 6,
  sunMaxHours: 24,
  waterUse: "low",
  drainageTolerated: ["well_drained"],
  zoneMinOrdinal: 5,
  zoneMaxOrdinal: 17,
  matureHeightCm: 75,
  matureWidthCm: 45,
  lifeCycle: "perennial",
  plantForm: "wildflower",
  staysUnder24In: false,
  bloomStartMonth: 4,
  bloomEndMonth: 6,
  nativeStatus: "native",
  deerResistant: true,
  pollinatorValue: "high",
  edible: false,
  goodForCutting: true,
  toxicityNote: null,
  curatedBy: "Claude draft (unreviewed)",
  reviewStatus: "draft",
  reviewedBy: null,
  reviewedAt: null,
  photos: [],
  lastReview: null,
  ...over,
});

const reviewed = (decision: "pass" | "fail", factsChangedSince = false): ReviewPlant["lastReview"] => ({
  decision,
  notes: null,
  spriteCheck: null,
  reviewerEmail: "rachel@example.com",
  createdAt: "2026-11-09T00:00:00Z",
  factsChangedSince,
});

describe("the review queue", () => {
  const list = [
    plant("a"),
    plant("b", { lastReview: reviewed("pass") }),
    plant("c", { lastReview: reviewed("fail") }),
    plant("d", { lastReview: reviewed("pass", true) }),
  ];

  it("puts unreviewed plants, and plants changed since review, in To review", () => {
    expect(list.map(reviewState)).toEqual(["todo", "passed", "failed", "changed"]);
    expect(list.filter((p) => matchesFilter(p, "todo")).map((p) => p.id)).toEqual(["a", "d"]);
    expect(counts(list)).toEqual({ todo: 2, failed: 1, passed: 1, all: 4 });
  });

  it("moves on to the next plant that still needs a look, wrapping round", () => {
    expect(nextPlantId(list, "todo", null)).toBe("a");
    expect(nextPlantId(list, "todo", "a", new Set(["a"]))).toBe("d");
    expect(nextPlantId(list, "todo", "d", new Set(["d"]))).toBe("a");
    expect(nextPlantId(list, "todo", "d", new Set(["a", "d"]))).toBeNull();
  });
});

describe("facts in plain words", () => {
  it("writes sizes and bloom months a reviewer can check at a glance", () => {
    expect(sizeText(75)).toBe("2.5 ft (75 cm)");
    expect(sizeText(30)).toBe("12 in (30 cm)");
    expect(bloomText({ bloomStartMonth: 4, bloomEndMonth: 6 })).toBe("April to June");
    expect(bloomText({ bloomStartMonth: null, bloomEndMonth: null })).toBe("Not recorded");
  });

  it("flags a park strip claim on a plant taller than 24 inches", () => {
    const facts = factGroups(plant("a", { staysUnder24In: true, matureHeightCm: 75 })).flatMap((g) => g.facts);
    expect(facts.find((f) => f.label.startsWith("Stays under 24"))).toMatchObject({ value: "Yes", warn: true });
  });

  it("always shows a toxicity warning when there is one", () => {
    const facts = factGroups(plant("a", { toxicityNote: "Toxic to cats" })).flatMap((g) => g.facts);
    expect(facts.find((f) => f.label === "Toxicity")).toEqual({ label: "Toxicity", value: "Toxic to cats", warn: true });
  });
});

describe("the garden game against the sheet", () => {
  const catalogue = new Set(["Penstemon eatonii", "Penstemon strictus", "Sphaeralcea coccinea"]);

  it("matches the game's drawing by name, and only flags a genus match for a species we do not carry", () => {
    expect(matchSprite("Penstemon eatonii", catalogue)).toMatchObject({ exact: true });
    expect(matchSprite("Penstemon strictus", catalogue)).toBeNull();
    expect(matchSprite("Sphaeralcea coccinea", catalogue)).toMatchObject({
      exact: false,
      sprite: { scientificName: "Sphaeralcea ambigua" },
    });
  });

  it("finds no disagreement where the game and sheet agree", () => {
    const pen = GARDEN_SPRITES.find((s) => s.scientificName === "Penstemon eatonii")!;
    expect(gameTextMismatches(pen.gameText, { waterUse: "low", bloomStartMonth: 4, bloomEndMonth: 6 })).toEqual([]);
  });

  it("says plainly where they disagree", () => {
    expect(gameTextMismatches("Low water. Blooms May to August.", { waterUse: "very_low", bloomStartMonth: 5, bloomEndMonth: 9 })).toEqual([
      "The game says low water; the sheet says very low water.",
      "The game says May to August; the sheet says May to September.",
    ]);
    expect(gameTextMismatches("Very low water. Seed heads July to September.", { waterUse: "very_low", bloomStartMonth: 7, bloomEndMonth: 9 })).toEqual([]);
  });
});

describe("photo choices", () => {
  const start = ["p1", "p2", "p3"].map((id) => ({ id, status: "candidate" as const, kind: null, note: null }));

  it("keeps one main photo and one close-up, without losing the old pick", () => {
    let c = choosePhoto(start, "p1", "habit");
    c = choosePhoto(c, "p2", "detail");
    expect(photoGaps(c, 3)).toEqual([]);
    c = choosePhoto(c, "p3", "habit");
    expect(c.map((x) => [x.id, x.status, x.kind])).toEqual([
      ["p1", "approved", null],
      ["p2", "approved", "detail"],
      ["p3", "approved", "habit"],
    ]);
  });

  it("clears a rejected photo's use, and says what is missing", () => {
    const c = choosePhoto(choosePhoto(start, "p1", "habit"), "p1", "rejected");
    expect(c[0]).toMatchObject({ status: "rejected", kind: null });
    expect(photoGaps(c, 3)).toEqual(["No main photo chosen.", "No close-up chosen."]);
    expect(photoGaps([], 0)).toEqual(["No photos found yet. You can still pass the plant's facts."]);
  });
});

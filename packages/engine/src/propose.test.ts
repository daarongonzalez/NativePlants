import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parsePlantCsv, rebateProgramFileSchema, type PlanPlant } from "@np/shared";
import { choosePlants, eligible, plantVariety, proposePlan, TARGET_COVER_PCT, type Candidate } from "./propose";

/**
 * Plans drawn from the real plant sheet against the real Utah rules, so a
 * generated plan that would fail the program fails here first.
 */
const read = (path: string) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");
const file = rebateProgramFileSchema.parse(JSON.parse(read("../../../data/rebates/ut-landscape-incentive.json")));
const program = { ...file, rules: file.rules };

const sheet = parsePlantCsv(read("../../../data/plants/wasatch-plants.csv"));
const plants: PlanPlant[] = sheet.plants.map((p, i) => ({
  id: `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`,
  commonName: p.commonNames[0]!,
  scientificName: p.scientificName,
  matureHeightCm: p.matureHeightCm,
  matureWidthCm: p.matureWidthCm,
  lifeCycle: p.lifeCycle,
  plantForm: p.plantForm,
  staysUnder24In: p.staysUnder24In,
  reviewStatus: p.reviewStatus,
}));
// A stand-in ranking: the sheet's order, each with a reason.
const candidates: Candidate[] = plants.map((plant, i) => ({ plant, score: 100 - i, reason: `Suits this ground (${plant.commonName}).` }));

const coverCode = program.rules.find((r) => r.checkKey === "coverage")!.code;

describe("proposePlan on the real sheet and rules", () => {
  it.each([
    ["a small front yard", "front", 20, 15],
    ["a typical front yard", "front", 40, 25],
    ["a big backyard", "back", 80, 50],
    ["a park strip", "park_strip", 60, 5],
  ] as const)("draws %s that passes every plan rule", (_label, areaKind, widthFt, depthFt) => {
    const proposal = proposePlan({ areaKind, widthFt, depthFt }, candidates, program)!;
    expect(proposal).not.toBeNull();
    const { plan, check } = proposal;
    expect(plan.cells).toHaveLength((widthFt / 5) * (depthFt / 5));
    expect(plan.cells.every((c) => c.kind === "plant" || c.kind === "mulch")).toBe(true);
    const failing = check.outcomes.filter((o) => o.checkType === "plan_check" && o.result === "fail");
    expect(failing).toEqual([]);
    expect(check.outcomes.find((o) => o.code === coverCode)?.result).toBe("pass");
    expect(check.coveragePct).toBeGreaterThanOrEqual(program.minPlantCoveragePct);
  });

  it("uses only low plants in a park strip", () => {
    const proposal = proposePlan({ areaKind: "park_strip", widthFt: 40, depthFt: 5 }, candidates, program)!;
    const used = new Set(proposal.plan.cells.flatMap((c) => (c.kind === "plant" ? [c.plantId] : [])));
    for (const id of used) expect(plants.find((p) => p.id === id)?.staysUnder24In).toBe(true);
    expect(proposal.notes.join(" ")).toMatch(/under 24 inches/);
  });

  it("aims a little above the rule, with mulch for the rest, rather than planting every square", () => {
    const proposal = proposePlan({ areaKind: "front", widthFt: 40, depthFt: 25 }, candidates, program)!;
    expect(proposal.plan.cells.some((c) => c.kind === "mulch")).toBe(true);
    expect(proposal.check.coveragePct).toBeGreaterThanOrEqual(TARGET_COVER_PCT - 10);
  });

  it("puts tall plants at the back and low ones at the front", () => {
    const proposal = proposePlan({ areaKind: "front", widthFt: 40, depthFt: 25 }, candidates, program)!;
    const height = (id: string) => plants.find((p) => p.id === id)!.matureHeightCm;
    const rowHeights = (row: number) =>
      proposal.plan.cells.slice(row * 8, row * 8 + 8).flatMap((c) => (c.kind === "plant" ? [height(c.plantId)] : []));
    const avg = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
    expect(avg(rowHeights(0))).toBeGreaterThan(avg(rowHeights(3)));
  });

  it("reports counts and reasons for each plant used", () => {
    const proposal = proposePlan({ areaKind: "back", widthFt: 30, depthFt: 20 }, candidates, program)!;
    expect(proposal.picks.length).toBeGreaterThanOrEqual(3);
    for (const pick of proposal.picks) {
      expect(pick.squares).toBeGreaterThan(0);
      expect(pick.plantCount).toBeGreaterThanOrEqual(1);
      expect(pick.reason).toMatch(/Suits this ground/);
    }
    const planted = proposal.plan.cells.filter((c) => c.kind === "plant").length;
    expect(proposal.picks.reduce((s, p) => s + p.squares, 0)).toBe(planted);
  });

  it("gives the same plan for the same inputs", () => {
    const a = proposePlan({ areaKind: "front", widthFt: 35, depthFt: 20 }, candidates, program);
    const b = proposePlan({ areaKind: "front", widthFt: 35, depthFt: 20 }, candidates, program);
    expect(a).toEqual(b);
  });
});

describe("choosing plants", () => {
  it("keeps trees, annuals and incomplete plants out, since they do not count as cover", () => {
    const pool = eligible(candidates, "front");
    expect(pool.every((c) => c.plant.plantForm !== "tree" && c.plant.lifeCycle === "perennial")).toBe(true);
  });

  it("takes one of each form before doubling up", () => {
    const chosen = choosePlants(eligible(candidates, "front"), 4);
    expect(new Set(chosen.map((c) => c.plant.plantForm)).size).toBe(4);
  });

  it("mixes genera before repeating one", () => {
    const chosen = choosePlants(eligible(candidates, "front"), 8);
    const genera = chosen.map((c) => c.plant.scientificName.split(" ")[0]);
    expect(new Set(genera).size).toBe(8);
  });

  it("scales variety with the area", () => {
    expect(plantVariety(4)).toBe(3);
    expect(plantVariety(40)).toBe(8);
    expect(plantVariety(160)).toBe(8);
  });

  it("returns nothing when no plant suits the area", () => {
    const tallOnly = candidates.filter((c) => c.plant.staysUnder24In !== true);
    expect(proposePlan({ areaKind: "park_strip", widthFt: 20, depthFt: 5 }, tallOnly, program)).toBeNull();
  });
});

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { rebateProgramFileSchema, type Cell, type PlanLayout, type PlanPlant } from "@np/shared";
import { checkPlan, coveredSqftPerSquare, narrowLawnSquares, plantsPerSquare } from "./rebate";

/**
 * Checks run against the real Utah data file, so a change to a rule's numbers
 * in data/rebates/ is caught here as well as in the import.
 *
 * The plants are invented to exercise the rules, not horticultural claims.
 */

const file = rebateProgramFileSchema.parse(
  JSON.parse(readFileSync(fileURLToPath(new URL("../../../data/rebates/ut-landscape-incentive.json", import.meta.url)), "utf8")),
);
const program = { ...file, rules: file.rules };

const plant = (id: string, over: Partial<PlanPlant> = {}): PlanPlant => ({
  id,
  commonName: id,
  scientificName: `Testus ${id}`,
  matureHeightCm: 45,
  matureWidthCm: 60,
  lifeCycle: "perennial",
  plantForm: "wildflower",
  staysUnder24In: true,
  reviewStatus: "draft",
  ...over,
});

/** About 3 ft across: four fill a 5 ft square and cover it completely. */
const spreader = plant("spreader", { matureWidthCm: 90 });
const tree = plant("tree", { plantForm: "tree", matureWidthCm: 600, matureHeightCm: 800, staysUnder24In: false });
const tall = plant("tall", { matureHeightCm: 120, staysUnder24In: false });
const plants = [spreader, tree, tall];

const L: Cell = { kind: "lawn" };
const M: Cell = { kind: "mulch" };
const H: Cell = { kind: "pavers" };
const P = (id: string): Cell => ({ kind: "plant", plantId: id });

function layout(widthFt: number, depthFt: number, cells: Cell[], areaKind: PlanLayout["areaKind"] = "front"): PlanLayout {
  return { areaKind, widthFt, depthFt, cells };
}

const result = (check: ReturnType<typeof checkPlan>, code: string) => check.outcomes.find((o) => o.code === code)!;

describe("the Utah data file", () => {
  it("has all 23 rules, each with a unique code", () => {
    expect(file.rules).toHaveLength(23);
    expect(new Set(file.rules.map((r) => r.code)).size).toBe(23);
  });

  it("has one rule for each automatic check", () => {
    const keys = file.rules.map((r) => r.checkKey).filter((k) => k !== null);
    expect(keys.sort()).toEqual(
      ["coverage", "excluded_materials", "hardscape_share", "lawn_width", "min_area", "park_strip_height"].sort(),
    );
  });
});

describe("plant spacing", () => {
  it("fits more small plants in a square than large ones", () => {
    expect(plantsPerSquare(30)).toBeGreaterThan(plantsPerSquare(90));
    expect(plantsPerSquare(600)).toBe(1);
  });

  it("never covers more than the square", () => {
    expect(coveredSqftPerSquare(600)).toBe(25);
  });
});

describe("checkPlan", () => {
  it("passes a fully planted 10 by 20 ft front yard", () => {
    const check = checkPlan(program, layout(10, 20, Array(8).fill(P("spreader"))), plants);
    expect(check.eligibleSqft).toBe(200);
    expect(result(check, "E6").result).toBe("pass");
    expect(result(check, "C2").result).toBe("pass");
    expect(check.overall).toBe("likely");
    expect(check.estimatedAmount).toBe(400);
  });

  it("fails the minimum area and pays nothing under 200 sq ft", () => {
    const check = checkPlan(program, layout(5, 15, Array(3).fill(P("spreader"))), plants);
    expect(result(check, "E6").result).toBe("fail");
    expect(check.estimatedAmount).toBe(0);
    expect(check.overall).toBe("needs_changes");
  });

  it("does not count tree canopy towards cover", () => {
    const cells = [...Array(4).fill(P("tree")), ...Array(4).fill(M)];
    const check = checkPlan(program, layout(10, 20, cells), plants);
    expect(check.coveragePct).toBe(0);
    expect(result(check, "C2").result).toBe("fail");
  });

  it("counts mulch in the area but not in the cover", () => {
    const cells = [...Array(4).fill(P("spreader")), ...Array(4).fill(M)];
    const check = checkPlan(program, layout(10, 20, cells), plants);
    expect(check.eligibleSqft).toBe(200);
    expect(check.coveragePct).toBeLessThanOrEqual(50);
  });

  it("warns, rather than guesses, when a plant is missing its rebate details", () => {
    const vague = plant("vague", { lifeCycle: null });
    const check = checkPlan(program, layout(10, 20, Array(8).fill(P("vague"))), [vague]);
    expect(result(check, "C2").result).toBe("warn");
  });

  it("leaves pavers out of the rebate and warns about them", () => {
    const cells = [...Array(8).fill(P("spreader")), H, H];
    const check = checkPlan(program, layout(10, 25, cells), plants);
    expect(check.eligibleSqft).toBe(200);
    expect(result(check, "E7").result).toBe("warn");
    expect(result(check, "C12").result).toBe("pass");
  });

  it("applies the 50% hardscape limit to a front yard and 75% to a backyard", () => {
    const cells = [...Array(6).fill(H), ...Array(4).fill(P("spreader"))];
    expect(result(checkPlan(program, layout(10, 25, cells, "front"), plants), "C12").result).toBe("fail");
    expect(result(checkPlan(program, layout(10, 25, cells, "back"), plants), "C12").result).toBe("pass");
  });

  it("flags a strip of lawn one square (5 ft) wide", () => {
    // 3 columns: lawn | plant | plant, four rows deep. The lawn column is 5 ft wide.
    const cells = Array.from({ length: 12 }, (_, i) => (i % 3 === 0 ? L : P("spreader")));
    const check = checkPlan(program, layout(15, 20, cells), plants);
    expect(result(check, "C1").result).toBe("fail");
    expect(result(check, "C1").measuredValue).toBe(4);
  });

  it("accepts lawn kept in a block two squares (10 ft) wide", () => {
    const cells = Array.from({ length: 16 }, (_, i) => (i % 4 < 2 ? L : P("spreader")));
    expect(narrowLawnSquares(cells, 4, 8)).toEqual([]);
    expect(result(checkPlan(program, layout(20, 20, cells), plants), "C1").result).toBe("pass");
  });

  it("only applies the height rule to park strips, and names the tall plants", () => {
    const cells = [...Array(7).fill(P("spreader")), P("tall")];
    expect(result(checkPlan(program, layout(10, 20, cells, "front"), plants), "C10").result).toBe("not_applicable");
    const strip = checkPlan(program, layout(10, 20, cells, "park_strip"), plants);
    expect(result(strip, "C10").result).toBe("fail");
    expect(result(strip, "C10").note).toContain("tall");
  });

  it("never marks an owner or inspector rule as passed", () => {
    const check = checkPlan(program, layout(10, 20, Array(8).fill(P("spreader"))), plants);
    for (const o of check.outcomes) {
      if (o.checkType === "owner_confirms") expect(o.result).toBe("owner_to_confirm");
      if (o.checkType === "inspector_only") expect(o.result).toBe("inspector_checks");
    }
  });

  it("tallies how many of each plant to buy", () => {
    const check = checkPlan(program, layout(10, 20, Array(8).fill(P("spreader"))), plants);
    expect(check.plants).toEqual([
      { plantId: "spreader", commonName: "spreader", squares: 8, plantCount: 8 * plantsPerSquare(90) },
    ]);
  });
});

import { describe, expect, it } from "vitest";
import { checkPlan } from "@np/engine";
import type { PlanPlant, RebateProgramSummary } from "@np/shared";
import { canGrow, fillLawn, newPlan, paint, resize, sageLine, shortName, toLayout } from "./planner";
import { placeFromParams, placeToParams, trackPosition } from "./flow";

const plant: PlanPlant = {
  id: "p1",
  commonName: "Firecracker penstemon",
  scientificName: "Penstemon eatonii",
  matureHeightCm: 90,
  matureWidthCm: 90,
  lifeCycle: "perennial",
  plantForm: "wildflower",
  staysUnder24In: false,
  reviewStatus: "draft",
};
const flower = { kind: "plant", plantId: "p1" } as const;

describe("the planner", () => {
  it("starts as all lawn at the area's usual size", () => {
    const plan = newPlan("front");
    expect(plan.cells).toHaveLength(24);
    expect(plan.cells.every((c) => c.kind === "lawn")).toBe(true);
  });

  it("puts lawn back when the same square is tapped twice", () => {
    const once = paint(newPlan("front"), 3, flower);
    expect(once.cells[3]).toEqual(flower);
    expect(paint(once, 3, flower).cells[3]).toEqual({ kind: "lawn" });
  });

  it("fills only the lawn", () => {
    const plan = fillLawn(paint(newPlan("front"), 0, { kind: "pavers" }), { kind: "mulch" });
    expect(plan.cells[0]).toEqual({ kind: "pavers" });
    expect(plan.cells.filter((c) => c.kind === "mulch")).toHaveLength(23);
  });

  it("keeps painted squares that still fit when the area changes size", () => {
    const plan = resize(paint(newPlan("front"), 0, flower), 35, 20);
    expect(plan.cells).toHaveLength(28);
    expect(plan.cells[0]).toEqual(flower);
  });

  it("stays inside the size limit", () => {
    const big = resize(newPlan("back"), 80, 80);
    expect(big.cells.length).toBeLessThanOrEqual(160);
    expect(canGrow(big, "depth")).toBe(false);
  });

  it("gives Sage something useful to say at each stage", () => {
    const program = { perSqftAmount: 2, maxAward: null, minAreaSqft: 200, minPlantCoveragePct: 50, rules: [] } as unknown as RebateProgramSummary;
    const empty = checkPlan(program, toLayout(newPlan("front")), [plant]);
    expect(sageLine(empty, 200, 50)).toMatch(/tap squares/);
    const full = checkPlan(program, toLayout(fillLawn(newPlan("front"), flower)), [plant]);
    expect(sageLine(full, 200, 50)).toMatch(/\$1,200/);
  });

  it("makes short tile names", () => {
    expect(shortName("Rocky Mountain penstemon")).toBe("Penst.");
    expect(shortName("Blue flax")).toBe("Flax");
  });
});

describe("the flow helpers", () => {
  it("carries a place between pages", () => {
    const place = { address: "1 Main St, Salt Lake City, UT", latitude: 40.76, longitude: -111.89, zip: "84101", matchQuality: "interpolated" as const };
    expect(placeFromParams(new URLSearchParams(placeToParams(place)))).toEqual(place);
    expect(placeFromParams(new URLSearchParams("lat=x"))).toBeNull();
  });

  it("places frost dates on the spring track", () => {
    expect(trackPosition("03-01", "03-01", "06-30")).toBe(0);
    expect(trackPosition("06-30", "03-01", "06-30")).toBe(100);
    expect(trackPosition("05-01", "03-01", "06-30")).toBeGreaterThan(40);
  });
});

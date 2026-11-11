import { describe, expect, it } from "vitest";
import type { YardEstimate, YardZone } from "@np/shared";
import { cellRuns, choiceFromParams, choiceToParams, defaultLawn, plannerStart, suggestedZone } from "./yard";

const zone = (over: Partial<YardZone> = {}): YardZone => ({
  kind: "front",
  areaSqft: 2600,
  plantedSqft: 1190,
  bareSqft: 1410,
  widthFt: 61,
  depthFt: 52,
  ...over,
});

describe("plannerStart", () => {
  it("starts the plot close to the lawn to replace, in 5 ft squares", () => {
    const { widthFt, depthFt } = plannerStart(1190, zone());
    expect(widthFt % 5).toBe(0);
    expect(depthFt % 5).toBe(0);
    expect(Math.abs(widthFt * depthFt - 1190)).toBeLessThanOrEqual(150);
    expect(depthFt).toBeLessThanOrEqual(52);
  });

  it("keeps a shallow strip shallow", () => {
    expect(plannerStart(400, zone({ widthFt: 100, depthFt: 8 }))).toEqual({ widthFt: 80, depthFt: 5 });
  });

  it("never asks the planner for more than it holds", () => {
    const big = plannerStart(9000, zone({ widthFt: 150, depthFt: 90 }));
    expect(big.widthFt).toBeLessThanOrEqual(80);
    expect(big.depthFt).toBeLessThanOrEqual(80);
    expect((big.widthFt / 5) * (big.depthFt / 5)).toBeLessThanOrEqual(160);
    expect(plannerStart(10, zone())).toEqual({ widthFt: 5, depthFt: 5 });
  });
});

describe("the choice in the link", () => {
  it("survives the trip", () => {
    const choice = { zone: "back" as const, zoneSqft: 1401, lawnSqft: 1230, widthFt: 40, depthFt: 30 };
    expect(choiceFromParams(new URLSearchParams(choiceToParams(choice)))).toEqual(choice);
  });

  it("ignores a link edited into something the planner cannot hold", () => {
    const ok = { yz: "front", ya: "100", yl: "100", yw: "10", yd: "10" };
    expect(choiceFromParams(new URLSearchParams({ ...ok, yw: "12" }))).toBeNull();
    expect(choiceFromParams(new URLSearchParams({ ...ok, yw: "80", yd: "80" }))).toBeNull();
    expect(choiceFromParams(new URLSearchParams({ ...ok, yz: "roof" }))).toBeNull();
    expect(choiceFromParams(new URLSearchParams({ ...ok, yl: "-5" }))).toBeNull();
  });
});

describe("estimate helpers", () => {
  it("guesses the lawn from the planted ground", () => {
    expect(defaultLawn(zone())).toBe(1190);
    expect(defaultLawn(zone({ plantedSqft: null, areaSqft: 2604 }))).toBe(2600);
  });

  it("suggests the front yard when it has lawn, else the zone with the most", () => {
    const e = { zones: [zone({ plantedSqft: 120 }), zone({ kind: "back", plantedSqft: 1500 })] } as YardEstimate;
    expect(suggestedZone(e)?.kind).toBe("back");
    expect(suggestedZone({ zones: [zone(), zone({ kind: "back", plantedSqft: 3000 })] } as YardEstimate)?.kind).toBe("front");
  });

  it("joins pixels into runs for drawing", () => {
    const cells = { columns: 4, rows: 2, codes: "pp.p" + "bppp" };
    expect(cellRuns(cells, "p")).toEqual([
      { row: 0, col: 0, length: 2 },
      { row: 0, col: 3, length: 1 },
      { row: 1, col: 1, length: 3 },
    ]);
  });
});

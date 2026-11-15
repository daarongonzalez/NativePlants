import { describe, expect, it } from "vitest";
import type { PlanLayout } from "@np/shared";
import { decodePlan, encodePlan, planDocumentHref, planFromParams } from "./plan-link";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

function plan(widthFt: number, depthFt: number, kinds: number): PlanLayout {
  const n = (widthFt / 5) * (depthFt / 5);
  return {
    areaKind: "front",
    widthFt,
    depthFt,
    cells: Array.from({ length: n }, (_, i) =>
      i % 7 === 0 ? { kind: "mulch" } : i % 11 === 0 ? { kind: "lawn" } : i % 13 === 0 ? { kind: "pavers" } : { kind: "plant", plantId: id(i % kinds) },
    ),
  };
}

describe("the plan link", () => {
  it("survives the trip exactly", () => {
    const p = plan(40, 25, 8);
    expect(decodePlan(encodePlan(p))).toEqual(p);
  });

  it("fits the largest plan in a short link", () => {
    const big = plan(80, 50, 8);
    expect(big.cells).toHaveLength(160);
    expect(encodePlan(big).length).toBeLessThan(1200);
    expect(decodePlan(encodePlan(big))).toEqual(big);
  });

  it("carries the place with it", () => {
    const p = plan(20, 10, 3);
    const place = { address: "100 S Example St", latitude: 40.74, longitude: -111.84, zip: "84105", matchQuality: "interpolated" as const };
    const href = planDocumentHref(p, place);
    expect(href.startsWith("/plan/document?")).toBe(true);
    const back = planFromParams(new URL(href, "https://grownativo.com").searchParams);
    expect(back?.plan).toEqual(p);
    expect(back?.place?.zip).toBe("84105");
  });

  it("refuses a damaged or impossible plan", () => {
    expect(decodePlan(null)).toBeNull();
    expect(decodePlan("not-a-plan")).toBeNull();
    const p = plan(20, 10, 3);
    const tampered = btoa(JSON.stringify({ v: 1, a: "front", w: 20, d: 10, s: "AAA", p: [id(0)] })).replace(/=+$/, "");
    expect(decodePlan(tampered)).toBeNull(); // 3 squares for a 4 × 2 plan
    const unknownPlant = btoa(JSON.stringify({ v: 1, a: "front", w: 5, d: 5, s: "B", p: [id(0)] })).replace(/=+$/, "");
    expect(decodePlan(unknownPlant)).toBeNull();
    expect(decodePlan(encodePlan(p))).not.toBeNull();
  });
});

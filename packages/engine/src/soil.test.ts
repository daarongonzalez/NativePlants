import { describe, expect, it } from "vitest";
import { summarizeTopsoil, type HorizonInput } from "./soil";

const h = (top: number, bottom: number, ph: number | null, sand = 40, silt = 40, clay = 20): HorizonInput => ({
  depthTopCm: top,
  depthBottomCm: bottom,
  ph,
  sandPct: sand,
  siltPct: silt,
  clayPct: clay,
});

describe("summarizeTopsoil", () => {
  it("weights each horizon by how much of it lies in the top 30 cm", () => {
    // 10 cm at pH 6.0 and 20 cm at pH 7.5 inside the layer: (60 + 150) / 30 = 7.0
    expect(summarizeTopsoil([h(0, 10, 6.0), h(10, 60, 7.5)]).ph).toBe(7.0);
  });

  it("ignores horizons that start below 30 cm", () => {
    expect(summarizeTopsoil([h(0, 30, 7.0), h(30, 90, 8.4)]).ph).toBe(7.0);
  });

  it("averages only over horizons that have a value", () => {
    expect(summarizeTopsoil([h(0, 15, null), h(15, 30, 7.2)]).ph).toBe(7.2);
  });

  it("returns null, not zero, when nothing was measured", () => {
    const summary = summarizeTopsoil([h(0, 30, null)]);
    expect(summary.ph).toBeNull();
    expect(summarizeTopsoil([])).toEqual({ ph: null, sandPct: null, siltPct: null, clayPct: null });
  });

  it("treats a horizon starting at the surface and ending deeper than 30 cm as 30 cm of soil", () => {
    expect(summarizeTopsoil([h(0, 100, 7.9)]).ph).toBe(7.9);
  });
});

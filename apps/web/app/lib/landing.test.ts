import { describe, expect, it } from "vitest";
import {
  clampLawn,
  emptyYard,
  isDarkSquare,
  plantedSqft,
  rebateNote,
  sageLine,
  tapTile,
} from "./landing";

describe("plot planner", () => {
  it("plants, replaces and removes a seed", () => {
    let yard = emptyYard();
    yard = tapTile(yard, 3, 0);
    expect(yard[3]).toBe(0);
    yard = tapTile(yard, 3, 2);
    expect(yard[3]).toBe(2);
    yard = tapTile(yard, 3, 2);
    expect(yard[3]).toBeNull();
  });

  it("counts 25 sq ft a square", () => {
    let yard = emptyYard();
    for (let i = 0; i < 9; i++) yard = tapTile(yard, i, 1);
    expect(plantedSqft(yard)).toBe(225);
  });

  it("changes Sage's line with progress", () => {
    let yard = emptyYard();
    expect(sageLine(yard)).toMatch(/Pick a seed/);
    yard = tapTile(yard, 0, 0);
    expect(sageLine(yard)).toBe("Nice! Just 175 more sq ft and the rebate kicks in.");
    for (let i = 1; i < 8; i++) yard = tapTile(yard, i, 0);
    expect(sageLine(yard)).toBe("That's $400 from Utah. Ready to try your real yard? Pop your address in.");
    yard = yard.map(() => 1);
    expect(sageLine(yard)).toMatch(/whole native yard/);
  });

  it("shades a checkerboard for 10 and 5 columns", () => {
    expect([0, 1, 10, 11].map((i) => isDarkSquare(i, 10))).toEqual([false, true, true, false]);
    expect([0, 1, 5, 6].map((i) => isDarkSquare(i, 5))).toEqual([false, true, true, false]);
  });
});

describe("rebate calculator", () => {
  it("keeps the lawn between 100 and 5,000 sq ft", () => {
    expect(clampLawn(0)).toBe(100);
    expect(clampLawn(5100)).toBe(5000);
  });

  it("notes the 200 sq ft minimum", () => {
    expect(rebateNote(100)).toMatch(/Under/);
    expect(rebateNote(200)).toMatch(/Meets/);
  });
});

import { describe, expect, it } from "vitest";
import { SUN_EXPOSURE_HOURS, openSkySunHours, sunHoursFromExposure } from "./sun";

describe("openSkySunHours", () => {
  it("gives about 15 hours on the longest day in Salt Lake City", () => {
    // Almanac day length for 21 June at 40.76 N is about 15 h 03 min.
    const hours = openSkySunHours(40.7608);
    expect(hours).toBeGreaterThan(14.9);
    expect(hours).toBeLessThan(15.3);
  });

  it("gives a little over 12 hours at the equator", () => {
    expect(openSkySunHours(0)).toBeGreaterThan(12);
    expect(openSkySunHours(0)).toBeLessThan(12.3);
  });

  it("grows with latitude in the north", () => {
    expect(openSkySunHours(30)).toBeLessThan(openSkySunHours(40));
    expect(openSkySunHours(40)).toBeLessThan(openSkySunHours(50));
  });

  it("mirrors in the south, where the longest day is in December", () => {
    expect(openSkySunHours(-40.7608)).toBe(openSkySunHours(40.7608));
  });

  it("clamps at the poles instead of returning NaN", () => {
    expect(openSkySunHours(85)).toBe(24);
    expect(openSkySunHours(-85)).toBe(24);
  });
});

describe("sunHoursFromExposure", () => {
  it("keeps each choice inside its garden-definition band", () => {
    expect(SUN_EXPOSURE_HOURS.full).toBeGreaterThanOrEqual(6);
    expect(SUN_EXPOSURE_HOURS.part).toBeGreaterThanOrEqual(3);
    expect(SUN_EXPOSURE_HOURS.part).toBeLessThan(6);
    expect(SUN_EXPOSURE_HOURS.shade).toBeLessThan(3);
    expect(sunHoursFromExposure("part")).toBe(4.5);
  });
});

import { describe, expect, it } from "vitest";
import { WASATCH_FRONT_ZIPS } from "./wasatch-zips";
import { parsePrismZipCsv } from "./zones";

const HEADER = "zipcode,zone,trange,zonetitle";

describe("parsePrismZipCsv", () => {
  it("reads zone and temperature range, keeping ZIPs as text with leading zeros", () => {
    const { zips, badRows } = parsePrismZipCsv(
      [HEADER, "00501,7b,5 to 10,7b: 5 to 10", "84629,5b,-15 to -10,5b: -15 to -10"].join("\n"),
    );
    expect(badRows).toEqual([]);
    expect(zips.get("00501")).toEqual({ zone: "7b", min: 5, max: 10 });
    expect(zips.get("84629")).toEqual({ zone: "5b", min: -15, max: -10 });
  });

  it("keeps the low and high the right way round for negative ranges", () => {
    const z = parsePrismZipCsv([HEADER, "84121,6a,-10 to -5,6a: -10 to -5"].join("\n")).zips.get("84121")!;
    expect(z.min).toBeLessThan(z.max);
  });

  it("reports rows it cannot parse instead of guessing", () => {
    const { zips, badRows } = parsePrismZipCsv(
      [HEADER, "84101,7b,5 to 10,x", "84102,,5 to 10,x", "84103,6b,warm,x", "8410,6b,-5 to 0,x"].join("\n"),
    );
    expect(zips.size).toBe(1);
    expect(badRows).toHaveLength(3);
  });

  it("throws when an expected column is missing", () => {
    expect(() => parsePrismZipCsv("zip,zone\n84101,7b")).toThrow(/missing expected columns/);
  });

  it("tolerates Windows line endings and a byte-order mark", () => {
    const { zips } = parsePrismZipCsv(`﻿${HEADER}\r\n84101,7b,5 to 10,x\r\n`);
    expect(zips.has("84101")).toBe(true);
  });
});

describe("launch ZIP list", () => {
  it("has no duplicates and omits the ZIPs PRISM has no zone for", () => {
    expect(new Set(WASATCH_FRONT_ZIPS).size).toBe(WASATCH_FRONT_ZIPS.length);
    for (const zip of ["84138", "84150", "84602"]) expect(WASATCH_FRONT_ZIPS).not.toContain(zip);
  });
});

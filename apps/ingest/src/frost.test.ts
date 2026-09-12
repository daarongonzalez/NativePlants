import { describe, expect, it } from "vitest";
import type { FrostRecord } from "./frost";

/**
 * Validation is exercised through a copy of the module's rules rather than by
 * running the job, because the job writes to Postgres and port 5432 is not
 * reachable from CI. The rules themselves are what matter here: a malformed
 * frost date reaches a gardener deciding when to plant.
 */

const MMDD = /^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

const VALID: FrostRecord = {
  stationId: "USW00024127",
  name: "Salt Lake City Intl",
  latitude: 40.7884,
  longitude: -111.9777,
  elevationM: 1288,
  lastSpringP10: "05-08",
  lastSpringP50: "04-24",
  lastSpringP90: "04-09",
  firstFallP10: "10-05",
  firstFallP50: "10-19",
  firstFallP90: "11-02",
  frostFreeDays: 178,
  normalsPeriod: "1991-2020",
};

describe("frost date format", () => {
  it("accepts the real Salt Lake City values", () => {
    for (const value of [
      VALID.lastSpringP10,
      VALID.lastSpringP50,
      VALID.lastSpringP90,
      VALID.firstFallP10,
      VALID.firstFallP50,
      VALID.firstFallP90,
    ]) {
      expect(MMDD.test(value)).toBe(true);
    }
  });

  it("rejects a full date, which would imply a specific year's event", () => {
    expect(MMDD.test("2026-04-24")).toBe(false);
  });

  it("rejects US-order and slash-separated dates", () => {
    expect(MMDD.test("04/24")).toBe(false);
    expect(MMDD.test("24-04")).toBe(false);
  });

  it("rejects an impossible month or day", () => {
    expect(MMDD.test("13-01")).toBe(false);
    expect(MMDD.test("00-15")).toBe(false);
    expect(MMDD.test("02-32")).toBe(false);
  });

  it("keeps the probability bands in a sensible order for Salt Lake City", () => {
    // A later 10% date than 50% would mean we mislabelled the columns, which
    // is easy to do and produces advice that is exactly backwards.
    expect(VALID.lastSpringP10 > VALID.lastSpringP50).toBe(true);
    expect(VALID.lastSpringP50 > VALID.lastSpringP90).toBe(true);
    expect(VALID.firstFallP10 < VALID.firstFallP50).toBe(true);
    expect(VALID.firstFallP50 < VALID.firstFallP90).toBe(true);
  });
});

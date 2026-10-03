import { describe, expect, it } from "vitest";
import type { FrostRecord } from "./frost";
import { WASATCH_FRONT_FROST } from "./data/wasatch-frost";

/**
 * Validation is exercised through a copy of the module's rules rather than by
 * running the job, because the job writes to Postgres and port 5432 is not
 * reachable from CI. The rules themselves are what matter here: a malformed
 * frost date reaches a gardener deciding when to plant.
 */

const MMDD = /^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

/** The real Salt Lake City record, as generated from NCEI normals. */
const VALID: FrostRecord = WASATCH_FRONT_FROST[0]!;

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

  it("ships at least one station", () => {
    expect(WASATCH_FRONT_FROST.length).toBeGreaterThan(0);
  });

  it("ships no placeholder stations", () => {
    for (const r of WASATCH_FRONT_FROST) {
      expect(r.stationId).not.toMatch(/PLACEHOLDER/i);
      expect(r.name).not.toMatch(/placeholder/i);
    }
  });

  it("gives every shipped station an elevation, which the confidence rule needs", () => {
    for (const r of WASATCH_FRONT_FROST) {
      expect(r.elevationM).not.toBeNull();
    }
  });

  it("orders the probability bands correctly on every shipped station", () => {
    // Guards the whole file, not just one record. Swapped columns parse
    // cleanly, validate as dates, and reverse the advice.
    for (const r of WASATCH_FRONT_FROST) {
      expect(r.lastSpringP10 > r.lastSpringP50, r.stationId).toBe(true);
      expect(r.lastSpringP50 > r.lastSpringP90, r.stationId).toBe(true);
      expect(r.firstFallP10 < r.firstFallP50, r.stationId).toBe(true);
      expect(r.firstFallP50 < r.firstFallP90, r.stationId).toBe(true);
    }
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

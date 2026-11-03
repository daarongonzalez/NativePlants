import { describe, expect, it } from "vitest";
import { rebateProgramFileSchema } from "@np/shared";
import utahRebate from "../../../data/rebates/ut-landscape-incentive.json";

/**
 * The committed program file is what the import job loads. If it stops
 * matching the schema, the job would write nothing, so catch it here first.
 */
describe("the committed Utah rebate file", () => {
  const parsed = rebateProgramFileSchema.safeParse(utahRebate);

  it("passes validation as committed", () => {
    expect(parsed.success ? [] : parsed.error.issues).toEqual([]);
  });

  it("states where it came from and when it was checked", () => {
    if (!parsed.success) throw new Error("invalid file");
    expect(parsed.data.sourceUrl).toMatch(/^https:\/\//);
    expect(parsed.data.verifiedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(parsed.data.verifiedBy.length).toBeGreaterThan(10);
  });

  it("keeps the program's own words next to every plain version", () => {
    if (!parsed.success) throw new Error("invalid file");
    for (const rule of parsed.data.rules) {
      expect(rule.sourceText.length).toBeGreaterThan(20);
      expect(rule.plainText.length).toBeGreaterThan(20);
    }
  });

  it("rejects a plan check with no automatic check behind it", () => {
    if (!parsed.success) throw new Error("invalid file");
    const broken = { ...parsed.data, rules: [{ ...parsed.data.rules[5]!, checkKey: null }] };
    expect(rebateProgramFileSchema.safeParse(broken).success).toBe(false);
  });
});

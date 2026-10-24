import { describe, expect, it } from "vitest";
import { SoilJob, nextSoilCursor, parseSoilCursor, WASATCH_SURVEY_AREAS } from "./soil";

describe("soil cursors", () => {
  it("reads a cursor into its area and offset", () => {
    expect(parseSoilCursor("UT611:75")).toEqual({ area: "UT611", offset: 75 });
    expect(parseSoilCursor("UT607:0")).toEqual({ area: "UT607", offset: 0 });
  });

  it("rejects anything that is not one of our areas, so the route cannot be pointed elsewhere", () => {
    for (const bad of ["UT999:0", "UT611", "UT611:-1", "UT611:1; DROP", "x:0", "", "UT611:99999999"]) {
      expect(parseSoilCursor(bad)).toBeNull();
    }
  });

  it("asks for the next slice until the area is finished", () => {
    expect(nextSoilCursor("UT611", 50, 200)).toBe("UT611:50");
    expect(nextSoilCursor("UT611", 200, 200)).toBeNull();
    expect(nextSoilCursor("UT611", 225, 200)).toBeNull();
  });
});

describe("SoilJob", () => {
  it("plans every configured survey area, in order", () => {
    expect(new SoilJob().plan()).toEqual(WASATCH_SURVEY_AREAS);
  });

  it("only accepts cursors for the areas it was given", () => {
    const job = new SoilJob(["UT607"]);
    expect(job.cursor("UT607:5")).not.toBeNull();
    expect(job.cursor("UT612:5")).toBeNull();
  });

  it("reports an area missing from the catalogue instead of failing", async () => {
    const fake = (async () => new Response("", { status: 200 })) as typeof fetch;
    const result = await new SoilJob(["UT607"], fake).runSlice(
      { HYPERDRIVE: { connectionString: "unused" }, MARKET: "test" },
      { area: "UT607", offset: 0 },
    );
    expect(result.next).toBeNull();
    expect(result.rowsWritten).toBe(0);
    expect(result.warnings[0]).toMatch(/not in the survey catalogue/);
  });
});

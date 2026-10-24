import { describe, expect, it } from "vitest";
import { SoilDataAccessClient, dominantComponents, normalizeDrainageClass, parseSdaTable } from "./soil";
import { SourceShapeError } from "./types";

/**
 * Fixtures follow the SDA JSON+COLUMNNAME shape from its documentation. They
 * have NOT yet been compared with a live response; the Live source check
 * workflow prints one for that purpose.
 */

const HORIZON_COLUMNS = [
  "mukey", "cokey", "compname", "comppct_r", "drainagecl",
  "hzdept_r", "hzdepb_r", "ph1to1h2o_r", "sandtotal_r", "silttotal_r", "claytotal_r", "om_r", "awc_r",
];

describe("parseSdaTable", () => {
  it("reads the first row as column names", () => {
    const rows = parseSdaTable(JSON.stringify({ Table: [["mukey", "muname"], ["1", "Draper loam"], ["2", null]] }));
    expect(rows).toEqual([
      { mukey: "1", muname: "Draper loam" },
      { mukey: "2", muname: null },
    ]);
  });

  it("treats an empty body or a missing Table as no rows", () => {
    expect(parseSdaTable("")).toEqual([]);
    expect(parseSdaTable("{}")).toEqual([]);
  });

  it("says what happened when SDA answers with plain text", () => {
    expect(() => parseSdaTable("Incorrect syntax near 'FROM'.")).toThrow(SourceShapeError);
  });
});

describe("normalizeDrainageClass", () => {
  it("maps SDA wording to our enum", () => {
    expect(normalizeDrainageClass("Well drained")).toBe("well_drained");
    expect(normalizeDrainageClass("Somewhat excessively drained")).toBe("somewhat_excessively_drained");
  });

  it("returns null for anything unrecognised", () => {
    expect(normalizeDrainageClass("Subaqueous")).toBeNull();
    expect(normalizeDrainageClass(null)).toBeNull();
  });
});

describe("dominantComponents", () => {
  const row = (cells: (string | null)[]) => Object.fromEntries(HORIZON_COLUMNS.map((c, i) => [c, cells[i] ?? null]));

  it("keeps only the largest component and sorts its horizons by depth", () => {
    const rows = [
      row(["100", "a", "Minor", "25", "Poorly drained", "0", "30", "8.0", "20", "40", "40", "1", "0.1"]),
      row(["100", "b", "Major", "75", "Well drained", "30", "90", "7.8", "30", "40", "30", "0.5", "0.12"]),
      row(["100", "b", "Major", "75", "Well drained", "0", "30", "7.4", "35", "40", "25", "2", "0.15"]),
    ];
    const [unit] = dominantComponents(rows);
    expect(unit!.componentName).toBe("Major");
    expect(unit!.drainageClass).toBe("well_drained");
    expect(unit!.horizons.map((h) => h.depthTopCm)).toEqual([0, 30]);
    expect(unit!.horizons[0]!.ph).toBe(7.4);
  });

  it("returns a unit with no horizons for a component the survey did not measure", () => {
    const rows = [row(["200", "c", "Urban land", "80", null, null, null, null, null, null, null, null, null])];
    const [unit] = dominantComponents(rows);
    expect(unit!.horizons).toEqual([]);
    expect(unit!.drainageClass).toBeNull();
  });

  it("keeps a missing pH as null rather than zero", () => {
    const rows = [row(["300", "d", "Rubble", "90", "Well drained", "0", "20", null, "50", "30", "20", null, null])];
    expect(dominantComponents(rows)[0]!.horizons[0]!.ph).toBeNull();
  });
});

describe("SoilDataAccessClient", () => {
  it("posts the query as JSON and escapes quotes in values", async () => {
    let sent: { query: string; format: string } | undefined;
    const fake = (async (_url: RequestInfo | URL, init?: RequestInit) => {
      sent = JSON.parse(String(init?.body));
      return new Response(JSON.stringify({ Table: [["mukey", "muname"]] }), { status: 200 });
    }) as typeof fetch;

    await new SoilDataAccessClient(fake).listMapUnits("UT'1");
    expect(sent?.format).toBe("JSON+COLUMNNAME");
    expect(sent?.query).toContain("'UT''1'");
  });

  it("throws on a non-200 response", async () => {
    const fake = (async () => new Response("down", { status: 503 })) as typeof fetch;
    await expect(new SoilDataAccessClient(fake).findSurveyAreas(["Salt Lake"])).rejects.toThrow(/HTTP 503/);
  });
});

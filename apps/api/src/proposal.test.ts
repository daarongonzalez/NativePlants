import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { rebateProgramFileSchema, type PlanPlant, type Plant, type RebateProgramSummary } from "@np/shared";
import { sltSunnyClay, wasatchCatalogue } from "../../../packages/engine/src/__fixtures__/wasatch";
import app from "./index";
import { candidatesFor, drawProposal, siteProfileFrom } from "./proposal";
import type { AssembleOutcome } from "./resolve";

/**
 * The proposal on the engine's hand-checked Wasatch fixtures: a sunny clay
 * site and a small catalogue that includes plants it should rule out
 * (blueberry and marsh marigold hate alkaline, dry ground; bougainvillea is
 * not hardy here).
 */
const file = rebateProgramFileSchema.parse(
  JSON.parse(readFileSync(fileURLToPath(new URL("../../../data/rebates/ut-landscape-incentive.json", import.meta.url)), "utf8")),
);
const program = { ...file, rules: file.rules } as unknown as RebateProgramSummary;

const toPlanPlant = (p: Plant, i: number): PlanPlant => ({
  id: p.id,
  commonName: p.commonNames[0] ?? p.scientificName,
  scientificName: p.scientificName,
  matureHeightCm: p.matureHeightCm,
  matureWidthCm: p.matureWidthCm,
  lifeCycle: "perennial",
  // The fixtures predate plant form; give them a spread of forms.
  plantForm: (["wildflower", "shrub", "groundcover", "grass", "wildflower", "shrub"] as const)[i % 6]!,
  staysUnder24In: p.matureHeightCm <= 61,
  reviewStatus: "draft",
});
const plannerPlants = wasatchCatalogue.map(toPlanPlant);

/** Plants the engine must rule out on sunny alkaline clay. Each is checked to exist, so the test cannot pass by a typo. */
const RULED_OUT = ["Vaccinium corymbosum", "Bougainvillea glabra"];
for (const name of RULED_OUT) {
  if (!wasatchCatalogue.some((p) => p.scientificName === name)) throw new Error(`fixture has no ${name}`);
}

describe("ranking plants for a proposal", () => {
  it("ranks for the ground and leaves out what the engine rules out", () => {
    const { candidates, rankedBy } = candidatesFor(sltSunnyClay, wasatchCatalogue, plannerPlants);
    expect(rankedBy).toBe("ground");
    const names = candidates.map((c) => c.plant.scientificName);
    for (const name of RULED_OUT) expect(names).not.toContain(name);
    expect(names.length).toBeGreaterThan(0);
    expect(candidates.every((c) => c.reason.length > 0)).toBe(true);
    // Best first.
    expect(candidates.map((c) => c.score)).toEqual([...candidates.map((c) => c.score)].sort((a, b) => b - a));
  });

  it("falls back to form and size without a profile, and says so", () => {
    const { candidates, rankedBy } = candidatesFor(null, wasatchCatalogue, plannerPlants);
    expect(rankedBy).toBe("form");
    expect(candidates).toHaveLength(plannerPlants.length);
    const result = drawProposal({ areaKind: "front", widthFt: 30, depthFt: 20 }, null, wasatchCatalogue, plannerPlants, program);
    expect(result?.proposal.notes[0]).toMatch(/could not read the soil/);
  });

  it("draws a plan from the ranked plants", () => {
    const result = drawProposal({ areaKind: "front", widthFt: 30, depthFt: 20 }, sltSunnyClay, wasatchCatalogue, plannerPlants, program);
    expect(result?.rankedBy).toBe("ground");
    const used = new Set(result!.proposal.plan.cells.flatMap((c) => (c.kind === "plant" ? [c.plantId] : [])));
    const ruledOut = wasatchCatalogue.filter((p) => RULED_OUT.includes(p.scientificName)).map((p) => p.id);
    expect(ruledOut).toHaveLength(RULED_OUT.length);
    for (const id of ruledOut) expect(used.has(id)).toBe(false);
  });
});

describe("siteProfileFrom", () => {
  it("needs every field the engine uses, and says nothing when one is missing", () => {
    const missingSoil: AssembleOutcome = {
      ok: true,
      values: { zoneOrdinal: 14, frostStationId: null, mukey: null, ph: null, sandPct: null, siltPct: null, clayPct: null, drainageClass: null, sunHoursSummer: 14 },
      provenance: {},
      caveats: [],
      detail: { frostStation: null, soil: null } as unknown as Extract<AssembleOutcome, { ok: true }>["detail"],
    };
    expect(siteProfileFrom(missingSoil, { latitude: 40.7, longitude: -111.9 })).toBeNull();
    expect(siteProfileFrom({ ok: false, reason: "zone_unavailable" }, { latitude: 40.7, longitude: -111.9 })).toBeNull();
  });
});

describe("the proposal route", () => {
  const env = { HYPERDRIVE: { connectionString: "postgres://unused" }, MARKET: "wasatch-front" };
  const post = (body: unknown) =>
    app.request("/v1/public/rebates/ut-landscape-incentive/proposals", { method: "POST", body: JSON.stringify(body), headers: { "Content-Type": "application/json" } }, env);
  const place = { latitude: 40.74, longitude: -111.84, zip: "84105" };

  it("turns away an area the planner cannot hold, before touching the database", async () => {
    expect((await post({ ...place, area: { areaKind: "front", widthFt: 12, depthFt: 10 } })).status).toBe(400);
    expect((await post({ ...place, area: { areaKind: "front", widthFt: 80, depthFt: 80 } })).status).toBe(400);
    expect((await post({ ...place, area: { areaKind: "roof", widthFt: 10, depthFt: 10 } })).status).toBe(400);
  });
});

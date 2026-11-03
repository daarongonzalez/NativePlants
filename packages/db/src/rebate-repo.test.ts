import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { checkPlan } from "@np/engine";
import { rebateProgramFileSchema, type PlanLayout, type PlanPlant } from "@np/shared";
import { createDatabase, type Database } from "./client";
import {
  getRebateProgram,
  recordRebateCheck,
  recordRebateOutcome,
  rebateRuleReport,
  upsertRebateProgram,
} from "./rebate-repo";
import { rebateCheckResults, rebateChecks, rebateProjects, rebateRules } from "./schema";

/**
 * The rebate tables against a real Postgres, loaded from the real Utah file.
 *
 * Each run uses its own program code, so runs do not collide on a shared
 * database. Skips without TEST_DATABASE_URL. A skip is not a pass.
 */
const url = process.env["TEST_DATABASE_URL"];
const describeIfDb = url ? describe : describe.skip;

const utah = rebateProgramFileSchema.parse(
  JSON.parse(readFileSync(fileURLToPath(new URL("../../../data/rebates/ut-landscape-incentive.json", import.meta.url)), "utf8")),
);
const CODE = `test-${Date.now()}`;
const file = { ...utah, code: CODE };

const plant: PlanPlant = {
  id: "plant-a",
  commonName: "Test plant",
  scientificName: "Testus a",
  matureHeightCm: 45,
  matureWidthCm: 90,
  lifeCycle: "perennial",
  plantForm: "wildflower",
  staysUnder24In: true,
  reviewStatus: "draft",
};
const layout = (planted: number): PlanLayout => ({
  areaKind: "front",
  widthFt: 10,
  depthFt: 20,
  cells: Array.from({ length: 8 }, (_, i) => (i < planted ? { kind: "plant", plantId: "plant-a" } : { kind: "lawn" })),
});

describeIfDb("rebate tables", () => {
  let db: Database;

  beforeAll(() => {
    db = createDatabase(url!);
  });

  it("loads the program and all its rules, and loading again changes nothing", async () => {
    const first = await upsertRebateProgram(db, file);
    const second = await upsertRebateProgram(db, file);
    expect(second.programId).toBe(first.programId);

    const rules = await db.select().from(rebateRules).where(eq(rebateRules.programId, first.programId));
    expect(rules).toHaveLength(23);
  });

  it("reads back a program the check can use, rules in order", async () => {
    const program = await getRebateProgram(db, CODE);
    expect(program).not.toBeNull();
    expect(program!.perSqftAmount).toBe(2);
    expect(program!.rules.map((r) => r.code).slice(0, 3)).toEqual(["E1", "E2", "E3"]);
    expect(program!.rules.find((r) => r.code === "C2")!.parameters).toMatchObject({ minPct: 50 });
  });

  it("keeps old rules when a new version arrives, and serves only the new one", async () => {
    const v2 = { ...file, rulesVersion: "test-v2", rules: file.rules.slice(0, 5) };
    const { programId } = await upsertRebateProgram(db, v2);
    const all = await db.select().from(rebateRules).where(eq(rebateRules.programId, programId));
    expect(all).toHaveLength(28);
    expect((await getRebateProgram(db, CODE))!.rules).toHaveLength(5);
    await upsertRebateProgram(db, file);
  });

  it("records an anonymous check with a result for every rule", async () => {
    const program = (await getRebateProgram(db, CODE))!;
    const check = checkPlan(program, layout(8), [plant]);
    const saved = await recordRebateCheck(db, { programCode: CODE, projectId: null, zip: "84101", layout: layout(8), check });
    expect(saved).not.toBeNull();

    const results = await db.select().from(rebateCheckResults).where(eq(rebateCheckResults.checkId, saved!.checkId));
    expect(results).toHaveLength(23);
    const [project] = await db.select().from(rebateProjects).where(eq(rebateProjects.id, saved!.projectId));
    expect(project!.zip).toBe("84101");
  });

  it("adds a second check to the same project, and ignores a made-up project id", async () => {
    const program = (await getRebateProgram(db, CODE))!;
    const first = await recordRebateCheck(db, {
      programCode: CODE,
      projectId: null,
      zip: null,
      layout: layout(2),
      check: checkPlan(program, layout(2), [plant]),
    });
    const again = await recordRebateCheck(db, {
      programCode: CODE,
      projectId: first!.projectId,
      zip: null,
      layout: layout(8),
      check: checkPlan(program, layout(8), [plant]),
    });
    expect(again!.projectId).toBe(first!.projectId);
    expect(await db.select().from(rebateChecks).where(eq(rebateChecks.projectId, first!.projectId))).toHaveLength(2);

    const stranger = await recordRebateCheck(db, {
      programCode: CODE,
      projectId: "00000000-0000-4000-8000-000000000000",
      zip: null,
      layout: layout(8),
      check: checkPlan(program, layout(8), [plant]),
    });
    expect(stranger!.projectId).not.toBe("00000000-0000-4000-8000-000000000000");

    // The report counts each project once, by its latest check: the fixed plan passes.
    const report = await rebateRuleReport(db, CODE);
    const area = report.filter((r) => r.code === "E6");
    expect(area.find((r) => r.result === "fail")).toBeUndefined();

    expect(await recordRebateOutcome(db, { projectId: first!.projectId, stage: "applied", reportedBy: "owner" })).not.toBeNull();
  });

  it("refuses a program it does not know", async () => {
    const program = (await getRebateProgram(db, CODE))!;
    const saved = await recordRebateCheck(db, {
      programCode: "no-such-program",
      projectId: null,
      zip: null,
      layout: layout(8),
      check: checkPlan(program, layout(8), [plant]),
    });
    expect(saved).toBeNull();
  });
});

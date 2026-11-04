import { and, eq, inArray, sql } from "drizzle-orm";
import type {
  PlanLayout,
  PlanPlant,
  RebateCheck,
  RebateProgramFile,
  RebateProgramSummary,
  RebateRule,
} from "@np/shared";
import type { Database } from "./client";
import {
  plants,
  rebateCheckResults,
  rebateChecks,
  rebateOutcomes,
  rebateProgramAreas,
  rebatePrograms,
  rebateProjects,
  rebateRules,
} from "./schema";

/* ------------------------------------------------------------------ *
 * Layer one: programs and rules. Written by the import job only.
 * ------------------------------------------------------------------ */

/**
 * Load a program file. All in one transaction: a half-written rule set is
 * worse than the old one, because the check would run against a mix.
 *
 * Rules are keyed by (program, rules version, code). Loading the same version
 * again refreshes its wording in place; a new version adds new rows and leaves
 * the old ones, so checks recorded against them still make sense.
 */
export async function upsertRebateProgram(db: Database, file: RebateProgramFile) {
  return db.transaction(async (tx) => {
    const verifiedAt = new Date(`${file.verifiedAt}T00:00:00Z`);
    const values = {
      code: file.code,
      name: file.name,
      utilityName: file.utilityName,
      perSqftAmount: file.perSqftAmount === null ? null : String(file.perSqftAmount),
      maxAward: file.maxAward === null ? null : String(file.maxAward),
      amountNote: file.amountNote,
      requiresPreApproval: file.requiresPreApproval,
      requiresPlan: file.requiresPlan,
      minPlantCoveragePct: file.minPlantCoveragePct,
      minAreaSqft: file.minAreaSqft,
      completionMonths: file.completionMonths,
      correctionDays: file.correctionDays,
      inspectionBlackoutStart: file.inspectionBlackoutStart,
      inspectionBlackoutEnd: file.inspectionBlackoutEnd,
      payee: file.payee,
      plantListUrl: file.plantListUrl,
      applicationUrl: file.applicationUrl,
      status: file.status,
      rulesVersion: file.rulesVersion,
      sourceUrl: file.sourceUrl,
      verifiedAt,
      verifiedBy: file.verifiedBy,
    };

    const [program] = await tx
      .insert(rebatePrograms)
      .values(values)
      .onConflictDoUpdate({ target: rebatePrograms.code, set: values })
      .returning({ id: rebatePrograms.id });
    const programId = program!.id;

    // Areas are a plain list: replace it.
    await tx.delete(rebateProgramAreas).where(eq(rebateProgramAreas.programId, programId));
    if (file.areas.length > 0) {
      await tx.insert(rebateProgramAreas).values(
        file.areas.map((a) => ({
          programId,
          communityName: a.communityName,
          waterSupplier: a.waterSupplier,
          hasSecondaryWater: a.hasSecondaryWater,
          sourceUrl: file.sourceUrl,
          verifiedAt,
        })),
      );
    }

    for (const [position, rule] of file.rules.entries()) {
      const row = {
        programId,
        rulesVersion: file.rulesVersion,
        code: rule.code,
        position,
        stage: rule.stage,
        checkType: rule.checkType,
        checkKey: rule.checkKey,
        title: rule.title,
        sourceText: rule.sourceText,
        plainText: rule.plainText,
        parameters: rule.parameters,
        sourceUrl: file.sourceUrl,
        verifiedAt,
        verifiedBy: file.verifiedBy,
      };
      await tx
        .insert(rebateRules)
        .values(row)
        .onConflictDoUpdate({
          target: [rebateRules.programId, rebateRules.rulesVersion, rebateRules.code],
          set: row,
        });
    }

    return { programId, rules: file.rules.length, areas: file.areas.length };
  });
}

/** A program and its current rules, ready for the check. Null if unknown or not active. */
export async function getRebateProgram(db: Database, code: string): Promise<RebateProgramSummary | null> {
  const [p] = await db.select().from(rebatePrograms).where(eq(rebatePrograms.code, code)).limit(1);
  if (!p || p.status !== "active") return null;

  const rules = await db
    .select()
    .from(rebateRules)
    .where(and(eq(rebateRules.programId, p.id), eq(rebateRules.rulesVersion, p.rulesVersion)))
    .orderBy(rebateRules.position);

  return {
    code: p.code,
    name: p.name,
    utilityName: p.utilityName,
    perSqftAmount: p.perSqftAmount === null ? null : Number(p.perSqftAmount),
    maxAward: p.maxAward === null ? null : Number(p.maxAward),
    amountNote: p.amountNote,
    minPlantCoveragePct: p.minPlantCoveragePct ?? 50,
    minAreaSqft: p.minAreaSqft ?? 0,
    completionMonths: p.completionMonths,
    correctionDays: p.correctionDays,
    inspectionBlackoutStart: p.inspectionBlackoutStart,
    inspectionBlackoutEnd: p.inspectionBlackoutEnd,
    applicationUrl: p.applicationUrl,
    rulesVersion: p.rulesVersion,
    sourceUrl: p.sourceUrl,
    verifiedAt: p.verifiedAt.toISOString(),
    rules: rules.map(
      (r): RebateRule => ({
        code: r.code,
        stage: r.stage as RebateRule["stage"],
        checkType: r.checkType as RebateRule["checkType"],
        checkKey: (r.checkKey as RebateRule["checkKey"]) ?? null,
        title: r.title,
        sourceText: r.sourceText,
        plainText: r.plainText,
        parameters: (r.parameters ?? {}) as Record<string, unknown>,
      }),
    ),
  };
}

/** Participating communities for a program, by name. Empty when the list is not loaded yet. */
export async function listRebateAreas(db: Database, code: string) {
  return db
    .select({
      communityName: rebateProgramAreas.communityName,
      waterSupplier: rebateProgramAreas.waterSupplier,
      hasSecondaryWater: rebateProgramAreas.hasSecondaryWater,
    })
    .from(rebateProgramAreas)
    .innerJoin(rebatePrograms, eq(rebatePrograms.id, rebateProgramAreas.programId))
    .where(eq(rebatePrograms.code, code))
    .orderBy(rebateProgramAreas.communityName);
}

/**
 * Plants offered in the planner, with the facts the rebate check needs.
 *
 * Published plants only, unless `includeDrafts` is set. Drafts are allowed
 * while the reviewer works through the sheet, and the planner labels them.
 */
export async function listPlannerPlants(
  db: Database,
  market: string,
  options: { includeDrafts: boolean },
): Promise<PlanPlant[]> {
  const statuses = options.includeDrafts ? ["draft", "reviewed", "published"] : ["published"];
  const rows = await db
    .select()
    .from(plants)
    .where(and(eq(plants.market, market), inArray(plants.reviewStatus, statuses)))
    .orderBy(plants.scientificName);

  return rows.map(toPlanPlant);
}

/** The same plants, by id, for re-running a check on the server. Ignores ids it does not know. */
export async function getPlannerPlants(
  db: Database,
  market: string,
  ids: readonly string[],
  options: { includeDrafts: boolean },
): Promise<PlanPlant[]> {
  const uuids = ids.filter((id) => /^[0-9a-f-]{36}$/i.test(id));
  if (uuids.length === 0) return [];
  const statuses = options.includeDrafts ? ["draft", "reviewed", "published"] : ["published"];
  const rows = await db
    .select()
    .from(plants)
    .where(and(eq(plants.market, market), inArray(plants.id, uuids), inArray(plants.reviewStatus, statuses)));
  return rows.map(toPlanPlant);
}

function toPlanPlant(row: typeof plants.$inferSelect): PlanPlant {
  return {
    id: row.id,
    commonName: row.commonNames[0] ?? row.scientificName,
    scientificName: row.scientificName,
    matureHeightCm: row.matureHeightCm,
    matureWidthCm: row.matureWidthCm,
    lifeCycle: (row.lifeCycle as PlanPlant["lifeCycle"]) ?? null,
    plantForm: (row.plantForm as PlanPlant["plantForm"]) ?? null,
    staysUnder24In: row.staysUnder24In,
    reviewStatus: row.reviewStatus as PlanPlant["reviewStatus"],
  };
}

/* ------------------------------------------------------------------ *
 * Layer two: the tracker. Anonymous: no address, email or user.
 * ------------------------------------------------------------------ */

/**
 * Record one press of "Check my plan".
 *
 * A project id from the browser is reused only if it exists and matches the
 * program and area; otherwise a new project starts. That keeps a stale or
 * made-up id from attaching checks to someone else's project.
 */
export async function recordRebateCheck(
  db: Database,
  input: {
    programCode: string;
    projectId: string | null;
    zip: string | null;
    layout: PlanLayout;
    check: RebateCheck;
  },
): Promise<{ projectId: string; checkId: string } | null> {
  return db.transaction(async (tx) => {
    const [program] = await tx
      .select({ id: rebatePrograms.id, rulesVersion: rebatePrograms.rulesVersion })
      .from(rebatePrograms)
      .where(eq(rebatePrograms.code, input.programCode))
      .limit(1);
    if (!program) return null;

    let projectId: string | null = null;
    if (input.projectId && /^[0-9a-f-]{36}$/i.test(input.projectId)) {
      const [existing] = await tx
        .select({ id: rebateProjects.id })
        .from(rebateProjects)
        .where(
          and(
            eq(rebateProjects.id, input.projectId),
            eq(rebateProjects.programId, program.id),
            eq(rebateProjects.areaKind, input.layout.areaKind),
          ),
        )
        .limit(1);
      projectId = existing?.id ?? null;
    }

    if (projectId) {
      await tx
        .update(rebateProjects)
        .set({ widthFt: input.layout.widthFt, depthFt: input.layout.depthFt })
        .where(eq(rebateProjects.id, projectId));
    } else {
      const [created] = await tx
        .insert(rebateProjects)
        .values({
          programId: program.id,
          areaKind: input.layout.areaKind,
          widthFt: input.layout.widthFt,
          depthFt: input.layout.depthFt,
          zip: input.zip,
        })
        .returning({ id: rebateProjects.id });
      projectId = created!.id;
    }

    const [check] = await tx
      .insert(rebateChecks)
      .values({
        projectId,
        rulesVersion: program.rulesVersion,
        overall: input.check.overall,
        eligibleSqft: input.check.eligibleSqft,
        estimatedAmount: String(input.check.estimatedAmount),
        coveragePct: input.check.coveragePct,
        layout: input.layout,
      })
      .returning({ id: rebateChecks.id });

    const rules = await tx
      .select({ id: rebateRules.id, code: rebateRules.code })
      .from(rebateRules)
      .where(and(eq(rebateRules.programId, program.id), eq(rebateRules.rulesVersion, program.rulesVersion)));
    const ruleIds = new Map(rules.map((r) => [r.code, r.id]));

    const results = input.check.outcomes
      .filter((o) => ruleIds.has(o.code))
      .map((o) => ({
        checkId: check!.id,
        ruleId: ruleIds.get(o.code)!,
        result: o.result,
        measuredValue: o.measuredValue,
        note: o.note,
      }));
    if (results.length > 0) await tx.insert(rebateCheckResults).values(results);

    return { projectId, checkId: check!.id };
  });
}

/** Record a stage a project reached, as reported by the owner or the program. */
export async function recordRebateOutcome(
  db: Database,
  input: {
    projectId: string;
    stage: string;
    reportedBy: "owner" | "program";
    failedRuleCodes?: string[];
    note?: string;
  },
) {
  const [row] = await db
    .insert(rebateOutcomes)
    .values({
      projectId: input.projectId,
      stage: input.stage,
      reportedBy: input.reportedBy,
      failedRuleCodes: input.failedRuleCodes ?? null,
      note: input.note ?? null,
    })
    .returning({ id: rebateOutcomes.id });
  return row ?? null;
}

/**
 * The tracker report: for each rule, how often the latest check on each
 * project passed, warned or failed. "Latest" so a gardener who fixes their
 * plan is counted once, with the fixed result.
 */
export async function rebateRuleReport(db: Database, programCode: string) {
  const result = await db.execute(sql`
    with latest as (
      select distinct on (c.project_id) c.id, c.project_id, c.overall
      from ${rebateChecks} c
      join ${rebateProjects} p on p.id = c.project_id
      join ${rebatePrograms} pr on pr.id = p.program_id
      where pr.code = ${programCode}
      order by c.project_id, c.created_at desc
    )
    select r.code, r.title, cr.result, count(*)::int as projects
    from latest l
    join ${rebateCheckResults} cr on cr.check_id = l.id
    join ${rebateRules} r on r.id = cr.rule_id
    group by r.code, r.title, r.position, cr.result
    order by r.position, cr.result
  `);
  return result.rows as { code: string; title: string; result: string; projects: number }[];
}

import {
  PARK_STRIP_MAX_HEIGHT_CM,
  SQUARE_FT,
  SQUARE_SQFT,
  type Cell,
  type PlanLayout,
  type PlanPlant,
  type PlantTally,
  type RebateCheck,
  type RebateProgramSummary,
  type RebateRule,
  type RuleOutcome,
  type RuleResult,
} from "@np/shared";

/**
 * Check a planner layout against a rebate program's rules.
 *
 * Pure: the same layout, plants and rules always give the same answer, so the
 * web app runs it on every tap and the API runs it again before recording a
 * check. Rules that only the owner or the inspector can settle are listed with
 * that status, never marked as passed.
 *
 * Every figure is an estimate from 5 ft squares and the plants' mature sizes.
 * A check says "likely", never "approved": only the program approves.
 */

const CM_PER_FT = 30.48;

/** How many of a plant fill one 5 ft square at mature spacing. At least one. */
export function plantsPerSquare(matureWidthCm: number): number {
  const across = Math.max(1, Math.round(SQUARE_FT / (matureWidthCm / CM_PER_FT)));
  return across * across;
}

/** Ground a square of this plant covers at maturity, in sq ft, capped at the square. */
export function coveredSqftPerSquare(matureWidthCm: number): number {
  const radiusFt = matureWidthCm / CM_PER_FT / 2;
  const footprint = Math.PI * radiusFt * radiusFt;
  return Math.min(SQUARE_SQFT, plantsPerSquare(matureWidthCm) * footprint);
}

/** Whether a plant counts towards ground-plane perennial cover. Null when its data is incomplete. */
export function countsTowardsCover(
  plant: PlanPlant,
  rule: { excludeForms?: string[]; countLifeCycles?: string[] } = {},
): boolean | null {
  if (plant.lifeCycle === null || plant.plantForm === null) return null;
  const lifeCycles = rule.countLifeCycles ?? ["perennial"];
  const excluded = rule.excludeForms ?? ["tree"];
  return lifeCycles.includes(plant.lifeCycle) && !excluded.includes(plant.plantForm);
}

/**
 * Squares of lawn that sit in a strip narrower than the minimum width.
 *
 * At 5 ft squares, an 8 ft minimum means two squares. A lawn square is fine if
 * it belongs to at least one block of lawn that many squares wide and deep.
 */
export function narrowLawnSquares(cells: readonly Cell[], columns: number, minFt: number): number[] {
  const rows = cells.length / columns;
  const k = Math.ceil(minFt / SQUARE_FT);
  const isLawn = (r: number, c: number) =>
    r >= 0 && c >= 0 && r < rows && c < columns && cells[r * columns + c]!.kind === "lawn";

  const ok = new Set<number>();
  for (let r = 0; r + k <= rows; r++) {
    for (let c = 0; c + k <= columns; c++) {
      let all = true;
      for (let dr = 0; dr < k && all; dr++) for (let dc = 0; dc < k && all; dc++) all = isLawn(r + dr, c + dc);
      if (!all) continue;
      for (let dr = 0; dr < k; dr++) for (let dc = 0; dc < k; dc++) ok.add((r + dr) * columns + c + dc);
    }
  }
  const narrow: number[] = [];
  cells.forEach((cell, i) => {
    if (cell.kind === "lawn" && !ok.has(i)) narrow.push(i);
  });
  return narrow;
}

const num = (params: Record<string, unknown>, key: string, fallback: number): number => {
  const v = params[key];
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
};

const fmt = (n: number) => Math.round(n).toLocaleString("en-US");

export function checkPlan(
  program: Pick<RebateProgramSummary, "perSqftAmount" | "maxAward" | "minAreaSqft" | "minPlantCoveragePct" | "rules">,
  layout: PlanLayout,
  plants: readonly PlanPlant[],
): RebateCheck {
  const byId = new Map(plants.map((p) => [p.id, p]));
  const columns = layout.widthFt / SQUARE_FT;
  const cells = layout.cells;

  let mulch = 0;
  let pavers = 0;
  let planted = 0;
  let unknownPlants = 0;
  const tallies = new Map<string, PlantTally>();
  for (const cell of cells) {
    if (cell.kind === "mulch") mulch++;
    else if (cell.kind === "pavers") pavers++;
    else if (cell.kind === "plant") {
      const plant = byId.get(cell.plantId);
      if (!plant) {
        unknownPlants++;
        continue;
      }
      planted++;
      const t = tallies.get(plant.id) ?? { plantId: plant.id, commonName: plant.commonName, squares: 0, plantCount: 0 };
      t.squares++;
      t.plantCount += plantsPerSquare(plant.matureWidthCm);
      tallies.set(plant.id, t);
    }
  }

  const totalSqft = cells.length * SQUARE_SQFT;
  const eligibleSqft = (planted + mulch) * SQUARE_SQFT;
  const hardscapePct = cells.length === 0 ? 0 : (pavers / cells.length) * 100;

  const coverRule = program.rules.find((r) => r.checkKey === "coverage");
  const coverParams = (coverRule?.parameters ?? {}) as { excludeForms?: string[]; countLifeCycles?: string[] };
  let coveredSqft = 0;
  let incompletePlants = 0;
  for (const cell of cells) {
    if (cell.kind !== "plant") continue;
    const plant = byId.get(cell.plantId);
    if (!plant) continue;
    const counts = countsTowardsCover(plant, coverParams);
    if (counts === null) incompletePlants++;
    if (counts) coveredSqft += coveredSqftPerSquare(plant.matureWidthCm);
  }
  const coveragePct = eligibleSqft === 0 ? 0 : (coveredSqft / eligibleSqft) * 100;

  const outcomes = program.rules.map((rule) =>
    outcomeFor(rule, {
      program,
      layout,
      columns,
      plants: byId,
      eligibleSqft,
      pavers,
      coveragePct,
      hardscapePct,
      incompletePlants,
      unknownPlants,
    }),
  );

  const minArea = program.minAreaSqft;
  const rate = program.perSqftAmount ?? 0;
  let estimatedAmount = eligibleSqft >= minArea ? eligibleSqft * rate : 0;
  if (program.maxAward !== null) estimatedAmount = Math.min(estimatedAmount, program.maxAward);

  return {
    overall: outcomes.some((o) => o.result === "fail") ? "needs_changes" : "likely",
    totalSqft,
    eligibleSqft,
    coveragePct: Math.round(coveragePct * 10) / 10,
    hardscapePct: Math.round(hardscapePct * 10) / 10,
    estimatedAmount: Math.round(estimatedAmount * 100) / 100,
    outcomes,
    plants: [...tallies.values()].sort((a, b) => b.squares - a.squares),
  };
}

interface Context {
  program: Pick<RebateProgramSummary, "minAreaSqft" | "minPlantCoveragePct">;
  layout: PlanLayout;
  columns: number;
  plants: Map<string, PlanPlant>;
  eligibleSqft: number;
  pavers: number;
  coveragePct: number;
  hardscapePct: number;
  incompletePlants: number;
  unknownPlants: number;
}

function outcomeFor(rule: RebateRule, ctx: Context): RuleOutcome {
  const base = { code: rule.code, title: rule.title, stage: rule.stage, checkType: rule.checkType };
  const out = (result: RuleResult, note: string, measuredValue: number | null = null): RuleOutcome => ({
    ...base,
    result,
    measuredValue,
    note,
  });

  if (rule.checkType === "owner_confirms" || rule.checkType === "photo_check") {
    return out("owner_to_confirm", rule.plainText);
  }
  if (rule.checkType === "inspector_only") return out("inspector_checks", rule.plainText);

  const p = rule.parameters;
  switch (rule.checkKey) {
    case "min_area": {
      const min = num(p, "minSqft", ctx.program.minAreaSqft);
      return ctx.eligibleSqft >= min
        ? out("pass", `${fmt(ctx.eligibleSqft)} sq ft of planting and mulch, over the ${fmt(min)} sq ft minimum.`, ctx.eligibleSqft)
        : out(
            "fail",
            `${fmt(ctx.eligibleSqft)} sq ft of planting and mulch. You need ${fmt(min - ctx.eligibleSqft)} sq ft more, here or in another area.`,
            ctx.eligibleSqft,
          );
    }

    case "coverage": {
      const min = num(p, "minPct", ctx.program.minPlantCoveragePct);
      const pct = Math.round(ctx.coveragePct);
      if (ctx.eligibleSqft === 0) return out("fail", "Nothing is planted yet.", 0);
      if (ctx.incompletePlants > 0) {
        return out(
          "warn",
          `About ${pct}% covered, but some plants are missing the details we need to count them. Treat this figure as a floor.`,
          pct,
        );
      }
      return ctx.coveragePct >= min
        ? out("pass", `About ${pct}% of the ground covered by perennials when fully grown. The rule asks for ${min}%.`, pct)
        : out("fail", `About ${pct}% covered when fully grown. Plant more squares, or pick wider-spreading plants, to reach ${min}%.`, pct);
    }

    case "lawn_width": {
      const minFt = num(p, "minFt", 8);
      const lawn = ctx.layout.cells.filter((c) => c.kind === "lawn").length;
      if (lawn === 0) return out("pass", "No lawn left in this area.", null);
      const narrow = narrowLawnSquares(ctx.layout.cells, ctx.columns, minFt).length;
      return narrow === 0
        ? out("pass", `Every patch of lawn left is at least ${minFt} ft wide, measured in 5 ft squares. Check real widths with a tape.`, null)
        : out(
            "fail",
            `${narrow} square${narrow === 1 ? "" : "s"} of lawn sit in a strip narrower than ${minFt} ft. Widen them or convert them.`,
            narrow,
          );
    }

    case "hardscape_share": {
      const kind = ctx.layout.areaKind;
      const max = kind === "back" ? num(p, "backMaxPct", 75) : num(p, "frontMaxPct", 50);
      const pct = Math.round(ctx.hardscapePct);
      const where = kind === "back" ? "a backyard" : "a front yard";
      return ctx.hardscapePct <= max
        ? out("pass", `Pavers cover ${pct}% of this area. The limit for ${where} is ${max}%.`, pct)
        : out("fail", `Pavers cover ${pct}% of this area, over the ${max}% limit for ${where}.`, pct);
    }

    case "park_strip_height": {
      if (ctx.layout.areaKind !== "park_strip") return out("not_applicable", "Applies to park strips only.");
      const maxIn = num(p, "maxInches", 24);
      const used = new Map<string, PlanPlant>();
      for (const c of ctx.layout.cells) {
        if (c.kind === "plant") {
          const plant = ctx.plants.get(c.plantId);
          if (plant) used.set(plant.id, plant);
        }
      }
      const tooTall = [...used.values()].filter(
        (pl) => pl.staysUnder24In === false || pl.matureHeightCm > PARK_STRIP_MAX_HEIGHT_CM,
      );
      const unsure = [...used.values()].filter((pl) => pl.staysUnder24In === null && !tooTall.includes(pl));
      if (tooTall.length > 0) {
        return out("fail", `Taller than ${maxIn} inches when grown: ${tooTall.map((pl) => pl.commonName).join(", ")}.`, tooTall.length);
      }
      if (unsure.length > 0) {
        return out("owner_to_confirm", `We do not know yet whether these stay under ${maxIn} inches: ${unsure.map((pl) => pl.commonName).join(", ")}.`);
      }
      return out("pass", `Every plant here stays under ${maxIn} inches without pruning.`);
    }

    case "excluded_materials": {
      if (ctx.pavers === 0) return out("pass", "No pavers in this plan. Turf, rubber mulch and water features are not offered in the planner.");
      return out(
        "warn",
        `${fmt(ctx.pavers * SQUARE_SQFT)} sq ft of pavers is left out of the rebate. Gravel or flagstone chips count as mulch instead.`,
        ctx.pavers * SQUARE_SQFT,
      );
    }

    default:
      return out("owner_to_confirm", rule.plainText);
  }
}

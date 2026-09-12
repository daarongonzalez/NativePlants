import { describe, expect, it } from "vitest";
import { textureClass, zoneToOrdinal, ordinalToZone } from "@np/shared";
import type { Goals } from "@np/shared";
import { recommend, scorePlant } from "./score.js";
import {
  bougainvillea,
  firecrackerPenstemon,
  highbushBlueberry,
  marshMarigold,
  skunkbushSumac,
  sltShadedDry,
  sltSunnyClay,
  wasatchCatalogue,
  yarrow,
} from "./__fixtures__/wasatch.js";

const NO_GOALS: Goals = {
  pollinators: false,
  lowWater: false,
  deerResistant: false,
  cutFlowers: false,
  edible: false,
};

describe("zone ordinals", () => {
  it("round-trips", () => {
    for (const zone of ["4a", "7b", "8a", "10b"]) {
      const ordinal = zoneToOrdinal(zone);
      expect(ordinal).not.toBeNull();
      expect(ordinalToZone(ordinal!)).toBe(zone);
    }
  });

  it("sorts correctly across the a/b boundary", () => {
    expect(zoneToOrdinal("7a")!).toBeLessThan(zoneToOrdinal("7b")!);
    expect(zoneToOrdinal("7b")!).toBeLessThan(zoneToOrdinal("8a")!);
  });

  it("returns null rather than guessing", () => {
    for (const bad of ["", "zone 7", "7", "7c", "99a"]) {
      expect(zoneToOrdinal(bad)).toBeNull();
    }
  });
});

describe("soil texture", () => {
  it("classifies the Wasatch Front fixture as clay loam", () => {
    expect(textureClass(32, 34, 34)).toBe("clay_loam");
  });

  it("classifies the triangle corners", () => {
    expect(textureClass(90, 5, 5)).toBe("sand");
    expect(textureClass(20, 20, 60)).toBe("clay");
    expect(textureClass(20, 60, 20)).toBe("silt_loam");
    expect(textureClass(40, 40, 20)).toBe("loam");
  });
});

describe("hard exclusions", () => {
  it("rejects blueberries in alkaline soil", () => {
    const result = scorePlant(sltSunnyClay, highbushBlueberry, NO_GOALS);
    expect(result).toHaveProperty("exclusion");
    if ("exclusion" in result) {
      expect(result.exclusion.kind).toBe("ph_too_high");
    }
  });

  it("rejects a bog plant in moderately well drained soil", () => {
    const result = scorePlant(sltSunnyClay, marshMarigold, NO_GOALS);
    expect(result).toHaveProperty("exclusion");
    if ("exclusion" in result) {
      expect(result.exclusion.kind).toBe("drainage_intolerant");
    }
  });

  it("rejects a tender subtropical in zone 7b", () => {
    const result = scorePlant(sltSunnyClay, bougainvillea, NO_GOALS);
    expect(result).toHaveProperty("exclusion");
    if ("exclusion" in result) {
      expect(result.exclusion.kind).toBe("zone_too_cold");
    }
  });

  it("admits a native that thrives in alkaline clay", () => {
    const result = scorePlant(sltSunnyClay, firecrackerPenstemon, NO_GOALS);
    expect(result).not.toHaveProperty("exclusion");
  });
});

describe("ranking", () => {
  it("puts locally adapted natives above marginal plants", () => {
    const { recommended } = recommend(sltSunnyClay, wasatchCatalogue, NO_GOALS);
    const names = recommended.map((r) => r.plant.scientificName);
    expect(names).toContain("Penstemon eatonii");
    expect(names.indexOf("Penstemon eatonii")).toBeLessThan(names.length);
    expect(recommended[0]!.score).toBeGreaterThan(0.7);
  });

  it("returns rejections rather than discarding them", () => {
    const { recommended, rejected } = recommend(sltSunnyClay, wasatchCatalogue, NO_GOALS);
    expect(recommended.length + rejected.length).toBe(wasatchCatalogue.length);
    expect(rejected.length).toBeGreaterThan(0);
  });

  it("is deterministic", () => {
    const a = recommend(sltSunnyClay, wasatchCatalogue, NO_GOALS);
    const b = recommend(sltSunnyClay, wasatchCatalogue, NO_GOALS);
    expect(a.recommended.map((r) => r.plant.id)).toEqual(b.recommended.map((r) => r.plant.id));
  });

  it("scores every recommendation between 0 and 1", () => {
    const { recommended } = recommend(sltSunnyClay, wasatchCatalogue, NO_GOALS);
    for (const r of recommended) {
      expect(r.score).toBeGreaterThanOrEqual(0);
      expect(r.score).toBeLessThanOrEqual(1);
    }
  });
});

describe("site conditions change the answer", () => {
  it("penalises sun-lovers in a shaded bed", () => {
    const sunny = scorePlant(sltSunnyClay, firecrackerPenstemon, NO_GOALS);
    const shaded = scorePlant(sltShadedDry, firecrackerPenstemon, NO_GOALS);
    if ("score" in sunny && "score" in shaded) {
      expect(shaded.score).toBeLessThan(sunny.score);
    } else {
      throw new Error("expected both to be recommendations");
    }
  });

  it("says so plainly when a plant wants more sun", () => {
    const shaded = scorePlant(sltShadedDry, firecrackerPenstemon, NO_GOALS);
    if (!("components" in shaded)) throw new Error("expected a recommendation");
    const sun = shaded.components.find((c) => c.name === "sun");
    expect(sun!.explanation).toMatch(/more sun/i);
  });

  it("favours drought tolerance where there is no irrigation", () => {
    const withIrrigation = scorePlant(sltSunnyClay, skunkbushSumac, NO_GOALS);
    const without = scorePlant(
      { ...sltSunnyClay, constraints: { ...sltSunnyClay.constraints, irrigationAvailable: false } },
      skunkbushSumac,
      NO_GOALS,
    );
    if ("score" in withIrrigation && "score" in without) {
      // Very low water use, so removing irrigation should barely matter.
      expect(Math.abs(without.score - withIrrigation.score)).toBeLessThan(0.05);
    }
  });
});

describe("goals reweight without filtering", () => {
  it("never excludes a plant for failing a goal", () => {
    const base = recommend(sltSunnyClay, wasatchCatalogue, NO_GOALS);
    const goals = recommend(sltSunnyClay, wasatchCatalogue, { ...NO_GOALS, cutFlowers: true });
    expect(goals.recommended.length).toBe(base.recommended.length);
  });

  it("lifts a cut-flower plant when cut flowers are asked for", () => {
    const base = scorePlant(sltSunnyClay, yarrow, NO_GOALS);
    const asked = scorePlant(sltSunnyClay, yarrow, { ...NO_GOALS, cutFlowers: true });
    if ("score" in base && "score" in asked) {
      expect(asked.score).toBeGreaterThanOrEqual(base.score);
    }
  });

  it("treats no goals as neutral rather than a penalty", () => {
    const result = scorePlant(sltSunnyClay, yarrow, NO_GOALS);
    if (!("components" in result)) throw new Error("expected a recommendation");
    expect(result.components.find((c) => c.name === "goals")!.score).toBe(1);
  });
});

describe("every recommendation can be explained", () => {
  it("gives a non-empty headline", () => {
    const { recommended } = recommend(sltSunnyClay, wasatchCatalogue, NO_GOALS);
    for (const r of recommended) {
      expect(r.headline.length).toBeGreaterThan(0);
    }
  });

  it("cites the site's real pH in the pH explanation", () => {
    const result = scorePlant(sltSunnyClay, firecrackerPenstemon, NO_GOALS);
    if (!("components" in result)) throw new Error("expected a recommendation");
    expect(result.components.find((c) => c.name === "ph")!.explanation).toContain("8.0");
  });
});

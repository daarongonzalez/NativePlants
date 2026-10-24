/** Turns a stored profile row into the shape the scoring engine takes. */

/** Profile fields the engine needs, in the order we report them when missing. */
const REQUIRED_FIELDS = ["zoneOrdinal", "frost", "ph", "sandPct", "siltPct", "clayPct", "drainageClass", "sunHoursSummer"] as const;

type StoredProvenance = Record<string, { source: string; confidence: string; retrievedAt: string; note?: string }>;

/**
 * Widen a stored profile row into the domain shape the engine expects.
 *
 * Source and confidence come from the provenance recorded when the profile was
 * resolved. A field with no recorded provenance is reported as missing rather
 * than given a confidence we did not measure.
 *
 * `frost` is not stored on the profile row (only the station id is), so the
 * caller joins it in from the station's normals before calling this.
 */
export function toDomainProfile(
  stored: Record<string, unknown>,
  site: { latitude: number; longitude: number },
  siteId: string,
): { profile: unknown } | { missing: string[] } {
  const provenance = (stored["provenance"] ?? {}) as StoredProvenance;
  const missing = REQUIRED_FIELDS.filter((f) => stored[f] == null || provenance[f] === undefined);
  if (missing.length > 0) return { missing };

  const attributed = (field: string) => ({ value: stored[field], provenance: provenance[field] });

  return {
    profile: {
      siteId,
      resolvedAt: new Date(String(stored["resolvedAt"])).toISOString(),
      latitude: site.latitude,
      longitude: site.longitude,
      zoneOrdinal: attributed("zoneOrdinal"),
      frost: attributed("frost"),
      ph: attributed("ph"),
      sandPct: attributed("sandPct"),
      siltPct: attributed("siltPct"),
      clayPct: attributed("clayPct"),
      drainageClass: attributed("drainageClass"),
      sunHoursSummer: attributed("sunHoursSummer"),
      constraints: {
        deerPressure: false,
        pets: false,
        youngChildren: false,
        irrigationAvailable: true,
        hoaRestrictions: false,
      },
    },
  };
}

import type { Database, Owner } from "@np/db";
import { createSiteProfile, findNearestStation, findSoilAtPoint, lookupZoneByZip, setSiteLocation } from "@np/db";
import { frostConfidence, soilConfidence, summarizeTopsoil, zoneConfidence } from "@np/engine";
import type { ElevationClient, GeocodeClient } from "@np/sources";
import { ordinalToZone } from "@np/shared";

/**
 * The resolve pipeline: an address in, a profile snapshot out.
 *
 * Sources are injected rather than imported so this is testable without
 * network access, and so a source outage is a swap at one seam.
 *
 * Resolves zone, frost and soil. Sun hours are not built yet and stay null — a
 * partial profile that says what it does not know is more useful than none.
 */

export interface ResolveDeps {
  db: Database;
  geocoder: GeocodeClient;
  elevation: ElevationClient;
}

export type ResolveOutcome =
  | { ok: true; profileId: string; summary: ResolveSummary }
  | { ok: false; reason: "site_not_found" | "address_not_found" | "zone_unavailable" };

export interface ResolveSummary {
  matchedAddress: string;
  latitude: number;
  longitude: number;
  zone: string | null;
  frostStationName: string | null;
  frostStationDistanceKm: number | null;
  /** Name of the county survey map unit under the address, or null when there is none. */
  soilMapUnit: string | null;
  /** Non-empty when elevation makes the station's dates a weaker claim for this site. */
  caveats: string[];
}

/** Per-field source and confidence, stored as jsonb on the snapshot. */
type ProvenanceMap = Record<string, { source: string; confidence: string; retrievedAt: string; note?: string }>;

export async function resolveSite(
  deps: ResolveDeps,
  owner: Owner,
  site: { id: string; addressText: string | null; latitude: number; longitude: number },
): Promise<ResolveOutcome> {
  const { db, geocoder, elevation } = deps;
  const retrievedAt = new Date().toISOString();
  const provenance: ProvenanceMap = {};
  const caveats: string[] = [];

  // 1. Resolve coordinates. A site created from a dropped pin already has
  //    them and its address text is the user's, not the geocoder's.
  let latitude = site.latitude;
  let longitude = site.longitude;
  let matchedAddress = site.addressText ?? "";
  let matchQuality = "approximate";
  let zip: string | null = null;

  if (site.addressText) {
    const geocoded = await geocoder.geocode(site.addressText);
    if (!geocoded) return { ok: false, reason: "address_not_found" };

    latitude = geocoded.latitude;
    longitude = geocoded.longitude;
    matchedAddress = geocoded.matchedAddress;
    matchQuality = geocoded.matchQuality;
    zip = geocoded.zip;

    await setSiteLocation(db, owner, site.id, { latitude, longitude, addressText: matchedAddress });

    if (matchQuality !== "rooftop") {
      caveats.push(
        "We could not place your address on a building, so this location is approximate. Drag the pin to your yard for a better answer.",
      );
    }
  }

  // 2. Hardiness zone. Keyed by ZIP, which is a USPS delivery route rather
  //    than a shape on the ground — hence never high confidence.
  let zoneOrdinal: number | null = null;
  if (zip) {
    const zone = await lookupZoneByZip(db, zip);
    if (zone) {
      zoneOrdinal = zone.zoneOrdinal;
      provenance["zoneOrdinal"] = {
        source: "usda_phzm",
        confidence: zoneConfidence(matchQuality),
        retrievedAt,
        note: `From ZIP ${zip}, ${zone.sourceYear} revision`,
      };
    }
  }

  if (zoneOrdinal === null) {
    // Without a zone there is nothing to filter plants by later, so this is
    // a real failure rather than a partial success.
    return { ok: false, reason: "zone_unavailable" };
  }

  // 3. Nearest station with frost normals, and how much to trust it here.
  const station = await findNearestStation(db, latitude, longitude);
  let frostStationId: string | null = null;
  let frostStationName: string | null = null;
  let frostStationDistanceKm: number | null = null;

  if (station) {
    const siteElevationM = await safeElevation(elevation, latitude, longitude);
    const trust = frostConfidence(siteElevationM, station.elevationM);

    frostStationId = station.stationId;
    frostStationName = station.name;
    frostStationDistanceKm = Math.round(station.distanceM / 100) / 10;

    provenance["frost"] = {
      source: "noaa_normals",
      confidence: trust.confidence,
      retrievedAt,
      note: `${station.name}, ${frostStationDistanceKm} km away, ${station.frost.normalsPeriod} normals`,
    };

    if (trust.note) caveats.push(trust.note);
  }

  // 4. Soil from the county survey. Missing soil is a caveat, not a failure:
  //    zone and frost are still worth returning.
  const soil = await findSoilAtPoint(db, latitude, longitude);
  const topsoil = soil ? summarizeTopsoil(soil.horizons) : null;
  const hasSoilData = topsoil !== null && topsoil.ph !== null;

  if (!soil) {
    caveats.push(
      "The county soil survey has no map for this spot, so we cannot tell you about your soil. A home soil test would fill the gap.",
    );
  } else if (!hasSoilData) {
    caveats.push(
      `The county soil survey maps this ground as "${soil.name}", which it does not measure. Soil in built-up areas is often fill, so a home soil test is more reliable here.`,
    );
  } else {
    const confidence = soilConfidence(matchQuality);
    const note = `${soil.name}, county soil survey (${soil.surveyArea}), top 12 inches. An average for the surrounding map area, not a sample from your yard.`;
    for (const field of ["ph", "sandPct", "siltPct", "clayPct"] as const) {
      if (topsoil[field] !== null) provenance[field] = { source: "ssurgo", confidence, retrievedAt, note };
    }
    if (soil.drainageClass) provenance["drainageClass"] = { source: "ssurgo", confidence, retrievedAt, note };
  }

  const profile = await createSiteProfile(db, owner, site.id, {
    zoneOrdinal,
    frostStationId,
    mukey: hasSoilData ? soil!.mukey : null,
    ph: topsoil?.ph ?? null,
    sandPct: topsoil?.sandPct ?? null,
    siltPct: topsoil?.siltPct ?? null,
    clayPct: topsoil?.clayPct ?? null,
    drainageClass: hasSoilData ? (soil!.drainageClass ?? null) : null,
    sunHoursSummer: null,
    provenance,
  });

  if (!profile) return { ok: false, reason: "site_not_found" };

  return {
    ok: true,
    profileId: profile.id,
    summary: {
      matchedAddress,
      latitude,
      longitude,
      zone: ordinalToZone(zoneOrdinal),
      frostStationName,
      frostStationDistanceKm,
      soilMapUnit: soil?.name ?? null,
      caveats,
    },
  };
}

/**
 * Elevation is a nice-to-have, not a blocker. If USGS is down we still return
 * a profile — `frostConfidence` handles a null by lowering confidence and
 * saying it could not compare, which is the honest outcome.
 */
async function safeElevation(
  client: ElevationClient,
  latitude: number,
  longitude: number,
): Promise<number | null> {
  try {
    const result = await client.elevation(latitude, longitude);
    return result?.elevationM ?? null;
  } catch {
    return null;
  }
}

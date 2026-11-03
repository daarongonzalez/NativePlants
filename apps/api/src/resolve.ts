import type { Database, Owner } from "@np/db";
import { createSiteProfile, findNearestStation, findSoilAtPoint, lookupZoneByZip, setSiteLocation } from "@np/db";
import {
  SUN_EXPOSURE_LABELS,
  frostConfidence,
  openSkySunHours,
  soilConfidence,
  summarizeTopsoil,
  sunHoursFromExposure,
  zoneConfidence,
  type SunExposure,
} from "@np/engine";
import type { ElevationClient, GeocodeClient } from "@np/sources";
import { ordinalToZone } from "@np/shared";

/**
 * The resolve pipeline: an address in, a profile snapshot out.
 *
 * Sources are injected rather than imported so this is testable without
 * network access, and so a source outage is a swap at one seam.
 *
 * Resolves zone, frost, soil and sun. Sun is modelled from latitude unless the
 * gardener says how sunny the spot is, in which case their word wins.
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
  options: { sunExposure?: SunExposure } = {},
): Promise<ResolveOutcome> {
  const { db, geocoder, elevation } = deps;
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

  const assembled = await assembleProfile(
    { db, elevation },
    { latitude, longitude, zip, matchQuality },
    options,
  );
  if (!assembled.ok) return assembled;
  const { values, provenance: assembledProvenance, caveats: assembledCaveats, detail } = assembled;
  Object.assign(provenance, assembledProvenance);
  caveats.push(...assembledCaveats);

  const profile = await createSiteProfile(db, owner, site.id, { ...values, provenance });

  if (!profile) return { ok: false, reason: "site_not_found" };

  return {
    ok: true,
    profileId: profile.id,
    summary: {
      matchedAddress,
      latitude,
      longitude,
      zone: ordinalToZone(values.zoneOrdinal),
      frostStationName: detail.frostStation?.name ?? null,
      frostStationDistanceKm: detail.frostStation?.distanceKm ?? null,
      soilMapUnit: detail.soil?.name ?? null,
      caveats,
    },
  };
}

/** Profile values as stored on a snapshot, without provenance. */
export interface ProfileValues {
  zoneOrdinal: number;
  frostStationId: string | null;
  mukey: string | null;
  ph: number | null;
  sandPct: number | null;
  siltPct: number | null;
  clayPct: number | null;
  drainageClass: string | null;
  sunHoursSummer: number;
}

/** What the report screen shows beyond the stored values. */
export interface ProfileDetail {
  frostStation: {
    name: string;
    distanceKm: number;
    normalsPeriod: string;
    lastSpringP10: string;
    lastSpringP50: string;
    lastSpringP90: string;
    firstFallP10: string;
    firstFallP50: string;
    firstFallP90: string;
    frostFreeDays: number;
  } | null;
  soil: {
    name: string;
    surveyArea: string;
    measured: boolean;
    horizons: { depthTopCm: number; depthBottomCm: number; ph: number | null; sandPct: number | null; siltPct: number | null; clayPct: number | null }[];
  } | null;
}

export type AssembleOutcome =
  | { ok: true; values: ProfileValues; provenance: ProvenanceMap; caveats: string[]; detail: ProfileDetail }
  | { ok: false; reason: "zone_unavailable" };

/**
 * Zone, frost, soil and sun for a point. Reads reference data only and writes
 * nothing, so it serves both a saved site and a visitor who has not signed in.
 */
export async function assembleProfile(
  deps: { db: Database; elevation: ElevationClient },
  place: { latitude: number; longitude: number; zip: string | null; matchQuality: string },
  options: { sunExposure?: SunExposure } = {},
): Promise<AssembleOutcome> {
  const { db, elevation } = deps;
  const { latitude, longitude, zip, matchQuality } = place;
  const retrievedAt = new Date().toISOString();
  const provenance: ProvenanceMap = {};
  const caveats: string[] = [];

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

  // 5. Sun. The gardener can see the spot; the model can only see the sky.
  let sunHoursSummer: number;
  if (options.sunExposure) {
    sunHoursSummer = sunHoursFromExposure(options.sunExposure);
    provenance["sunHoursSummer"] = {
      source: "user_reported",
      confidence: "medium",
      retrievedAt,
      note: `You told us this spot gets ${SUN_EXPOSURE_LABELS[options.sunExposure]}.`,
    };
  } else {
    sunHoursSummer = openSkySunHours(latitude);
    provenance["sunHoursSummer"] = {
      source: "solar_geometry",
      confidence: "low",
      retrievedAt,
      note: "Calculated from your latitude for the longest day of the year, assuming nothing shades the spot. Trees, buildings and hills will reduce it.",
    };
    caveats.push(
      "We calculated sun from your latitude, so it assumes nothing shades your yard. Tell us how sunny the spot really is for better matches.",
    );
  }

  return {
    ok: true,
    values: {
      zoneOrdinal,
      frostStationId,
      mukey: hasSoilData ? soil!.mukey : null,
      ph: topsoil?.ph ?? null,
      sandPct: topsoil?.sandPct ?? null,
      siltPct: topsoil?.siltPct ?? null,
      clayPct: topsoil?.clayPct ?? null,
      drainageClass: hasSoilData ? (soil!.drainageClass ?? null) : null,
      sunHoursSummer,
    },
    provenance,
    caveats,
    detail: {
      frostStation:
        station && frostStationDistanceKm !== null
          ? {
              name: station.name,
              distanceKm: frostStationDistanceKm,
              normalsPeriod: station.frost.normalsPeriod,
              lastSpringP10: station.frost.lastSpringP10,
              lastSpringP50: station.frost.lastSpringP50,
              lastSpringP90: station.frost.lastSpringP90,
              firstFallP10: station.frost.firstFallP10,
              firstFallP50: station.frost.firstFallP50,
              firstFallP90: station.frost.firstFallP90,
              frostFreeDays: station.frost.frostFreeDays,
            }
          : null,
      soil: soil
        ? {
            name: soil.name,
            surveyArea: soil.surveyArea,
            measured: hasSoilData,
            horizons: soil.horizons.map((h) => ({
              depthTopCm: h.depthTopCm,
              depthBottomCm: h.depthBottomCm,
              ph: h.ph,
              sandPct: h.sandPct,
              siltPct: h.siltPct,
              clayPct: h.clayPct,
            })),
          }
        : null,
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

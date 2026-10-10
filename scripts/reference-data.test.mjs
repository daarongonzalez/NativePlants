import { test } from "node:test";
import assert from "node:assert/strict";
import {
  candidateStations,
  parseGhcndStations,
  renderZipsModule,
  selectZctas,
  zipsFromModule,
} from "./lib/reference-data.mjs";

// Real ghcnd-stations.txt layout: fixed-width columns.
const station = (id, lat, lon, elev, state, name) =>
  `${id.padEnd(11)} ${lat.toFixed(4).padStart(8)} ${lon.toFixed(4).padStart(9)} ${elev
    .toFixed(1)
    .padStart(6)} ${state.padEnd(2)} ${name}`;

const INVENTORY = [
  station("USW00024127", 40.7781, -111.9694, 1287.8, "UT", "SALT LAKE CITY INTL AP"),
  station("USC00423838", 40.4900, -111.4000, 1700.0, "UT", "HEBER"),
  station("USC00420001", 38.0, -111.0, 1500.0, "UT", "TOO FAR SOUTH"),
  station("USC00100001", 40.7, -111.9, 1300.0, "ID", "WRONG STATE"),
  station("ASN00001234", 40.7, -111.9, 1300.0, "UT", "NOT A US ID"),
].join("\n");

test("parses fixed-width station rows into the right fields", () => {
  const [slc] = parseGhcndStations(INVENTORY);
  assert.equal(slc.id, "USW00024127");
  assert.equal(slc.latitude, 40.7781);
  assert.equal(slc.longitude, -111.9694);
  assert.equal(slc.elevationM, 1287.8);
  assert.equal(slc.state, "UT");
  assert.equal(slc.name, "SALT LAKE CITY INTL AP");
});

test("keeps only Utah US-prefixed stations inside the box", () => {
  const ids = candidateStations(parseGhcndStations(INVENTORY)).map((s) => s.id);
  assert.deepEqual(ids, ["USC00423838", "USW00024127"]);
});

const HEADER = "GEOID_ZCTA5_20|GEOID_COUNTY_20|AREALAND_ZCTA5_20|AREALAND_PART";
const ZCTA_FILE = [
  HEADER,
  "84101|49035|1000|1000", // wholly in Salt Lake
  "84062|49049|2000|1500", // mostly in Utah County
  "84062|49043|2000|500", // remainder in Summit, ignored
  "84060|49043|5000|400", // Summit County only, no market land at all
  "84080|49035|1000|50", // clips the edge of Salt Lake: 5%
  "84080|49045|1000|950", // mostly in Tooele
].join("\n");

test("keeps ZCTAs with enough land inside the market counties", () => {
  assert.deepEqual(selectZctas(ZCTA_FILE), ["84062", "84101"]);
});

test("a straddling ZCTA counts all of its market counties together", () => {
  const file = [HEADER, "84999|49035|1000|60", "84999|49011|1000|60", "84999|49043|1000|880"].join("\n");
  assert.deepEqual(selectZctas(file), ["84999"]);
});

test("throws when the Census file loses an expected column", () => {
  assert.throws(() => selectZctas("GEOID_ZCTA5_20|SOMETHING_ELSE\n84101|x"), /missing expected columns/);
});

test("the rendered module round-trips through zipsFromModule", () => {
  const zips = ["84003", "84004", "84101"];
  assert.deepEqual(zipsFromModule(renderZipsModule(zips)), zips);
});

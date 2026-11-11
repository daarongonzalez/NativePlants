import { Link } from "react-router";
import type { Route } from "./+types/about";
import tree from "../../../../design/nativo/assets/Tree/tree-01-green.svg?url";
import { LAUNCH_COUNTIES, LAUNCH_REGION, PLANT_REVIEWER, CONTACT_EMAIL } from "../content/site";
import { UTAH } from "../content/rebates";
import { DraftBadge, Fact, PageHead, Placeholder } from "../components/site/Content";
import { PageShell } from "../components/site/SiteChrome";
import { Window } from "../components/landing/primitives";
import { formatDate } from "../lib/flow";
import { pageMeta } from "../lib/meta";

/** Flip to false once the founder story and the reviewer are confirmed. */
const DRAFT = true;

export function meta(_: Route.MetaArgs) {
  return pageMeta({
    title: "About Nativo",
    description:
      "Who makes Nativo, who reviews the plants, where every number comes from, and how often we check it again.",
    draft: DRAFT,
  });
}

/** Every data source the site shows, and how often it is checked. Matches the source labels on the report. */
const SOURCES = [
  {
    what: "Soil pH, texture and drainage",
    source: "USDA NRCS county soil surveys (SSURGO)",
    url: "https://www.nrcs.usda.gov/resources/data-and-reports/soil-survey-geographic-database-ssurgo",
    cadence: "The survey is updated each year. We reload it when it is.",
  },
  {
    what: "Hardiness zone",
    source: "USDA Plant Hardiness Zone Map, 2023",
    url: "https://planthardiness.ars.usda.gov/",
    cadence: "Published about once a decade.",
  },
  {
    what: "Frost dates",
    source: "NOAA NCEI U.S. Climate Normals, 1991 to 2020",
    url: "https://www.ncei.noaa.gov/products/land-based-station/us-climate-normals",
    cadence: "Published every ten years.",
  },
  {
    what: "Lot outline, building size, year built",
    source: "County parcel records, published by the Utah Geospatial Resource Center",
    url: "https://gis.utah.gov/products/sgid/cadastre/parcels/",
    cadence: "Counties update them once a year, after the tax roll. Looked up live for each address.",
  },
  {
    what: "Building outlines",
    source: "Microsoft building footprints, via the Utah Geospatial Resource Center",
    url: "https://gis.utah.gov/products/sgid/location/building-footprints/",
    cadence: "Traced from 2018 imagery, and lined up with the newer photo for each lot.",
  },
  {
    what: "Planted and bare ground",
    source: "USDA National Agriculture Imagery Program aerial photo, via the US Geological Survey",
    url: "https://imagery.nationalmap.gov/arcgis/rest/services/USGSNAIPPlus/ImageServer",
    cadence: "Flown every two to three years. Read live for each address; its infrared shows what is growing.",
  },
  {
    what: "Elevation, for frost",
    source: "US Geological Survey elevation service",
    url: "https://apps.nationalmap.gov/epqs/",
    cadence: "Looked up live for each address.",
  },
  {
    what: "Address to location",
    source: "US Census Bureau geocoder",
    url: "https://geocoding.geo.census.gov/",
    cadence: "Looked up live for each address.",
  },
  {
    what: "Summer sun",
    source: "Calculated from your latitude",
    url: null,
    cadence: "Worked out fresh for each address, and marked as modelled.",
  },
  {
    what: "Rebate rules (Utah)",
    source: UTAH.program.name,
    url: UTAH.program.sourceUrl,
    cadence: `Checked by hand. Last checked ${formatDate(UTAH.program.verifiedAt)}.`,
  },
];

export default function About() {
  return (
    <PageShell>
      <PageHead
        badge="About"
        title={
          <>
            Honest numbers for <span className="lp-accent">the ground you've got</span>
          </>
        }
        lead="Nativo turns what is knowable about a patch of ground into a planting plan, and checks that plan against the rebate that could pay for it."
      >
        {DRAFT && <DraftBadge />}
      </PageHead>

      <div className="ct-layout">
        <div className="ct-prose">
          <h2 id="why">Why we built it</h2>
          <p>
            Most plant advice is written for everywhere, which means it is right for nowhere in particular. A yard has a
            specific soil, a specific winter and a specific amount of sun. Water providers will pay people to swap thirsty
            lawn for plants that suit those conditions, but the rules are long and easy to trip over.
          </p>
          <p>
            Nativo puts the two together. Enter an address and you see your ground, plants that belong there, and a plan
            checked against the rebate rules as you draw it.
          </p>
          <p>
            <Placeholder>
              A short founder story to confirm: who started Nativo, and why. Two or three sentences in your own words.
            </Placeholder>
          </p>

          <h2 id="where">Where we work</h2>
          <p>
            We are starting with {LAUNCH_REGION}: {LAUNCH_COUNTIES} in Utah. We go deep in one region at a time, because
            good advice depends on local soil maps, local weather records and plants a local expert has checked. More
            regions will follow. Utah is our first example, not our only one.
          </p>

          <h2 id="plants">Who checks the plants</h2>
          <p>
            Every plant's details, from its grown size to the soil it tolerates, are checked by a horticultural reviewer
            before they are published.{" "}
            {PLANT_REVIEWER ? (
              <>
                Our reviewer is <strong>{PLANT_REVIEWER.name}</strong>, {PLANT_REVIEWER.credentials}.
              </>
            ) : (
              <Placeholder>Reviewer's name and credentials to confirm.</Placeholder>
            )}{" "}
            Until a plant is reviewed, the planner labels it as a draft.
          </p>

          <h2 id="principles">How we work</h2>
          <ul>
            <li>Every number shows where it came from, and how sure we are of it.</li>
            <li>We say when we do not know. A gap is better than a guess.</li>
            <li>We never promise a rebate. Only the program can approve a project.</li>
            <li>We do not save your address, and you do not need an account.</li>
          </ul>
        </div>
        <aside className="ct-aside">
          <div className="lp-note lp-note--peach ct-note ct-note--right">
            <span className="lp-note__kicker">GET IN TOUCH</span>
            <p>
              Spotted something wrong, or want Nativo in your region? Write to <Fact value={CONTACT_EMAIL} missing="contact email to confirm" />.
            </p>
          </div>
          <img src={tree} alt="" className="ct-aside__art" />
        </aside>
      </div>

      <section id="sources" aria-labelledby="sources-title" className="ct-head ct-anchor">
        <h2 id="sources-title" className="lp-h2 lp-h2--green">
          Where every number comes from
        </h2>
        <p className="lp-body-lg">Public data, named on every value you see, and checked again on a schedule.</p>
      </section>

      <Window label="sources · data register" tone="paper" size="lg" className="ct-register">
        <table className="ct-table">
          <thead>
            <tr>
              <th scope="col">What</th>
              <th scope="col">Source</th>
              <th scope="col">How often it is checked</th>
            </tr>
          </thead>
          <tbody>
            {SOURCES.map((s) => (
              <tr key={s.what}>
                <th scope="row">{s.what}</th>
                <td>
                  {s.url ? (
                    <a href={s.url} rel="noopener noreferrer">
                      {s.source}
                    </a>
                  ) : (
                    s.source
                  )}
                </td>
                <td>{s.cadence}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Window>
      <p className="lp-body-sm">
        Read how we handle your information in our <Link to="/privacy">privacy policy</Link>.
      </p>
    </PageShell>
  );
}

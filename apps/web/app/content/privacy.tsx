import { Link } from "react-router";
import { Fact, Placeholder } from "../components/site/Content";
import { LEGAL_NAME, CONTACT_EMAIL } from "./site";
import type { PolicyPage } from "./types";

/**
 * DRAFT for legal review. Written to match what the code does on
 * 8 November 2026. If the code changes what it collects (plan by email, for
 * one), this page must change in the same pull request.
 */
export const PRIVACY: PolicyPage = {
  title: "Privacy policy",
  description: "What Nativo collects, why, who else sees it and how long it is kept. In plain language.",
  updated: "2026-11-11",
  draft: true,
  intro: (
    <p>
      Nativo is run by <Fact value={LEGAL_NAME} missing="legal business name to confirm" />. You give us a home address to use Nativo, and we take
      that seriously. This page says what we collect, why, who else sees it and how long we keep it. The short version:
      we do not save your address, we do not sell anything, and you do not need an account.
    </p>
  ),
  sections: [
    {
      id: "what-we-collect",
      heading: "What we collect, and what we do not",
      body: (
        <>
          <h3>Your address</h3>
          <p>
            When you enter an address, we send it to an address lookup service to find its location (latitude and
            longitude) and ZIP code. We do not store your address in our database. To move between pages without an
            account, the matched address and location travel in the web address of each page, for example{" "}
            <span className="np-value">/report?address=…</span>. That means they can appear in your browser history, and in
            the short-term request logs our hosting provider keeps (see below).
          </p>
          <h3>Your plans</h3>
          <p>
            When you press “Check my plan”, we save the shape of the plan (its size, the materials and plants in each 5 ft
            square), the result of the check and your ZIP code. We use this to see which rules people find hardest and to
            improve the check. We do not store your street address, your name or your email with it.
          </p>
          <h3>Your plant list</h3>
          <p>
            Your plant list is stored in your own browser, on your own device, using its local storage. It never reaches
            our servers. Clearing your browser data deletes it.
          </p>
          <h3>Your yard estimate</h3>
          <p>
            To estimate your yard, we look up the lot at your location in public county records and measure it on a public
            aerial photo. We do not save the estimate. The figures you choose (which part of the yard, how much lawn) travel
            in the web address to the planner, the same way your address does.
          </p>
          <h3>What we do not collect</h3>
          <ul>
            <li>No accounts, passwords or sign-in.</li>
            <li>No photos.</li>
            <li>No advertising or tracking cookies, and no analytics that follow you across sites.</li>
            <li>No payment details.</li>
          </ul>
        </>
      ),
    },
    {
      id: "who-else",
      heading: "Who else sees your information",
      body: (
        <>
          <p>We use a small number of services to run Nativo. Each one sees only what it needs:</p>
          <ul>
            <li>
              <strong>US Census Bureau geocoder:</strong> receives the address you type, and returns its location.
            </li>
            <li>
              <strong>US Geological Survey elevation service:</strong> receives the location (not the address), and returns
              its elevation, which affects frost dates.
            </li>
            <li>
              <strong>Utah Geospatial Resource Center (UGRC):</strong> its county lot records and building outlines are
              hosted on Esri's ArcGIS Online. To find your lot, they receive the location and the matched street address,
              and return the lot's outline and its public tax-roll details. We use only the outline, building size, floors
              and year built.
            </li>
            <li>
              <strong>US Geological Survey aerial photo service:</strong> receives the map coordinates around your lot, and
              returns the photo we measure. Your browser also loads the photo shown on the report directly from this service.
            </li>
            <li>
              <strong>Cloudflare:</strong> hosts the site. Like any web host, it handles every request, including the web
              address of each page, and keeps short-term logs to keep the service running and secure.
            </li>
            <li>
              <strong>Neon:</strong> hosts our database, which holds the plan checks described above and our public
              reference data.
            </li>
            <li>
              <strong>Google Fonts:</strong> serves the typefaces the site uses. Your browser asks Google for them, which
              shares your IP address with Google.
            </li>
          </ul>
          <p>We do not sell or rent your information, and we do not share it for advertising.</p>
        </>
      ),
    },
    {
      id: "how-long",
      heading: "How long we keep it",
      body: (
        <ul>
          <li>Your address: not kept by us.</li>
          <li>
            Plan checks: kept while Nativo runs, because they help us report how plans fare against the rules. They hold
            no street address or contact details. <Placeholder>Retention period to confirm.</Placeholder>
          </li>
          <li>
            Hosting logs: kept by Cloudflare for a short period. <Placeholder>Log retention to confirm.</Placeholder>
          </li>
          <li>Your plant list: kept in your browser until you clear it.</li>
        </ul>
      ),
    },
    {
      id: "email",
      heading: "If you ask us to email your plan",
      body: (
        <p>
          We are adding a way to send your plan to your inbox. That will mean collecting an email address. Before it goes
          live, this section will say exactly what we keep, which service sends the email, how follow-up emails work and
          how to unsubscribe. We will not send you anything you have not asked for.
        </p>
      ),
    },
    {
      id: "children",
      heading: "Children",
      body: <p>Nativo is meant for adults planning their own yards. We do not knowingly collect information from children under 13.</p>,
    },
    {
      id: "your-choices",
      heading: "Your choices",
      body: (
        <>
          <p>
            Because we do not store addresses or accounts, there is usually nothing personal of yours on our servers to
            access or delete. You can delete your plant list at any time from the <Link to="/list">plant list page</Link>,
            or by clearing your browser data.
          </p>
          <p>
            If you have a question or a request, write to <Fact value={CONTACT_EMAIL} missing="contact email to confirm" />. Depending on where
            you live, you may have further rights under local privacy law. We will honour them.
          </p>
        </>
      ),
    },
    {
      id: "changes",
      heading: "Changes to this policy",
      body: (
        <p>
          When what we collect changes, this page changes first, with a new date at the top. If a change is significant,
          we will say so on the home page.
        </p>
      ),
    },
  ],
};

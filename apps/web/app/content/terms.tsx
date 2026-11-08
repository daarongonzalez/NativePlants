import { Link } from "react-router";
import { Fact, Placeholder } from "../components/site/Content";
import { GOVERNING_STATE, LEGAL_NAME, CONTACT_EMAIL } from "./site";
import type { PolicyPage } from "./types";

/** DRAFT for legal review. Plain language on purpose; a lawyer should check every section. */
export const TERMS: PolicyPage = {
  title: "Terms of use",
  description: "The terms for using Nativo: what it is, what it is not, and what we each agree to.",
  updated: "2026-11-08",
  draft: true,
  intro: (
    <p>
      These terms cover your use of Nativo, run by <Fact value={LEGAL_NAME} missing="legal business name to confirm" />. By using the site, you agree
      to them. We have kept them short and plain. If anything is unclear, ask us.
    </p>
  ),
  sections: [
    {
      id: "what-nativo-is",
      heading: "What Nativo is",
      body: (
        <p>
          Nativo is a free planning tool. It describes the ground at an address using public soil and climate data,
          suggests native plants, and checks a planting plan against the published rules of a lawn rebate program. It is
          a guide to help you plan. It is not professional landscaping, legal, tax or financial advice.
        </p>
      ),
    },
    {
      id: "rebates",
      heading: "Rebates are decided by the program, not by us",
      body: (
        <>
          <p>
            Nativo is not part of any water provider or rebate program. Only the program can approve a project or a
            payment. Our check covers the rules we can measure from your plan. It marks the rest as things you or the
            program's inspector must confirm, and it never marks those as passed.
          </p>
          <p>
            Programs change their rules, rates and deadlines. We show the date we last checked each one. Always confirm
            the current terms with your program before you start work or spend money.
          </p>
        </>
      ),
    },
    {
      id: "accuracy",
      heading: "How accurate the information is",
      body: (
        <>
          <p>
            We use the best public data we can find and say where every number comes from. But public data maps areas,
            not single yards. Soil can change within a block, frost dates are probabilities and sun hours are calculated,
            not measured. Plant cover is an estimate based on each plant's grown size.
          </p>
          <p>
            We do not promise that the information is complete, current or right for your yard. Check anything important
            before you rely on it, and tell us at <Fact value={CONTACT_EMAIL} missing="contact email to confirm" /> if something looks wrong.
          </p>
        </>
      ),
    },
    {
      id: "plants",
      heading: "Plants, safety and your property",
      body: (
        <>
          <p>
            Some plants are toxic if eaten, and some can cause skin reactions. Check any plant before you plant it near
            pets or children. Before you dig, call 811 or your local utility locating service to have buried lines marked.
            Follow your city code and any HOA rules that lawfully apply to you.
          </p>
          <p>You are responsible for the work done on your property and for how it is done.</p>
        </>
      ),
    },
    {
      id: "use",
      heading: "Using the site fairly",
      body: (
        <ul>
          <li>Use Nativo for your own planning, or to help someone plan theirs.</li>
          <li>Do not try to overload, break into or scrape the site or its data services.</li>
          <li>Do not use automated tools to send large numbers of requests.</li>
          <li>Do not use the site to break the law or to harm anyone.</li>
        </ul>
      ),
    },
    {
      id: "ours",
      heading: "What belongs to whom",
      body: (
        <p>
          The Nativo name, design, writing and software belong to us. Public data we use belongs to its publishers and is
          credited where it appears. Your plans are yours. You give us permission to keep the plan checks described in our{" "}
          <Link to="/privacy">privacy policy</Link> and to use them, without any street address, to improve Nativo and to
          report how plans fare against the rules.
        </p>
      ),
    },
    {
      id: "liability",
      heading: "Our responsibility to you",
      body: (
        <>
          <p>
            Nativo is provided “as is”. To the extent the law allows, we are not responsible for losses that come from using
            it, including a rebate that is refused, plants that fail, or costs you take on because of information on the
            site.
          </p>
          <p>
            Nothing in these terms limits rights you have under consumer law that cannot be limited.{" "}
            <Placeholder>Liability wording to confirm with counsel.</Placeholder>
          </p>
        </>
      ),
    },
    {
      id: "changes",
      heading: "Changes, and the law that applies",
      body: (
        <>
          <p>
            We may update these terms as Nativo grows. The date at the top shows the latest version. If you keep using the
            site after a change, the new terms apply.
          </p>
          <p>
            These terms are governed by the laws of <Fact value={GOVERNING_STATE} missing="governing state to confirm" />.
          </p>
        </>
      ),
    },
    {
      id: "contact",
      heading: "Contact",
      body: (
        <p>
          Questions about these terms: <Fact value={CONTACT_EMAIL} missing="contact email to confirm" />.
        </p>
      ),
    },
  ],
};

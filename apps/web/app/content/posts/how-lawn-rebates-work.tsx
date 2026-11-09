import { Link } from "react-router";
import { UTAH, blackoutText, exampleAmount, rateText, ruleByCode } from "../rebates";
import type { Post } from "../types";

const ut = UTAH.program;
const blackout = blackoutText(ut);
const example = exampleAmount(ut, 500);
const visitRule = ruleByCode(ut, "E3");

export const howLawnRebatesWork: Post = {
  slug: "how-lawn-rebates-work",
  title: "How lawn rebates work, step by step",
  description:
    "Many water providers pay homeowners to replace lawn with water-wise plants. Here is how these programs usually run, from application to payment, using Utah's program as the worked example.",
  tag: "Rebates",
  published: "2026-11-08",
  updated: "2026-11-08",
  draft: true,
  readingMinutes: 6,
  shortAnswer: [
    "A lawn rebate pays you by the square foot to replace grass with water-wise plants, mulch and drip irrigation.",
    "Most programs need approval before you dig. Work started early is usually not paid for.",
    "Expect five stages: apply, a first site visit, the work itself, a final inspection, then payment.",
    `In Utah, the ${ut.name} pays ${rateText(ut)} for at least ${ut.minAreaSqft} sq ft, finished within ${ut.completionMonths} months.`,
  ],
  sections: [
    {
      id: "what-it-is",
      heading: "What a lawn rebate is",
      body: (
        <>
          <p>
            Lawns drink more water than almost anything else around a home, and in dry places most of a household's water
            goes outdoors. Many cities and water providers have worked out that paying people to remove grass costs less
            than finding new water. So they offer a rebate: a set amount for every square foot of lawn you replace with
            plants that need far less.
          </p>
          <p>
            The details change from place to place, but the shape is nearly always the same. You plan the new area, get
            approval, do the work, pass an inspection and then get paid. The rules exist to make sure the water savings are
            real, so most of them are about what replaces the lawn and how it is watered.
          </p>
          <p>
            We use Utah's program as the example throughout, because it is the one Nativo's planner checks today. If you
            live somewhere else, look for the same steps on your water provider's website.
          </p>
        </>
      ),
    },
    {
      id: "step-1",
      heading: "Step 1: Check you qualify",
      body: (
        <>
          <p>Before anything else, find out three things:</p>
          <ul>
            <li>
              <strong>Does your water provider take part?</strong> Many programs are run by a state or regional body and
              offered through local suppliers. If yours does not take part, you may not be eligible.
            </li>
            <li>
              <strong>Is your project big enough?</strong> Most programs set a minimum. Utah's is{" "}
              <span className="np-value">{ut.minAreaSqft} sq ft</span>, and several smaller areas can be added together.
            </li>
            <li>
              <strong>Is the lawn still alive?</strong> Programs pay to replace living, watered lawn. If you let it die or
              dig it up first, there may be nothing left to pay for.
            </li>
          </ul>
        </>
      ),
    },
    {
      id: "step-2",
      heading: "Step 2: Plan the new area and apply",
      body: (
        <>
          <p>
            The application usually asks for photos of the lawn as it is now, a simple drawing of the new layout seen from
            above, and a short description of what will replace the grass. You do not need a professional designer. A
            clear, measured sketch is enough for most programs.
          </p>
          <p>
            This is the stage where a plan earns its keep. The rules about plant cover, hardscape and leftover lawn are much
            easier to meet on paper than to fix after the plants are in. Nativo's{" "}
            <Link to="/plan">plot planner</Link> checks a layout against the rules it can measure as you draw it.
          </p>
        </>
      ),
    },
    {
      id: "step-3",
      heading: "Step 3: Wait for the site visit and approval",
      body: (
        <>
          <p>
            Most programs send someone to look at the lawn before you start. They confirm the size, check the lawn is
            alive, and approve the plan. This is the step people most often skip, and it is the most expensive one to skip.
          </p>
          {visitRule && (
            <blockquote>
              In Utah's words: “{visitRule.sourceText}”{" "}
              <span className="np-value">({visitRule.code})</span>
            </blockquote>
          )}
        </>
      ),
    },
    {
      id: "step-4",
      heading: "Step 4: Do the work",
      body: (
        <>
          <p>Once you are approved, the clock usually starts. The work tends to fall into four parts:</p>
          <ol>
            <li>Remove the grass, by digging it out or by smothering it.</li>
            <li>Lay drip irrigation, on its own zone, separate from any sprinklers.</li>
            <li>Plant, spacing each plant for its full grown size.</li>
            <li>Cover the bare ground with mulch.</li>
          </ol>
          <p>
            Utah gives you <span className="np-value">{ut.completionMonths} months</span> from the first visit to finish.
            {blackout
              ? ` In places with secondary irrigation water, inspections usually stop from ${blackout}, so a project approved in late summer may need to finish before mid-October or wait until spring.`
              : ""}
          </p>
        </>
      ),
    },
    {
      id: "step-5",
      heading: "Step 5: The final inspection",
      body: (
        <>
          <p>
            An inspector checks the finished area against the rules: enough plant cover when the plants are grown, the
            right kind of drip, filters and pressure reducers you can reach, mulch at the right depth, and no leaks. If
            something fails, programs usually give you time to fix it. Utah allows{" "}
            <span className="np-value">{ut.correctionDays} days</span>, or the rest of your {ut.completionMonths} months if
            that is longer.
          </p>
        </>
      ),
    },
    {
      id: "step-6",
      heading: "Step 6: Paperwork and payment",
      body: (
        <>
          <p>
            After the project passes, there is usually a short agreement to sign and a tax form, because the rebate is a
            payment to you. In Utah, the payment goes to the property owner only.
          </p>
          <p>
            How much? At Utah's rate of {rateText(ut)}, a 500 sq ft front lawn would come to about{" "}
            <span className="np-value">${example?.toLocaleString("en-US")}</span>. Rates and caps can differ by local water
            supplier, so confirm yours before you budget.
          </p>
        </>
      ),
    },
    {
      id: "mistakes",
      heading: "The mistakes that cost people the rebate",
      body: (
        <ul>
          <li>Starting work before the site visit and approval.</li>
          <li>Letting the lawn die, or removing it, before the first visit.</li>
          <li>Leaving strips of lawn too narrow to keep. Utah does not allow any lawn under 8 ft wide.</li>
          <li>Planting too sparsely to reach the plant cover rule once everything is grown.</li>
          <li>Using sprays, bubblers or soaker hoses instead of drip.</li>
          <li>Missing the inspection season and running out of time.</li>
        </ul>
      ),
    },
  ],
  faqs: [
    {
      q: "Do I have to apply before I remove my lawn?",
      a: "Almost always, yes. Most programs, including Utah's, need a site visit and approval before any work starts, and work started early is not paid for.",
    },
    {
      q: "Can I do the work myself?",
      a: "Usually, yes. Most programs pay for the result, not for who did the work, as long as every rule is met at the final inspection. Check your program's terms.",
    },
    {
      q: "Is the rebate taxable?",
      a: "Programs often ask for a tax form before paying, because the rebate is a payment to you. Whether it is taxable depends on your situation, so ask a tax professional.",
    },
  ],
  sources: [
    { label: `${ut.name}, ${ut.utilityName}`, url: ut.sourceUrl, checked: ut.verifiedAt },
  ],
};

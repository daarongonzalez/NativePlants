import { Link } from "react-router";
import { UTAH, ruleByCode } from "../rebates";
import type { Post } from "../types";

const ut = UTAH.program;
const coverRule = ruleByCode(ut, "C2");
const potRule = ruleByCode(ut, "C3");
const stripRule = ruleByCode(ut, "C10");

/** The worked example: Utah's minimum area at Utah's cover rule, with plants 3 ft wide when grown. */
const AREA = ut.minAreaSqft;
const NEEDED = Math.round((AREA * ut.minPlantCoveragePct) / 100);
const PLANT_WIDTH_FT = 3;
const FOOTPRINT = Math.PI * (PLANT_WIDTH_FT / 2) ** 2;
const PLANTS = Math.ceil(NEEDED / FOOTPRINT);

export const plantCoverRule: Post = {
  slug: "plant-cover-rule",
  title: "What counts as plant cover, and how to reach half",
  description:
    "Many lawn rebates ask for a share of the new area to be covered by plants once they are grown. Here is what counts, what does not, and how to work out how many plants you need, with Utah's 50% rule as the example.",
  tag: "Planning",
  published: "2026-11-08",
  updated: "2026-11-08",
  draft: true,
  readingMinutes: 5,
  shortAnswer: [
    "Plant cover is the share of the ground your plants will cover once they are fully grown, measured from above.",
    "Rebate programs set a minimum so a new area is a garden, not a gravel lot. Utah's is 50%.",
    "In Utah, tree canopy, annuals, bulbs and potted plants do not count. Perennials planted in the ground do.",
    `Plan by grown width: in a ${AREA} sq ft area, about ${PLANTS} plants that grow ${PLANT_WIDTH_FT} ft wide reach half.`,
  ],
  sections: [
    {
      id: "what-it-means",
      heading: "What plant cover means",
      body: (
        <>
          <p>
            Picture your new garden from above, ten years from now. Plant cover is the share of the ground hidden under
            leaves at that point. It is not what you see on planting day, when small plants sit in a sea of mulch. It is
            what the plants will cover once they reach their full width.
          </p>
          <p>
            Rebate programs use it to make sure the money goes to real gardens. Without a cover rule, a few shrubs in a
            yard of gravel would qualify, and gravel yards bake in summer and do little for bees and birds.
          </p>
          {coverRule && (
            <blockquote>
              Utah's rule: “{coverRule.sourceText}” <span className="np-value">({coverRule.code})</span>
            </blockquote>
          )}
        </>
      ),
    },
    {
      id: "what-counts",
      heading: "What counts, and what does not",
      body: (
        <>
          <p>Every program words this a little differently. Utah's rules are typical:</p>
          <ul>
            <li>
              <strong>Counts:</strong> perennials, shrubs and groundcovers planted straight into the ground.
            </li>
            <li>
              <strong>Does not count:</strong> tree canopy, annuals and bulbs. Trees are welcome, but the shade they cast
              is not plant cover.
            </li>
            <li>
              <strong>Does not count:</strong> potted plants. They are allowed, but they add nothing to the total.
            </li>
            <li>
              <strong>Does not count:</strong> mulch, rock, pavers and paths. They count towards the area converted, not
              towards the cover.
            </li>
          </ul>
          {potRule && (
            <p>
              In the program's words on pots: “{potRule.sourceText}” <span className="np-value">({potRule.code})</span>
            </p>
          )}
        </>
      ),
    },
    {
      id: "how-many",
      heading: "How many plants you need",
      body: (
        <>
          <p>The sum is simpler than it looks. Work in grown widths, not pot sizes.</p>
          <ol>
            <li>
              Find the area you are converting. Utah's minimum is <span className="np-value">{AREA} sq ft</span>.
            </li>
            <li>
              Work out the cover you need. Half of {AREA} sq ft is <span className="np-value">{NEEDED} sq ft</span>.
            </li>
            <li>
              Work out what one plant covers. A plant that grows {PLANT_WIDTH_FT} ft wide covers a circle of about{" "}
              <span className="np-value">{FOOTPRINT.toFixed(1)} sq ft</span>.
            </li>
            <li>
              Divide. {NEEDED} ÷ {FOOTPRINT.toFixed(1)} is about <span className="np-value">{PLANTS} plants</span>.
            </li>
          </ol>
          <p>
            Bigger plants mean fewer of them. A shrub that grows 5 ft wide covers nearly three times what a 3 ft perennial
            does. A mix of a few large shrubs and drifts of smaller perennials is usually cheaper than many small plants,
            and it looks more natural.
          </p>
          <p>
            Nativo's <Link to="/plan">plot planner</Link> does this sum for you. It spaces each plant at its grown width
            in 5 ft squares and shows your cover as you plant. It is an estimate, and the planner says so.
          </p>
        </>
      ),
    },
    {
      id: "park-strips",
      heading: "Park strips have one more rule",
      body: (
        <>
          <p>
            The strip between the sidewalk and the road needs plants that stay low, so drivers and people walking can see
            each other. Many programs set a height limit there.
          </p>
          {stripRule && (
            <blockquote>
              Utah's rule: “{stripRule.sourceText}” <span className="np-value">({stripRule.code})</span>
            </blockquote>
          )}
          <p>
            The planner marks plants that stay under 24 inches without pruning as “park strip safe”, so you can filter for
            them.
          </p>
        </>
      ),
    },
    {
      id: "tips",
      heading: "Tips for reaching cover without overplanting",
      body: (
        <ul>
          <li>Space plants for their grown size. Crowded plants compete for water and often fail.</li>
          <li>Use groundcovers to fill gaps between larger plants. They spread and count fully.</li>
          <li>Keep paths and seating to what you need. Hardscape adds area but no cover.</li>
          <li>Plan trees as a bonus, not as part of the cover sum.</li>
          <li>Check your total before you apply, not after you plant.</li>
        </ul>
      ),
    },
  ],
  faqs: [
    {
      q: "Is plant cover measured on planting day?",
      a: "No. Programs like Utah's measure cover at maturity, meaning what the plants will cover once fully grown. The inspector judges this from the plants and their spacing.",
    },
    {
      q: "Do trees count towards plant cover?",
      a: "Not in Utah's program, where tree canopy does not count. Trees are still allowed and welcome. Check your own program's rules.",
    },
    {
      q: "Does a native grass lawn count as plant cover?",
      a: "Not usually. Utah encourages swapping to a native or drought-tolerant lawn, but does not pay for it. A new lawn is not counted as a converted area.",
    },
  ],
  sources: [{ label: `${ut.name}, ${ut.utilityName}`, url: ut.sourceUrl, checked: ut.verifiedAt }],
};

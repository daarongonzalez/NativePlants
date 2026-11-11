/**
 * The FAQ. Rebate answers are built from the rules file the plan check uses,
 * so a rule change updates the answer too. Answers are plain text, because
 * they also go into FAQ markup for search and answer engines.
 */
import { LAUNCH_COUNTIES, LAUNCH_REGION } from "./site";
import { UTAH, blackoutText, rateText, ruleByCode } from "./rebates";
import type { Faq } from "./types";

const ut = UTAH.program;
const blackout = blackoutText(ut);
const plain = (code: string) => ruleByCode(ut, code)?.plainText ?? "";

export interface FaqGroup {
  id: string;
  title: string;
  items: Faq[];
}

export const FAQ_GROUPS: FaqGroup[] = [
  {
    id: "nativo",
    title: "Using Nativo",
    items: [
      {
        q: "What does Nativo do?",
        a: "You enter a street address. Nativo looks up the soil, hardiness zone, frost dates and summer sun for that spot, suggests native plants that suit it, and checks a planting plan against your lawn rebate program's rules.",
      },
      {
        q: "Where does Nativo work?",
        a: `Today, ${LAUNCH_REGION}: ${LAUNCH_COUNTIES} in Utah. The soil, climate and plant data is built one region at a time, and more regions will follow. Utah is our first example, not our only one.`,
      },
      {
        q: "Does it cost anything?",
        a: "No. Looking up your ground, planning a yard and checking it against the rebate rules is free, and you do not need an account.",
      },
      {
        q: "Do I need an account?",
        a: "No. Your plant list is kept in your own browser, on your own device. If you clear your browser data or switch devices, the list will not follow you yet.",
      },
      {
        q: "Can Nativo apply for the rebate for me?",
        a: "Not yet. Nativo helps you plan an area that meets the rules and shows you what each stage asks for. You apply through your water provider's program.",
      },
    ],
  },
  {
    id: "rebates",
    title: "Lawn rebates, with Utah as the example",
    items: [
      {
        q: "What is a lawn rebate?",
        a: "A payment from a water provider for replacing lawn with water-wise plants, mulch and drip irrigation, usually set per square foot. Many providers in dry regions offer one. The rules differ by place but follow the same steps: apply, a site visit, the work, a final inspection, then payment.",
      },
      {
        q: "How much does Utah's program pay?",
        a: `The ${ut.name} pays ${rateText(ut)} of lawn converted. ${ut.amountNote ?? ""}`.trim(),
      },
      {
        q: "How big does my project need to be?",
        a: `In Utah, at least ${ut.minAreaSqft} sq ft. ${plain("E6")}`,
      },
      {
        q: "Can I start work before I'm approved?",
        a: `No. ${plain("E3")}`,
      },
      {
        q: "Should I let my lawn die first, to save water?",
        a: `No. ${plain("E2")}`,
      },
      {
        q: "How much of the new area needs plants?",
        a: `In Utah, at least ${ut.minPlantCoveragePct}% plant cover once the plants are grown. ${plain("C2")}`,
      },
      {
        q: "Can I keep some lawn?",
        a: `Yes, in Utah, as long as it is wide enough. ${plain("C1")}`,
      },
      {
        q: "What kind of watering is allowed?",
        a: `${plain("C5")} ${plain("C9")}`,
      },
      {
        q: "How long do I have to finish?",
        a: `${ut.completionMonths} months from the first site visit in Utah.${blackout ? ` In places with secondary irrigation water, inspections usually stop from ${blackout}, so plan around that.` : ""}`,
      },
      {
        q: "Will Nativo's check guarantee my rebate?",
        a: "No. Only the program can approve a project. Nativo checks the rules it can measure from your plan, and marks the rest as things you or the inspector confirm. It never marks those as passed.",
      },
    ],
  },
  {
    id: "plants",
    title: "Plants and your ground",
    items: [
      {
        q: "How do you estimate my yard?",
        a: "We find your lot in the county's public records, which give its outline and the house's size. Building outlines show where the house sits. Then we read a public aerial photo: its infrared band shows which ground is growing (lawn, trees and beds) and which is bare or paved. The side facing the street is the front yard. It is an estimate, not a survey: you adjust how much lawn you would replace, and the rebate program measures your area at its first site visit.",
      },
      {
        q: "Why does my yard estimate look wrong?",
        a: "The photo can be a few years old and is about 2 ft a pixel, so new patios, removed lawn or tall trees may not show. Trees count as planted, and roof edges can read as bare. Building outlines date from 2018 and can miss additions. Use the estimate as a starting point and change the lawn figure to what you see.",
      },
      {
        q: "Where do the soil and climate numbers come from?",
        a: "Soil comes from the USDA county soil surveys, hardiness zones from the USDA Plant Hardiness Zone Map, and frost dates from NOAA's 1991 to 2020 climate normals. Sun is calculated from your latitude. Every number on your report names its source.",
      },
      {
        q: "Why does my soil reading say low confidence?",
        a: "Soil surveys map areas, not single yards, and built-up ground is often fill brought in from elsewhere. When the survey is less certain, we say so. A home soil test is the most reliable answer.",
      },
      {
        q: "Why are some plants marked as drafts?",
        a: "Every plant's details are checked by a horticultural reviewer before they are published. Until then, plants show as drafts so you know the details may still change.",
      },
      {
        q: "Are the plants safe for pets and children?",
        a: "Some native plants are toxic if eaten. Check any plant you are unsure about with your nursery or vet, especially if pets or small children will be near it. Nativo's suggestions are advice, not a guarantee.",
      },
    ],
  },
  {
    id: "privacy",
    title: "Your privacy",
    items: [
      {
        q: "Do you save my address?",
        a: "No. We look your address up to find your location, then pass the result between pages in the web address itself. When you check a plan, we keep the shape of the plan, the result and your ZIP code, never your street address.",
      },
      {
        q: "Who else sees my address?",
        a: "The US Census Bureau's address lookup service, which turns your address into a location. Our privacy policy lists every service involved.",
      },
    ],
  },
];

export const ALL_FAQS: Faq[] = FAQ_GROUPS.flatMap((g) => g.items);

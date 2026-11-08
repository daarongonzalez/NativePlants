/**
 * Facts about Nativo that more than one page states. Change them here once.
 *
 * Anything marked TO CONFIRM is a placeholder written for review. Each one is
 * also listed in docs/launch-review.md.
 */

export const SITE_NAME = "Nativo";

/**
 * TO CONFIRM: the inbox for privacy requests and general questions. Until it
 * is set, pages show a bracketed placeholder so the gap is easy to spot.
 */
export const CONTACT_EMAIL: string | null = null;

/** TO CONFIRM: the legal name of the business that runs Nativo. */
export const LEGAL_NAME: string | null = null;

/** TO CONFIRM: the state whose law governs the terms. Utah is the likely answer; a lawyer should confirm it. */
export const GOVERNING_STATE: string | null = null;

/** Where Nativo works today. The rest of the site treats this as the first region, not the only one. */
export const LAUNCH_REGION = "the Wasatch Front";
export const LAUNCH_COUNTIES = "Salt Lake, Utah, Davis and Weber counties";

/** TO CONFIRM: the horticultural reviewer named on the About page and on reviewed posts. Null until they agree. */
export const PLANT_REVIEWER: { name: string; credentials: string } | null = null;

/** The person who writes and signs the guides. */
export const AUTHOR = { name: "The Nativo team", role: "Editor" };

/** Pages listed in the site footer and the sitemap. */
export const SITE_LINKS = [
  { href: "/rebates", label: "Rebates" },
  { href: "/blog", label: "Guides" },
  { href: "/faq", label: "FAQ" },
  { href: "/about", label: "About" },
  { href: "/about#sources", label: "Sources" },
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
] as const;

import { z } from "zod";

/**
 * The sun question, in the words a gardener sees.
 *
 * Kept here, not in the web app, so the wording is reviewed once and the API's
 * accepted values cannot drift from the options on screen.
 *
 * Each option says how to tell, in terms of things a person can see, because
 * "how many hours of direct sun" is not something anyone knows off the top of
 * their head. The hours behind each answer live in @np/engine.
 */

export const sunExposureSchema = z.enum(["full", "part", "shade"]);
export type SunExposure = z.infer<typeof sunExposureSchema>;

export const SUN_QUESTION = {
  prompt: "How much sun does this spot get on a summer day?",
  help: "Think about a clear day in June or July. Direct sun means the sun is shining on the ground itself, not just that it is light out.",
  options: [
    {
      value: "full",
      label: "Most of the day",
      detail: "About 6 hours or more of direct sun. Usually open ground with nothing tall to the south or west.",
    },
    {
      value: "part",
      label: "Part of the day",
      detail: "About 3 to 6 hours. Often sun in the morning and shade by afternoon, or the reverse, or dappled light under a tree.",
    },
    {
      value: "shade",
      label: "Mostly shade",
      detail: "Under 3 hours. Usually the north side of a house or fence, or under dense trees.",
    },
  ],
  skip: "Not sure yet",
  skipNote: "We will estimate from where you live. That assumes nothing shades the spot, so your matches will be less exact.",
} as const satisfies {
  prompt: string;
  help: string;
  options: readonly { value: SunExposure; label: string; detail: string }[];
  skip: string;
  skipNote: string;
};

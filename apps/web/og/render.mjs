// Draws card.html to ../public/og.png at the link-preview size (1200 x 630).
// Needs Playwright with Chromium. It is not a project dependency, so the
// script finds it through NODE_PATH (see the "og" script in package.json).
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const { chromium } = createRequire(import.meta.url)("playwright");

const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
await page.goto(`file://${here("./card.html")}`);
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: here("../public/og.png"), type: "png" });
await browser.close();
console.log("Wrote apps/web/public/og.png");

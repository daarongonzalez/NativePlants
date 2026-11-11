import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { decodePng } from "./png";

const fixture = (name: string) => readFileSync(new URL(`./__fixtures__/${name}`, import.meta.url));

describe("decodePng", () => {
  it("reads every PNG row filter exactly", async () => {
    const expected = JSON.parse(fixture("filters.json").toString()) as { width: number; height: number; pixels: number[] };
    const png = await decodePng(fixture("filters.png"));
    expect(png).toMatchObject({ width: expected.width, height: expected.height, channels: 3 });
    expect(Array.from(png.data)).toEqual(expected.pixels);
  });

  it("refuses something that is not a PNG", async () => {
    await expect(decodePng(new TextEncoder().encode("<html>error</html>"))).rejects.toThrow("not a PNG");
  });
});

import { describe, expect, it } from "vitest";
import app from "./index";

/**
 * The visitor routes must answer without a sign-in, and must turn away bad
 * input before touching the database. Database behaviour is covered in
 * packages/db.
 */
const env = { HYPERDRIVE: { connectionString: "postgres://unused" }, MARKET: "wasatch-front" };
const post = (path: string, body: unknown) =>
  app.request(path, { method: "POST", body: JSON.stringify(body), headers: { "Content-Type": "application/json" } }, env);

describe("public routes", () => {
  it("do not ask for a sign-in", async () => {
    const res = await post("/v1/public/lookup", { address: "" });
    expect(res.status).toBe(400);
  });

  it("still protect the signed-in routes", async () => {
    const res = await app.request("/v1/sites", {}, env);
    expect(res.status).toBe(401);
  });

  it("refuse a profile with no usable location", async () => {
    expect((await post("/v1/public/profile", { latitude: 200, longitude: 0, zip: "84101" })).status).toBe(400);
    expect((await post("/v1/public/profile", { latitude: 40.7, longitude: -111.9, zip: "SLC" })).status).toBe(400);
  });

  it("refuse a plan whose squares do not match its size", async () => {
    const res = await post("/v1/public/rebates/ut-landscape-incentive/checks", {
      layout: { areaKind: "front", widthFt: 10, depthFt: 10, cells: [{ kind: "lawn" }] },
    });
    expect(res.status).toBe(400);
  });

  it("refuse a body too large to be a plan", async () => {
    const res = await post("/v1/public/lookup", { address: "x".repeat(40_000) });
    expect(res.status).toBe(413);
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";
import { CensusGeocodeClient } from "./geocode";
import { UsgsElevationClient } from "./elevation";

/**
 * Regression test for "Illegal invocation".
 *
 * Passing the global `fetch` as a bare default (`= fetch`) loses its binding.
 * Calling it as `this.fetchImpl(...)` then sets `this` to the instance, and
 * the Workers runtime rejects it. Node's fetch does not care, so the bug is
 * invisible locally and in CI — it took out all 67 ZIPs on the first real
 * ingestion run and reported them as ordinary skips.
 *
 * These tests reproduce the Workers behaviour by installing a global fetch
 * that enforces its own `this`, so the mistake fails here instead of in
 * production.
 */

const realFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = realFetch;
  vi.restoreAllMocks();
});

/** Stands in for the Workers runtime, which checks `this` on fetch. */
function installStrictFetch(body: unknown) {
  const strict = function (this: unknown) {
    if (this !== undefined && this !== globalThis) {
      throw new TypeError(
        "Illegal invocation: function called with incorrect `this` reference.",
      );
    }
    return Promise.resolve(
      new Response(JSON.stringify(body), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
  };
  globalThis.fetch = strict as unknown as typeof fetch;
}

describe("default fetch keeps its binding", () => {
  it("does not throw Illegal invocation from the geocoder", async () => {
    installStrictFetch({
      result: {
        addressMatches: [
          {
            matchedAddress: "X",
            coordinates: { x: -111.9, y: 40.7 },
            addressComponents: { zip: "84108" },
          },
        ],
      },
    });

    // Constructed with no explicit fetch — the production path.
    const client = new CensusGeocodeClient();
    await expect(client.geocode("anywhere")).resolves.not.toBeNull();
  });

  it("does not throw Illegal invocation from the elevation client", async () => {
    installStrictFetch({ value: 1320 });

    const client = new UsgsElevationClient();
    await expect(client.elevation(40.7, -111.9)).resolves.toEqual({
      elevationM: 1320,
    });
  });

  it("proves the strict stand-in actually catches the mistake", () => {
    // Without this, the two tests above would pass even if the bug returned.
    // The `this` check throws synchronously, before any promise exists.
    installStrictFetch({ value: 1 });
    const holder = { fetchImpl: globalThis.fetch };
    expect(() => holder.fetchImpl("https://example.test")).toThrow(
      /Illegal invocation/,
    );
  });
});

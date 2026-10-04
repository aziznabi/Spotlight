import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
// Check the policy actually resolved by Workflow's download-tooling dependency.
const CachePolicy = createRequire(require.resolve("cacheable-request"))(
  "http-cache-semantics",
);
const request = {
  url: "https://cache-fixture.invalid/item",
  method: "GET",
  headers: { host: "cache-fixture.invalid", accept: "application/json" },
};

describe("HTTP cache policy dependency", () => {
  it("does not bypass a compound Vary wildcard with max-stale", () => {
    const policy = new CachePolicy(request, {
      status: 200,
      headers: { "cache-control": "public, max-age=0", vary: "accept, *" },
    });
    expect(
      policy.satisfiesWithoutRevalidation({
        ...request,
        headers: { ...request.headers, "cache-control": "max-stale" },
      }),
    ).toBe(false);
  });

  it("preserves public matching cache hits and refuses private storage", () => {
    const publicPolicy = new CachePolicy(request, {
      status: 200,
      headers: { "cache-control": "public, max-age=3600", vary: "accept" },
    });
    expect(publicPolicy.storable()).toBe(true);
    expect(publicPolicy.satisfiesWithoutRevalidation(request)).toBe(true);
    expect(
      publicPolicy.satisfiesWithoutRevalidation({
        ...request,
        headers: { ...request.headers, accept: "text/html" },
      }),
    ).toBe(false);
    // Callers must check storable() before storing: max-stale is not permission
    // to put private/no-store responses in a shared cache.
    for (const directive of ["private", "no-store"]) {
      const policy = new CachePolicy(request, {
        status: 200,
        headers: { "cache-control": directive },
      });
      expect(policy.storable()).toBe(false);
    }
  });
});

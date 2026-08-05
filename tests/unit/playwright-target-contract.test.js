import { describe, expect, it } from "vitest";
import { resolvePlaywrightTarget } from "../../scripts/playwright-target-contract.mjs";

describe("Playwright external target contract", () => {
  it("keeps the managed loopback server as the default", () => {
    expect(resolvePlaywrightTarget({}, { baseURL: "http://127.0.0.1:4174" })).toEqual({
      baseURL: "http://127.0.0.1:4174",
      healthURL: "http://127.0.0.1:4174/api/servers",
      useManagedWebServer: true
    });
  });

  it("accepts the exact staging HTTPS origin without starting localhost", () => {
    expect(resolvePlaywrightTarget({
      PLAYWRIGHT_SKIP_WEB_SERVER: "1",
      PLAYWRIGHT_E2E_BASE_URL: "https://staging.empirestreets.cz",
      EMPIRE_RELEASE_ENVIRONMENT: "staging",
      EMPIRE_PUBLIC_ORIGIN: "https://staging.empirestreets.cz"
    })).toEqual({
      baseURL: "https://staging.empirestreets.cz",
      healthURL: "https://staging.empirestreets.cz/api/servers",
      useManagedWebServer: false
    });
  });

  it.each([
    ["wildcard-like mismatch", "https://preview.empirestreets.cz", "https://staging.empirestreets.cz"],
    ["HTTP public origin", "http://staging.empirestreets.cz", "http://staging.empirestreets.cz"],
    ["production target under staging", "https://empirestreets.cz", "https://staging.empirestreets.cz"]
  ])("rejects %s", (_label, baseURL, publicOrigin) => {
    expect(() => resolvePlaywrightTarget({
      PLAYWRIGHT_SKIP_WEB_SERVER: "1",
      PLAYWRIGHT_E2E_BASE_URL: baseURL,
      EMPIRE_RELEASE_ENVIRONMENT: "staging",
      EMPIRE_PUBLIC_ORIGIN: publicOrigin
    })).toThrow(/PLAYWRIGHT_PUBLIC_ORIGIN_MISMATCH/u);
  });

  it("accepts an explicitly reused loopback server", () => {
    expect(resolvePlaywrightTarget({
      PLAYWRIGHT_SKIP_WEB_SERVER: "1",
      PLAYWRIGHT_E2E_BASE_URL: "http://127.0.0.1:8788"
    }).useManagedWebServer).toBe(false);
  });
});

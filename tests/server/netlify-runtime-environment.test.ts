import { describe, expect, it } from "vitest";
import { normalizeNetlifyFunctionEnvironment } from "../../apps/server/src/netlify/netlify-runtime-environment";

describe("Netlify function runtime environment", () => {
  it("treats a public Netlify site URL as production", () => {
    expect(normalizeNetlifyFunctionEnvironment({
      URL: "https://empirestreets.cz"
    }).NODE_ENV).toBe("production");
  });

  it("does not turn local Netlify development into production", () => {
    expect(normalizeNetlifyFunctionEnvironment({
      URL: "http://localhost:8888",
      NODE_ENV: "development"
    }).NODE_ENV).toBe("development");
  });

  it("treats a Netlify function SITE_ID as production when URL is unavailable", () => {
    expect(normalizeNetlifyFunctionEnvironment({
      SITE_ID: "site-123"
    }).NODE_ENV).toBe("production");
  });

  it("preserves an explicit production environment", () => {
    const environment = {
      NODE_ENV: "production",
      URL: "https://empirestreets.cz"
    };

    expect(normalizeNetlifyFunctionEnvironment(environment)).toBe(environment);
  });
});

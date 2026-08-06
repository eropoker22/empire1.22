import { describe, expect, it } from "vitest";
import {
  getRemoteStagingAcceptanceSuite,
  REMOTE_STAGING_ACCEPTANCE_SUITES
} from "../../scripts/remote-staging-acceptance-suites.mjs";

const expectedSuites = [
  "manual-admin-player",
  "canonical-20p-registration",
  "ui-parity",
  "ui-parity-social",
  "production-pharmacy",
  "production-drug-lab",
  "production-factory",
  "production-armory",
  "income",
  "building-actions-day",
  "building-actions-night",
  "ui-parity-non-spawn",
  "multiplayer-visible-actions",
  "city-events",
  "social-visible-ui",
  "social-concurrency-privacy",
  "lifecycle-stop"
];

describe("remote staging acceptance suite contract", () => {
  it("defines every required hosted matrix suite exactly once", () => {
    expect(REMOTE_STAGING_ACCEPTANCE_SUITES.map(({ name }) => name)).toEqual(expectedSuites);
    expect(new Set(expectedSuites).size).toBe(expectedSuites.length);
  });

  it("uses real browser specs and controlled staging scenarios", () => {
    for (const suite of REMOTE_STAGING_ACCEPTANCE_SUITES) {
      expect(suite.playwrightRuns.length).toBeGreaterThan(0);
      expect(suite.playwrightRuns.flatMap(({ specs }) => specs).every((spec) => spec.startsWith("tests/e2e/"))).toBe(true);
    }
    expect(getRemoteStagingAcceptanceSuite("social-concurrency-privacy")).toMatchObject({
      bootstrapCount: 5,
      scenario: "social-concurrency-privacy"
    });
    expect(getRemoteStagingAcceptanceSuite("canonical-20p-registration")).toMatchObject({
      bootstrapCount: 20,
      bootstrapTimeoutMs: 1_500_000,
      capacity: 20
    });
    expect(getRemoteStagingAcceptanceSuite("social-concurrency-privacy").bootstrapTimeoutMs).toBe(900_000);
    expect(getRemoteStagingAcceptanceSuite("income").restartWorkerBeforeSpec).toBe(true);
    expect(getRemoteStagingAcceptanceSuite("lifecycle-stop").pauseResumeBeforeSpec).toBe(true);
  });

  it("rejects unknown or skipped suite names", () => {
    expect(() => getRemoteStagingAcceptanceSuite("unknown")).toThrow(/Unknown remote staging suite/u);
  });
});

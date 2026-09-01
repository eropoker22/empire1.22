import { describe, expect, it } from "vitest";
import {
  getRemoteStagingAcceptanceSuite,
  REMOTE_MANUAL_STARTING_PLAYER_STATE,
  REMOTE_STAGING_ACCEPTANCE_SUITES
} from "../../scripts/remote-staging-acceptance-suites.mjs";

const expectedSuites = [
  "manual-admin-player",
  "canonical-20p-registration",
  "full-lifecycle-20p",
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
  it("defines every required remote staging suite exactly once", () => {
    expect(REMOTE_STAGING_ACCEPTANCE_SUITES.map(({ name }) => name)).toEqual(expectedSuites);
    expect(new Set(expectedSuites).size).toBe(expectedSuites.length);
  });

  it("uses real browser specs and controlled staging scenarios", () => {
    for (const suite of REMOTE_STAGING_ACCEPTANCE_SUITES) {
      expect(suite.playwrightRuns.length).toBeGreaterThan(0);
      expect([...suite.preLifecyclePlaywrightRuns, ...suite.playwrightRuns]
        .flatMap(({ specs }) => specs)
        .every((spec) => spec.startsWith("tests/e2e/"))).toBe(true);
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
    expect(getRemoteStagingAcceptanceSuite("full-lifecycle-20p")).toMatchObject({
      bootstrapCount: 20,
      capacity: 20,
      fullLifecycle: true,
      hostedAcceptance: false,
      workflowTimeoutMinutes: 120
    });
    expect(getRemoteStagingAcceptanceSuite("full-lifecycle-20p").preLifecyclePlaywrightRuns)
      .toHaveLength(1);
    expect(getRemoteStagingAcceptanceSuite("social-concurrency-privacy").bootstrapTimeoutMs).toBe(900_000);
    expect(getRemoteStagingAcceptanceSuite("income").restartWorkerBeforeSpec).toBe(true);
    expect(getRemoteStagingAcceptanceSuite("lifecycle-stop").pauseResumeBeforeSpec).toBe(true);
  });

  it("bounds district action parity browser lifetime by viewport batch", () => {
    const suite = getRemoteStagingAcceptanceSuite("multiplayer-visible-actions");
    expect(suite.workflowTimeoutMinutes).toBe(90);
    expect(suite.playwrightRuns).toHaveLength(6);
    expect(suite.playwrightRuns.at(-1)).toMatchObject({
      name: "multiplayer-visible-actions",
      specs: ["tests/e2e/manual-hosted-district-actions-ui.spec.js"]
    });
    const parityRuns = suite.playwrightRuns.slice(0, -1);
    expect(parityRuns.map(({ environment }) => (
      environment.EMPIRE_UI_PARITY_DISTRICT_ACTION_BATCH_KEYS
    ))).toEqual([
      "district-action-01",
      "district-action-02",
      "district-action-03",
      "district-action-04",
      "district-action-05"
    ]);
    expect(parityRuns.every(({ specs }) => (
      specs.length === 1
      && specs[0] === "tests/e2e/live-demo-district-action-overlay-parity.spec.js"
    ))).toBe(true);
  });

  it("keeps the manual admin starting state complete", () => {
    expect(REMOTE_MANUAL_STARTING_PLAYER_STATE).toMatchObject({
      cleanCash: expect.any(Number),
      dirtyCash: expect.any(Number),
      population: expect.any(Number),
      influence: expect.any(Number),
      spySlots: 2
    });
    const materialValues = Object.values(REMOTE_MANUAL_STARTING_PLAYER_STATE.materials);
    expect(materialValues).toHaveLength(21);
    expect(new Set(materialValues).size).toBe(materialValues.length);
    expect(materialValues).toContain(0);
  });

  it("rejects unknown or skipped suite names", () => {
    expect(() => getRemoteStagingAcceptanceSuite("unknown")).toThrow(/Unknown remote staging suite/u);
  });
});

import { describe, expect, it } from "vitest";
import {
  assertCanonicalInvariantEvidence,
  assertCanonicalQuietHoursEvidence,
  assertCanonicalScenarioProvenance
} from "../../scripts/release-critical-evidence-contract.mjs";

const SHA = "a".repeat(40);
const validQuietHours = () => ({
  quietHourDeferrals: 1,
  quietHours: {
    status: "passed",
    timezone: "Europe/Bratislava",
    deferrals: 1,
    boundaryChecks: [
      { id: "before-start", tick: 99, inQuietHours: false },
      { id: "start", tick: 100, inQuietHours: true },
      { id: "inside", tick: 101, inQuietHours: true },
      { id: "before-end", tick: 199, inQuietHours: true },
      { id: "end", tick: 200, inQuietHours: false }
    ],
    eliminationBefore: 3,
    eliminationAfterDeferredTick: 3,
    eliminationAfterAllowedTick: 4,
    eliminationAfterNextTick: 4,
    activePlayersBefore: 17,
    activePlayersAfterDeferred: 17,
    deferredTick: 100,
    allowedTick: 200,
    nextEliminationTickAfterDeferred: 200,
    membershipStateHashBefore: "b".repeat(64),
    membershipStateHashAfterDeferred: "b".repeat(64),
    resourceStateHashBefore: "c".repeat(64),
    resourceStateHashAfterDeferred: "c".repeat(64)
  }
});

describe("release-critical evidence contract", () => {
  it.each([
    [{ status: "passed", violationCodes: [] }],
    [{ status: "passed", checks: 0, violationCodes: [] }],
    [{ status: "passed", checks: -1, violationCodes: [] }],
    [{ status: "passed", checks: "12", violationCodes: [] }],
    [{ status: "passed", checks: 12, violationCodes: ["BROKEN"] }]
  ])("rejects invariant evidence that did not execute clean checks", (evidence) => {
    expect(() => assertCanonicalInvariantEvidence(evidence)).toThrow(/RELEASE_INVARIANT_EVIDENCE_INVALID/u);
  });

  it("accepts positive integer invariant checks with no violations", () => {
    expect(assertCanonicalInvariantEvidence({ status: "passed", checks: 12, violationCodes: [] })).toBe(true);
  });

  it("rejects missing or zero quiet-hour deferrals", () => {
    const missing = validQuietHours();
    delete missing.quietHourDeferrals;
    expect(() => assertCanonicalQuietHoursEvidence(missing)).toThrow(/RELEASE_QUIET_HOURS/u);
    const zero = validQuietHours();
    zero.quietHourDeferrals = 0;
    zero.quietHours.deferrals = 0;
    expect(() => assertCanonicalQuietHoursEvidence(zero)).toThrow(/RELEASE_QUIET_HOURS/u);
  });

  it("accepts one real deferral with all canonical boundaries", () => {
    expect(assertCanonicalQuietHoursEvidence(validQuietHours())).toBe(true);
  });

  it("rejects a double elimination after quiet hours", () => {
    const evidence = validQuietHours();
    evidence.quietHours.eliminationAfterNextTick += 1;
    expect(() => assertCanonicalQuietHoursEvidence(evidence)).toThrow(/RELEASE_QUIET_HOURS/u);
  });

  it("requires complete exact-SHA provenance", () => {
    const valid = {
      scenarioId: "full-lifecycle-20p",
      buildSha: SHA,
      environment: "public-staging",
      testCommand: "npm run test:remote-staging:suite -- --suite=full-lifecycle-20p",
      testFile: "scripts/run-remote-staging-suite.mjs",
      browserUsed: true,
      postgresUsed: true,
      concurrencyUsed: false,
      status: "passed",
      artifactPath: "artifacts/remote-staging/full-lifecycle-20p/lifecycle-report.json"
    };
    expect(assertCanonicalScenarioProvenance(valid, { buildSha: SHA })).toBe(true);
    expect(() => assertCanonicalScenarioProvenance({ ...valid, environment: "staging" }, { buildSha: SHA }))
      .toThrow(/PROVENANCE/u);
    expect(() => assertCanonicalScenarioProvenance({ ...valid, artifactPath: "lifecycle.json" }, { buildSha: SHA }))
      .toThrow(/PROVENANCE/u);
    expect(() => assertCanonicalScenarioProvenance({ ...valid, buildSha: "b".repeat(40) }, { buildSha: SHA }))
      .toThrow(/PROVENANCE/u);
  });
});

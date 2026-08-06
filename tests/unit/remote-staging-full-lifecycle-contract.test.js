import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { getRemoteStagingAcceptanceSuite } from "../../scripts/remote-staging-acceptance-suites.mjs";
import { isLifecycleRegistrationSnapshotReady } from
  "../../scripts/remote-staging-full-lifecycle-contract.mjs";

const runner = readFileSync("scripts/run-remote-staging-suite.mjs", "utf8");
const fixture = readFileSync("tools/seed/hosted-staging-full-lifecycle-step.mjs", "utf8");
const safety = readFileSync("scripts/remote-staging-fixture-safety.mjs", "utf8");

describe("guarded remote full lifecycle contract", () => {
  it("registers one remote-only canonical 20-player lifecycle suite", () => {
    expect(getRemoteStagingAcceptanceSuite("full-lifecycle-20p")).toMatchObject({
      bootstrapCount: 20,
      capacity: 20,
      fullLifecycle: true,
      hostedAcceptance: false,
      workflowTimeoutMinutes: 120
    });
  });

  it("drives real lifecycle boundaries with pause, worker recovery and final evidence", () => {
    expect(runner).toContain('"close-registration-now"');
    expect(runner).toContain('"prepare-next-elimination"');
    expect(runner).toContain('"prepare-final-lockdown-resolution"');
    expect(runner).toContain("restartSingleStagingWorker()");
    expect(runner).toContain('path.join(artifactDirectory, "lifecycle-report.json")');
    expect(runner).toContain('path.join(artifactDirectory, "invariant-report.json")');
    expect(runner).toContain('path.join(artifactDirectory, "cleanup-report.json")');
    expect(runner).toContain('confirmationToken: "CLOSE_REGISTRATION"');
    expect(runner).toContain("stable.eliminatedPlayers !== 12");
    expect(runner).toContain("stable.eliminationCount !== 12");
    expect(runner).toContain("stable.defeatedMembershipCount !== 0");
    expect(runner).toContain("stable.completedMembershipCount !== 20");
    expect(runner).toContain("stable.snapshotMatchResultHash !== stable.persistedMatchResultHash");
    expect(runner).toContain("stable.snapshotRankingHash !== stable.membershipRankingHash");
    expect(runner).toContain("stable.resultPayloadMatchesSnapshot !== true");
    expect(fixture).toContain("completedMembershipCount");
    expect(fixture).toContain("canonicalHash(snapshotMatchResult)");
    expect(fixture).toContain("canonicalHash(persistedMatchResult)");
    expect(fixture).toContain("membershipRankingMatchesSnapshot");
  });

  it("waits for the frozen registration pacing fields to reach the recovery head", () => {
    const expected = {
      baselinePlayers: 20,
      effectiveFinalLockdownTrigger: 8,
      effectiveFirstEliminationTick: 1440
    };
    expect(isLifecycleRegistrationSnapshotReady({
      snapshotRegistrationClosed: false,
      snapshotRegistrationBaselinePlayers: null,
      snapshotEffectiveFinalLockdownTrigger: null,
      snapshotEffectiveFirstEliminationTick: null
    }, expected)).toBe(false);
    expect(isLifecycleRegistrationSnapshotReady({
      snapshotRegistrationClosed: true,
      snapshotRegistrationBaselinePlayers: 20,
      snapshotEffectiveFinalLockdownTrigger: 8,
      snapshotEffectiveFirstEliminationTick: 1440
    }, expected)).toBe(true);
    expect(isLifecycleRegistrationSnapshotReady({
      snapshotRegistrationClosed: true,
      snapshotRegistrationBaselinePlayers: 19,
      snapshotEffectiveFinalLockdownTrigger: 8,
      snapshotEffectiveFirstEliminationTick: 1440
    }, expected)).toBe(false);
  });

  it("allows clock preparation only for the pinned paused disposable staging server", () => {
    expect(fixture).toContain("assertSafeRemoteStagingFixtureEnvironment(process.env)");
    expect(fixture).toContain("readRemoteStagingLifecycleFixtureBinding(process.env)");
    expect(fixture).toContain(
      "assertRemoteStagingLifecycleFixtureServer(server, { mutate, ...lifecycleBinding })"
    );
    expect(fixture).toContain("assertLifecycleSnapshotScope(current, server, { mutate })");
    expect(fixture).toContain("REMOTE_STAGING_LIFECYCLE_SNAPSHOT_NOT_SYNCHRONIZED");
    expect(fixture).toContain('snapshot.state.root.playerIds.length !== 20');
    expect(fixture).toContain('server.effectiveFinalLockdownTrigger !== 8');
    expect(fixture).toContain("checkGameStateInvariants(prepared.state)");
    expect(fixture).toContain("empire_hosted_match_results");
    expect(safety).toContain('if (mutate && server.status !== "paused")');
    expect(safety).toContain('server.serverTemplate !== "full"');
    expect(safety).toContain("server.capacity !== 20");
  });
});

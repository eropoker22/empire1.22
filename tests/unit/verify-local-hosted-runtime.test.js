import { describe, expect, it } from "vitest";
import {
  CANONICAL_FREE_TICK_RATE_MS,
  evaluateInstanceAdvancement,
  evaluateRecoveryHead,
  evaluateSnapshotFreshness,
  parseInstanceArgument,
  resolveInstancePollPolicy,
  resolveInstanceTickRateMs
} from "../../scripts/verify-local-hosted-runtime.mjs";

describe("local hosted instance verifier arguments", () => {
  it("accepts an optional exact server instance id", () => {
    expect(parseInstanceArgument([])).toBeNull();
    expect(parseInstanceArgument(["--instance=instance:free:eu-central:test-1"]))
      .toBe("instance:free:eu-central:test-1");
  });

  it.each([
    ["--instance="],
    ["--instance=invalid id"],
    ["--unknown=value"],
    ["--instance=instance:one", "--instance=instance:two"]
  ])("rejects invalid arguments", (...argv) => {
    expect(() => parseInstanceArgument(argv)).toThrow();
  });
});

describe("local hosted instance polling policy", () => {
  it("uses the canonical Free tick rate as its fallback", () => {
    expect(resolveInstanceTickRateMs(null)).toBe(CANONICAL_FREE_TICK_RATE_MS);
    expect(resolveInstancePollPolicy(null)).toEqual({
      tickRateMs: CANONICAL_FREE_TICK_RATE_MS,
      pollIntervalMs: Math.ceil(CANONICAL_FREE_TICK_RATE_MS / 4),
      timeoutMs: CANONICAL_FREE_TICK_RATE_MS * 3,
      snapshotFreshnessMaxAgeMs: CANONICAL_FREE_TICK_RATE_MS * 3
    });
  });

  it("derives polling from an instance-specific canonical tick rate", () => {
    expect(resolveInstancePollPolicy(4_000)).toMatchObject({
      tickRateMs: 4_000,
      pollIntervalMs: 1_000,
      timeoutMs: 12_000
    });
  });
});

describe("local hosted instance advancement", () => {
  const before = {
    instanceTick: 40,
    snapshotTick: 40,
    rootTick: 40,
    stateVersion: 80
  };

  it("requires heartbeat, snapshot and root ticks plus state version to advance", () => {
    expect(evaluateInstanceAdvancement(before, {
      instanceTick: 41,
      snapshotTick: 41,
      rootTick: 41,
      stateVersion: 81
    })).toMatchObject({
      tickAdvanced: true,
      stateVersionAdvanced: true,
      missingTickFields: [],
      stalledTickFields: []
    });
  });

  it("reports a stalled root tick independently from state version", () => {
    expect(evaluateInstanceAdvancement(before, {
      instanceTick: 41,
      snapshotTick: 41,
      rootTick: 40,
      stateVersion: 81
    })).toMatchObject({
      tickAdvanced: false,
      stateVersionAdvanced: true,
      stalledTickFields: ["rootTick"]
    });
  });
});

describe("local hosted recovery and freshness policy", () => {
  const recoveryHead = {
    serverInstanceId: "instance:free:test",
    status: "running",
    snapshotId: "snapshot:1",
    snapshotTick: 12,
    payloadTick: 12,
    rootTick: 12,
    rootVersion: 24,
    integrityRootVersion: 24,
    stateVersion: 24,
    snapshotServerInstanceId: "instance:free:test"
  };

  it("requires recovery-head column and payload counters to agree", () => {
    expect(evaluateRecoveryHead(recoveryHead).outcome).toBe("PASS");
    expect(evaluateRecoveryHead({ ...recoveryHead, rootTick: 11 })).toMatchObject({
      outcome: "FAIL"
    });
  });

  it("requires fresh snapshots only while the server is running", () => {
    const nowMs = Date.parse("2026-07-30T12:00:00.000Z");
    expect(evaluateSnapshotFreshness({
      status: "running",
      snapshotCreatedAt: "2026-07-30T11:59:40.000Z",
      nowMs,
      tickRateMs: 10_000
    }).outcome).toBe("PASS");
    expect(evaluateSnapshotFreshness({
      status: "running",
      snapshotCreatedAt: "2026-07-30T11:59:20.000Z",
      nowMs,
      tickRateMs: 10_000
    }).outcome).toBe("FAIL");
    expect(evaluateSnapshotFreshness({
      status: "paused",
      snapshotCreatedAt: "2026-07-29T12:00:00.000Z",
      nowMs,
      tickRateMs: 10_000
    }).outcome).toBe("PASS");
  });

  it("reports pre-provisioning snapshots as unavailable rather than stale", () => {
    expect(evaluateRecoveryHead({ status: "provisioning", snapshotId: null }).outcome)
      .toBe("NOT AVAILABLE");
    expect(evaluateSnapshotFreshness({
      status: "provisioning",
      snapshotCreatedAt: null,
      tickRateMs: 10_000
    }).outcome).toBe("NOT AVAILABLE");
  });
});

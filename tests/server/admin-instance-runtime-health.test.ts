import { describe, expect, it } from "vitest";
import type { AdminInstanceSummaryView } from "@empire/shared-types";
import {
  createAdminInstanceRuntimeHealth,
  isLifecycleSnapshotStale,
  resolveAdminCommandObservationWindowMs,
  resolveAdminTickObservationWindowMs
} from "../../apps/server/src/admin/read-only/admin-instance-runtime-health";

const NOW = "2026-07-31T10:00:00.000Z";

describe("admin per-instance runtime health", () => {
  it("requires a fresh per-instance heartbeat and lease for a running server", () => {
    const health = createAdminInstanceRuntimeHealth({
      summary: summary(),
      generatedAt: NOW,
      observation: {
        ...matchingRuntimeOwnership(),
        canonicalTickRateMs: 10_000,
        instanceLastTick: 42,
        instanceLastSnapshotAt: "2026-07-31T09:59:50.000Z",
        instanceLastErrorCode: null,
        lastAppliedCommandAt: "2026-07-31T09:59:55.000Z",
        lastStartedAt: "2026-07-31T09:55:00.000Z"
      },
      snapshotStorage: snapshotStorage(),
      tickProgress: tickProgress()
    });

    expect(health).toMatchObject({
      lifecycleStatus: "running",
      expectedTickRateMs: 10_000,
      freshnessThresholdMs: 30_000,
      commandObservationWindowMs: 40_000,
      runtimeActive: { status: "pass", reasonCode: "instance-runtime-active" },
      tickAdvancing: { status: "pass", reasonCode: "tick-advance-two-sample" },
      snapshotCurrent: { status: "pass", reasonCode: "recovery-head-current" },
      commandsAccepted: { status: "pass", reasonCode: "recent-applied-command-observed" }
    });
  });

  it("rejects a fresh heartbeat from a different worker incarnation", () => {
    const health = createAdminInstanceRuntimeHealth({
      summary: summary(),
      generatedAt: NOW,
      observation: {
        ...matchingRuntimeOwnership(),
        instanceWorkerIncarnationId: "worker-incarnation:replacement",
        canonicalTickRateMs: 10_000,
        instanceLastTick: 42,
        instanceLastSnapshotAt: "2026-07-31T09:59:50.000Z",
        instanceLastErrorCode: null,
        lastAppliedCommandAt: "2026-07-31T09:59:55.000Z",
        lastStartedAt: "2026-07-31T09:55:00.000Z"
      },
      snapshotStorage: snapshotStorage(),
      tickProgress: tickProgress()
    });

    expect(health.runtimeActive).toMatchObject({
      status: "fail",
      reasonCode: "runtime-lease-heartbeat-owner-mismatch"
    });
    expect(health.tickAdvancing.status).toBe("fail");
    expect(health.commandsAccepted.status).toBe("fail");
  });

  it("fails a running instance even when a separate global worker could be online", () => {
    const health = createAdminInstanceRuntimeHealth({
      summary: summary({
        workerStatus: "offline",
        lastHeartbeatAt: "2026-07-31T09:55:00.000Z",
        leaseOwner: null,
        leaseExpiresAt: null,
        lastSnapshotAt: "2026-07-31T09:55:00.000Z"
      }),
      generatedAt: NOW,
      observation: {
        ...matchingRuntimeOwnership(),
        canonicalTickRateMs: 10_000,
        instanceLastTick: 41,
        instanceLastSnapshotAt: "2026-07-31T09:55:00.000Z",
        instanceLastErrorCode: null,
        lastAppliedCommandAt: null,
        lastStartedAt: "2026-07-31T09:54:00.000Z"
      },
      snapshotStorage: snapshotStorage(),
      tickProgress: tickProgress()
    });

    expect(health.runtimeActive).toMatchObject({
      status: "fail",
      reasonCode: "instance-heartbeat-not-live"
    });
    expect(health.tickAdvancing.status).toBe("fail");
    expect(health.snapshotCurrent).toMatchObject({
      status: "fail",
      reasonCode: "recovery-head-stale"
    });
    expect(health.commandsAccepted.status).toBe("fail");
  });

  it("does not mark paused snapshots stale only because time advances", () => {
    const paused = summary({
      status: "paused",
      workerStatus: "offline",
      lastHeartbeatAt: "2026-07-30T10:00:00.000Z",
      leaseOwner: null,
      leaseExpiresAt: null,
      lastSnapshotAt: "2026-07-30T10:00:00.000Z"
    });
    const health = createAdminInstanceRuntimeHealth({
      summary: paused,
      generatedAt: NOW,
      observation: {
        ...matchingRuntimeOwnership(),
        canonicalTickRateMs: 10_000,
        instanceLastTick: 42,
        instanceLastSnapshotAt: paused.lastSnapshotAt,
        instanceLastErrorCode: null,
        lastAppliedCommandAt: "2026-07-30T09:59:00.000Z",
        lastStartedAt: "2026-07-30T09:00:00.000Z"
      },
      snapshotStorage: snapshotStorage(),
      tickProgress: tickProgress()
    });

    expect(isLifecycleSnapshotStale({
      status: "paused",
      snapshotAt: paused.lastSnapshotAt,
      generatedAt: NOW,
      freshnessThresholdMs: 30_000
    })).toBe(false);
    expect(health.runtimeActive.status).toBe("not-applicable");
    expect(health.tickAdvancing.status).toBe("not-applicable");
    expect(health.snapshotCurrent).toMatchObject({
      status: "pass",
      reasonCode: "snapshot-retained-paused"
    });
    expect(health.commandsAccepted.status).toBe("not-applicable");
  });

  it("requires a terminal checkpoint for a stopped server without requiring fresh ticks", () => {
    const stopped = summary({
      status: "stopped",
      workerStatus: "no-worker",
      leaseOwner: null,
      leaseExpiresAt: null,
      lastSnapshotAt: "2026-07-30T10:00:00.000Z"
    });
    const input = {
      summary: stopped,
      generatedAt: NOW,
      observation: {
        ...matchingRuntimeOwnership(),
        canonicalTickRateMs: 10_000,
        instanceLastTick: 42,
        instanceLastSnapshotAt: stopped.lastSnapshotAt,
        instanceLastErrorCode: null,
        lastAppliedCommandAt: null,
        lastStartedAt: "2026-07-30T09:00:00.000Z"
      },
      snapshotStorage: snapshotStorage(),
      tickProgress: tickProgress()
    };

    const health = createAdminInstanceRuntimeHealth(input);
    expect(health.snapshotCurrent).toMatchObject({
      status: "pass",
      reasonCode: "terminal-checkpoint-present"
    });
    expect(health.runtimeActive.status).toBe("not-applicable");
    expect(health.tickAdvancing).toMatchObject({
      status: "not-applicable",
      reasonCode: "tick-not-required-stopped"
    });
    expect(health.commandsAccepted.status).toBe("not-applicable");
    expect(createAdminInstanceRuntimeHealth({
      ...input,
      snapshotStorage: { ...input.snapshotStorage, terminalCheckpointCount: 0 }
    }).snapshotCurrent).toMatchObject({
      status: "fail",
      reasonCode: "terminal-checkpoint-missing"
    });
  });

  it("keeps command acceptance pending until a durable applied result is observed", () => {
    const health = createAdminInstanceRuntimeHealth({
      summary: summary(),
      generatedAt: NOW,
      observation: {
        ...matchingRuntimeOwnership(),
        canonicalTickRateMs: 10_000,
        instanceLastTick: 42,
        instanceLastSnapshotAt: "2026-07-31T09:59:50.000Z",
        instanceLastErrorCode: null,
        lastAppliedCommandAt: null,
        lastStartedAt: "2026-07-31T09:55:00.000Z"
      },
      snapshotStorage: snapshotStorage(),
      tickProgress: tickProgress()
    });

    expect(health.commandsAccepted).toEqual({
      status: "pending",
      reasonCode: "commands-not-yet-observed",
      observedAt: null
    });
  });

  it("expires command acceptance evidence instead of keeping an old applied result green", () => {
    const health = createAdminInstanceRuntimeHealth({
      summary: summary(),
      generatedAt: NOW,
      observation: {
        ...matchingRuntimeOwnership(),
        canonicalTickRateMs: 10_000,
        instanceLastTick: 42,
        instanceLastSnapshotAt: "2026-07-31T09:59:50.000Z",
        instanceLastErrorCode: null,
        lastAppliedCommandAt: "2026-07-31T09:59:19.999Z",
        lastStartedAt: "2026-07-31T09:55:00.000Z"
      },
      snapshotStorage: snapshotStorage(),
      tickProgress: tickProgress()
    });

    expect(health.commandsAccepted).toEqual({
      status: "pending",
      reasonCode: "applied-command-observation-stale",
      observedAt: "2026-07-31T09:59:19.999Z"
    });
  });

  it("does not reuse command evidence from before the current server start", () => {
    const health = createAdminInstanceRuntimeHealth({
      summary: summary(),
      generatedAt: NOW,
      observation: {
        ...matchingRuntimeOwnership(),
        canonicalTickRateMs: 10_000,
        instanceLastTick: 42,
        instanceLastSnapshotAt: "2026-07-31T09:59:50.000Z",
        instanceLastErrorCode: null,
        lastAppliedCommandAt: "2026-07-31T09:59:55.000Z",
        lastStartedAt: "2026-07-31T09:59:56.000Z"
      },
      snapshotStorage: snapshotStorage(),
      tickProgress: tickProgress()
    });

    expect(health.commandsAccepted).toEqual({
      status: "pending",
      reasonCode: "commands-not-observed-since-start",
      observedAt: "2026-07-31T09:59:55.000Z"
    });
  });

  it("keeps a healthy running instance pending until two-sample tick progress exists", () => {
    const health = createAdminInstanceRuntimeHealth({
      summary: summary(),
      generatedAt: NOW,
      observation: {
        ...matchingRuntimeOwnership(),
        canonicalTickRateMs: 10_000,
        instanceLastTick: 42,
        instanceLastSnapshotAt: "2026-07-31T09:59:50.000Z",
        instanceLastErrorCode: null,
        lastAppliedCommandAt: null,
        lastStartedAt: "2026-07-31T09:55:00.000Z"
      },
      snapshotStorage: snapshotStorage(),
      tickProgress: tickProgress({
        status: "pending",
        reasonCode: "tick-observation-first-sample"
      })
    });

    expect(health.runtimeActive.status).toBe("pass");
    expect(health.snapshotCurrent.status).toBe("pass");
    expect(health.tickAdvancing).toEqual({
      status: "pending",
      reasonCode: "tick-observation-first-sample",
      observedAt: "2026-07-31T09:59:50.000Z"
    });
  });

  it("uses a tick proof window that tolerates the canonical admin poll cadence", () => {
    expect(resolveAdminTickObservationWindowMs("free", 10_000)).toBe(40_000);
    expect(resolveAdminTickObservationWindowMs("free", 1_000)).toBe(35_000);
    expect(resolveAdminCommandObservationWindowMs("free", 10_000)).toBe(40_000);
    expect(resolveAdminCommandObservationWindowMs("free", 1_000)).toBe(35_000);
  });

  it("treats archived runtime and tick checks as not applicable", () => {
    const archived = createAdminInstanceRuntimeHealth({
      summary: summary({
        status: "archived",
        workerStatus: "offline",
        leaseOwner: null,
        leaseExpiresAt: null,
        lastSnapshotAt: "2026-07-30T10:00:00.000Z"
      }),
      generatedAt: NOW,
      observation: {
        ...matchingRuntimeOwnership(),
        canonicalTickRateMs: 10_000,
        instanceLastTick: 42,
        instanceLastSnapshotAt: "2026-07-30T10:00:00.000Z",
        instanceLastErrorCode: null,
        lastAppliedCommandAt: null,
        lastStartedAt: "2026-07-30T09:00:00.000Z"
      },
      snapshotStorage: snapshotStorage(),
      tickProgress: tickProgress({
        status: "pending",
        reasonCode: "tick-observation-not-required"
      })
    });

    expect(archived.runtimeActive.status).toBe("not-applicable");
    expect(archived.tickAdvancing).toMatchObject({
      status: "not-applicable",
      reasonCode: "tick-not-required-archived"
    });
    expect(archived.snapshotCurrent.status).toBe("not-applicable");
    expect(archived.commandsAccepted.status).toBe("not-applicable");
  });
});

const summary = (
  overrides: Partial<AdminInstanceSummaryView> = {}
): AdminInstanceSummaryView => ({
  serverInstanceId: "instance:free:health",
  displayName: "Health Test",
  mode: "free",
  region: "eu-central",
  capacity: 20,
  joinPolicy: "closed",
  status: "running",
  currentTick: 42,
  stateVersion: 77,
  playerCount: 2,
  workerStatus: "live",
  lastHeartbeatAt: "2026-07-31T09:59:55.000Z",
  leaseOwner: "worker:health",
  leaseExpiresAt: "2026-07-31T10:00:15.000Z",
  lastSnapshotAt: "2026-07-31T09:59:50.000Z",
  snapshotStale: false,
  lastErrorAt: null,
  freshness: {
    serverInstanceId: "instance:free:health",
    generatedAt: NOW,
    source: "durable-snapshot",
    dataAsOf: "2026-07-31T09:59:50.000Z",
    lastSnapshotAt: "2026-07-31T09:59:50.000Z",
    lastHeartbeatAt: "2026-07-31T09:59:55.000Z",
    stale: false,
    staleReason: null
  },
  ...overrides
});

const snapshotStorage = () => ({
  lastCheckpointAt: "2026-07-31T09:59:00.000Z",
  rollingCheckpointCount: 3,
  lifecycleCheckpointCount: 1,
  terminalCheckpointCount: 1,
  lastCleanupAt: "2026-07-31T09:58:00.000Z",
  lastCleanupStatus: "success" as const
});

const matchingRuntimeOwnership = () => ({
  instanceWorkerId: "worker:health",
  instanceWorkerIncarnationId: "worker-incarnation:health",
  runtimeLeaseIncarnationId: "worker-incarnation:health"
});

const tickProgress = (
  overrides: Partial<{
    status: "pass" | "fail" | "pending";
    reasonCode: string;
    observedAt: string | null;
  }> = {}
) => ({
  status: "pass" as const,
  reasonCode: "tick-advance-two-sample",
  observedAt: "2026-07-31T09:59:50.000Z",
  ...overrides
});

import { describe, expect, it } from "vitest";
import type { HostedActionRequestRecord, HostedServerRecord } from "../../apps/server/src/admin/hosted";
import { resolveHostedLifecycleActionCompletion } from "../../apps/server/src/admin/hosted/hosted-lifecycle-action-completion";

const NOW = "2026-07-20T16:00:00.000Z";
const CLOSE = "2026-07-20T17:00:00.000Z";

describe("hosted lifecycle action completion", () => {
  it("computes a scheduled close exactly sixty minutes after the admin supplied opening", () => {
    const result = decide(server({ registrationOpensAt: null, registrationClosesAt: null,
      registrationScheduleVersion: 0 }), action("schedule-registration", { registrationOpensAt: CLOSE }));
    expect(result).toMatchObject({ kind: "accepted", server: {
      registrationOpensAt: CLOSE,
      registrationClosesAt: "2026-07-20T18:00:00.000Z",
      registrationScheduleVersion: 1,
      joinPolicy: "closed"
    }, auditActions: ["registration-scheduled"] });
  });

  it("uses authoritative now for open-now and refuses to mutate an active window", () => {
    expect(decide(server({ registrationOpensAt: null, registrationClosesAt: null,
      registrationScheduleVersion: 0 }), action("open-registration-now"))).toMatchObject({
      kind: "accepted",
      server: { registrationOpensAt: NOW, registrationClosesAt: CLOSE, joinPolicy: "open" }
    });
    expect(decide(server(), action("schedule-registration", {
      registrationOpensAt: "2026-07-20T18:00:00.000Z"
    }))).toEqual({ kind: "rejected", errorCode: "SERVER_REGISTRATION_WINDOW_IMMUTABLE" });
  });

  it("cancels only before opensAt", () => {
    const scheduled = server({
      registrationOpensAt: "2026-07-20T16:30:00.000Z",
      registrationClosesAt: "2026-07-20T17:30:00.000Z"
    });
    expect(decide(scheduled, action("cancel-registration"))).toMatchObject({
      kind: "accepted",
      server: { registrationOpensAt: null, registrationClosesAt: null, joinPolicy: "closed" }
    });
    expect(decide(server(), action("cancel-registration"))).toEqual({
      kind: "rejected", errorCode: "SERVER_REGISTRATION_WINDOW_IMMUTABLE"
    });
  });

  it("freezes an emergency close without rewriting the scheduled closesAt", () => {
    const result = decide(server({ lastStartedAt: "2026-07-20T15:30:00.000Z" }),
      action("close-registration-now"), 3, 3);
    expect(result).toMatchObject({ kind: "accepted", server: {
      registrationClosesAt: CLOSE,
      registrationClosedAt: NOW,
      registrationBaselinePlayers: 3,
      effectiveFinalLockdownTrigger: 2,
      effectiveFirstEliminationTick: 6_120,
      joinPolicy: "closed"
    }, auditActions: ["registration-closed-early", "effective-lockdown-trigger-frozen"] });
  });

  it("allows control template freeze with elimination disabled", () => {
    const result = decide(server({ serverTemplate: "control", canonicalFirstEliminationTick: null,
      canonicalTickRateMs: null }), action("close-registration-now"), 2, 2);
    expect(result).toMatchObject({ kind: "accepted", server: {
      effectiveFinalLockdownTrigger: 1,
      effectiveFirstEliminationTick: null
    } });
  });

  it("rejects start with one ready player and accepts exactly two", () => {
    expect(decide(server(), action("start"), 1)).toEqual({
      kind: "rejected", errorCode: "SERVER_START_MINIMUM_PLAYERS_NOT_MET"
    });
    expect(decide(server(), action("start"), 2)).toMatchObject({
      kind: "accepted",
      server: { status: "running", joinPolicy: "open", lastStartedAt: NOW },
      auditActions: ["server-started"]
    });
  });

  it("atomically freezes the normal close during an immediate post-window start", () => {
    const atClose = "2026-07-20T17:00:00.000Z";
    expect(decide(server(), action("start"), 2, 2, atClose)).toMatchObject({
      kind: "accepted",
      server: { status: "running", joinPolicy: "closed", registrationClosedAt: atClose,
        registrationBaselinePlayers: 2, effectiveFinalLockdownTrigger: 1 },
      auditActions: ["registration-closed-automatically", "effective-lockdown-trigger-frozen", "server-started"]
    });
    expect(decide(server({ registrationClosedAt: CLOSE, registrationBaselinePlayers: 2,
      effectiveFinalLockdownTrigger: 1, effectiveFirstEliminationTick: 5_760 }),
    action("start"), 2, undefined, atClose)).toMatchObject({
      kind: "accepted", server: { status: "running", joinPolicy: "closed" }
    });
  });

  it("does not let legacy open-joins create an infinite registration window", () => {
    expect(decide(server({ registrationOpensAt: null, registrationClosesAt: null }),
      action("open-joins"))).toEqual({
      kind: "rejected", errorCode: "SERVER_REGISTRATION_NOT_OPEN"
    });
  });
});

const decide = (
  hosted: HostedServerRecord,
  request: HostedActionRequestRecord,
  readyPlayers = 0,
  baselinePlayers?: number,
  authoritativeNow = NOW
) => resolveHostedLifecycleActionCompletion({ server: hosted, request, authoritativeNow, readyPlayers,
  registrationBaselinePlayers: baselinePlayers });

const action = (
  actionName: HostedActionRequestRecord["action"],
  actionPayload: HostedActionRequestRecord["actionPayload"] = {}
): HostedActionRequestRecord => ({
  actionRequestId: `action:${actionName}`,
  serverInstanceId: "instance:lifecycle",
  adminUserId: "admin:owner",
  action: actionName,
  actionPayload,
  reason: "Test lifecycle action.",
  expectedVersion: 1,
  status: "processing",
  claimedByWorkerId: "worker:test",
  claimedUntil: "2026-07-20T18:00:00.000Z",
  lastErrorCode: null,
  createdAt: NOW,
  updatedAt: NOW,
  version: 2
});

const server = (overrides: Partial<HostedServerRecord> = {}): HostedServerRecord => ({
  serverInstanceId: "instance:lifecycle",
  mode: "free",
  serverTemplate: "full",
  displayName: "Lifecycle",
  region: "eu-central",
  capacity: 20,
  status: "lobby",
  joinPolicy: "open",
  provisioningState: "ready",
  minimumReadyPlayersToStart: 2,
  registrationWindowMinutes: 60,
  registrationScheduleVersion: 1,
  registrationOpensAt: NOW,
  registrationClosesAt: CLOSE,
  registrationClosedAt: null,
  registrationBaselinePlayers: null,
  canonicalFinalLockdownTrigger: 8,
  canonicalFirstEliminationTick: 5_760,
  canonicalTickRateMs: 5_000,
  effectiveFinalLockdownTrigger: null,
  effectiveFirstEliminationTick: null,
  worldSeed: "lifecycle-seed",
  configVersion: 1,
  mapComposition: { downtown: 8, commercial: 40, residential: 38, industrial: 38, park: 37 },
  initialSnapshotId: "snapshot:initial",
  currentSnapshotId: "snapshot:initial",
  runtimeLeaseOwnerId: "worker:test",
  runtimeLeaseExpiresAt: "2026-07-20T18:00:00.000Z",
  lastWorkerHeartbeatAt: NOW,
  lastStartedAt: null,
  lastPausedAt: null,
  lastStoppedAt: null,
  lastErrorCode: null,
  createdByAdminUserId: "admin:owner",
  createdAt: NOW,
  updatedAt: NOW,
  version: 1,
  ...overrides
});

import { copyFreeHostedStartingPlayerState } from "@empire/game-config";
import { describe, expect, it } from "vitest";
import { loadHostedAdminServerViews } from "../../apps/server/src/admin/hosted/hosted-admin-server-view-loader";
import type {
  HostedControlPlaneRepository,
  HostedServerRecord
} from "../../apps/server/src/admin/hosted/hosted-control-plane-repository";

const GENERATED_AT = new Date("2026-07-31T10:00:00.000Z");

describe("hosted admin server view loader", () => {
  it("loads every historical server through one bulk stats request", async () => {
    const servers = Array.from({ length: 120 }, (_, index) => server(index));
    let bulkCalls = 0;
    const repository = repositoryWithStats(async (serverInstanceIds) => {
      bulkCalls += 1;
      expect(serverInstanceIds).toEqual(
        servers.map((entry) => entry.serverInstanceId)
      );
      return serverInstanceIds.map((serverInstanceId) => {
        const isLast = serverInstanceId === servers.at(-1)!.serverInstanceId;
        return {
          serverInstanceId,
          committedPlayers: isLast ? 4 : 0,
          reservedSlots: 0,
          readyPlayers: isLast ? 4 : 0
        };
      });
    });

    const views = await loadHostedAdminServerViews(repository, servers, GENERATED_AT);

    expect(views).toHaveLength(120);
    expect(views.at(-1)).toMatchObject({
      serverInstanceId: servers.at(-1)!.serverInstanceId,
      committedPlayers: 4,
      readyPlayers: 4,
      canStart: true
    });
    expect(bulkCalls).toBe(1);
  });

  it("fails closed instead of rendering database errors as zero players", async () => {
    const servers = [server(0)];
    const repository = repositoryWithStats(async () => {
      throw new Error("connection acquisition timeout");
    });

    await expect(
      loadHostedAdminServerViews(repository, servers, GENERATED_AT)
    ).rejects.toThrow("connection acquisition timeout");
  });

  it("fails closed when bulk stats omit a requested server", async () => {
    const servers = [server(0), server(1)];
    const repository = repositoryWithStats(async () => [{
      serverInstanceId: servers[0]!.serverInstanceId,
      committedPlayers: 0,
      reservedSlots: 0,
      readyPlayers: 0
    }]);

    await expect(
      loadHostedAdminServerViews(repository, servers, GENERATED_AT)
    ).rejects.toThrow(`Admin stats missing for hosted server ${servers[1]!.serverInstanceId}.`);
  });
});

const repositoryWithStats = (
  load: HostedControlPlaneRepository["getAdminServerStats"]
): Pick<HostedControlPlaneRepository, "getAdminServerStats"> => ({
  getAdminServerStats: load
});

const server = (index: number): HostedServerRecord => ({
  serverInstanceId: `instance:test:${String(index).padStart(3, "0")}`,
  mode: "free",
  serverTemplate: "control",
  displayName: `Server ${index}`,
  region: "eu-central",
  capacity: 4,
  status: "lobby",
  joinPolicy: "open",
  provisioningState: "ready",
  minimumReadyPlayersToStart: 1,
  registrationWindowMinutes: 60,
  registrationScheduleVersion: 1,
  registrationOpensAt: "2026-07-31T09:00:00.000Z",
  registrationClosesAt: "2026-07-31T11:00:00.000Z",
  registrationClosedAt: null,
  registrationBaselinePlayers: null,
  canonicalFinalLockdownTrigger: null,
  canonicalFirstEliminationTick: null,
  canonicalTickRateMs: null,
  effectiveFinalLockdownTrigger: null,
  effectiveFirstEliminationTick: null,
  worldSeed: `seed:${index}`,
  configVersion: 1,
  mapComposition: {
    downtown: 8,
    commercial: 40,
    residential: 38,
    industrial: 38,
    park: 37
  },
  startingPlayerState: copyFreeHostedStartingPlayerState(),
  initialSnapshotId: `snapshot:${index}`,
  currentSnapshotId: `snapshot:${index}`,
  runtimeLeaseOwnerId: "worker:test",
  runtimeLeaseExpiresAt: "2026-07-31T10:01:00.000Z",
  lastWorkerHeartbeatAt: "2026-07-31T10:00:00.000Z",
  lastStartedAt: null,
  lastPausedAt: null,
  lastStoppedAt: null,
  lastErrorCode: null,
  createdByAdminUserId: "admin:owner",
  createdAt: "2026-07-31T09:00:00.000Z",
  updatedAt: "2026-07-31T10:00:00.000Z",
  version: 1
});

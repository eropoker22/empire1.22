import { copyFreeHostedStartingPlayerState } from "@empire/game-config";
import { describe, expect, it } from "vitest";
import { loadHostedAdminServerViews } from "../../apps/server/src/admin/hosted/hosted-admin-server-view-loader";
import type {
  HostedControlPlaneRepository,
  HostedServerRecord
} from "../../apps/server/src/admin/hosted/hosted-control-plane-repository";

const GENERATED_AT = new Date("2026-07-31T10:00:00.000Z");

describe("hosted admin server view loader", () => {
  it("bounds PostgreSQL-shaped fan-out while preserving the last server counts", async () => {
    let activeQueries = 0;
    let maximumActiveQueries = 0;
    const servers = Array.from({ length: 120 }, (_, index) => server(index));
    const repository = repositoryWithStats(async (serverInstanceId, kind) => {
      activeQueries += 1;
      maximumActiveQueries = Math.max(maximumActiveQueries, activeQueries);
      await new Promise((resolve) => setTimeout(resolve, 2));
      activeQueries -= 1;
      const isLast = serverInstanceId === servers.at(-1)!.serverInstanceId;
      return kind === "capacity"
        ? { committedPlayers: isLast ? 4 : 0, reservedSlots: 0 }
        : Array.from({ length: isLast ? 4 : 0 }, (_, index) => ({
            membershipId: `membership:${index}`,
            playerId: `player:${index}`,
            reservedSpawnDistrictId: `district:${index}`
          }));
    });

    const views = await loadHostedAdminServerViews(repository, servers, GENERATED_AT);

    expect(views).toHaveLength(120);
    expect(views.at(-1)).toMatchObject({
      serverInstanceId: servers.at(-1)!.serverInstanceId,
      committedPlayers: 4,
      readyPlayers: 4,
      canStart: true
    });
    expect(maximumActiveQueries).toBeGreaterThan(1);
    expect(maximumActiveQueries).toBeLessThanOrEqual(4);
  });

  it("fails closed instead of rendering database errors as zero players", async () => {
    const servers = [server(0)];
    const repository = repositoryWithStats(async (_serverInstanceId, kind) => {
      if (kind === "capacity") throw new Error("connection acquisition timeout");
      return [];
    });

    await expect(
      loadHostedAdminServerViews(repository, servers, GENERATED_AT)
    ).rejects.toThrow("connection acquisition timeout");
  });
});

type StatsResult =
  | { committedPlayers: number; reservedSlots: number }
  | Array<{
      membershipId: string;
      playerId: string;
      reservedSpawnDistrictId: string;
    }>;

const repositoryWithStats = (
  load: (serverInstanceId: string, kind: "capacity" | "ready") => Promise<StatsResult>
): Pick<HostedControlPlaneRepository, "getJoinCapacity" | "listReadyMemberships"> => ({
  getJoinCapacity: async (serverInstanceId) => {
    const result = await load(serverInstanceId, "capacity");
    if (Array.isArray(result)) throw new Error("Expected capacity stats.");
    return result;
  },
  listReadyMemberships: async (serverInstanceId) => {
    const result = await load(serverInstanceId, "ready");
    if (!Array.isArray(result)) throw new Error("Expected ready memberships.");
    return result;
  }
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

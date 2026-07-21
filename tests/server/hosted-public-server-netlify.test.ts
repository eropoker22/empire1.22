import { describe, expect, it } from "vitest";
import { createInMemoryGameplaySessionService } from "../../apps/server/src/auth";
import {
  createInMemoryHostedControlPlaneRepository,
  type HostedReadyMembershipRecord,
  type HostedServerRecord
} from "../../apps/server/src/admin/hosted";
import {
  createInMemoryAdminDurableRepositories,
  type AdminDurableRepositories
} from "../../apps/server/src/admin/read-only";
import { createServerApp } from "../../apps/server/src/app";
import { handlePublicServerMatchmakingReserve } from "../../apps/server/src/netlify/public-server-matchmaking-netlify";
import { createPublicServerListResponse } from "../../apps/server/src/netlify/public-server-list-netlify";
import { listHostedPublicServerCandidates } from "../../apps/server/src/netlify/hosted-public-server-read-model";
import { createAdminReadOnlySeed } from "../fixtures/admin-read-only-fixture";

describe("hosted public server matchmaking", () => {
  it("uses the durable hosted registry instead of process-local public servers in production", async () => {
    const now = new Date();
    const id = "hosted:free:durable";
    const seed = createAdminReadOnlySeed();
    const summary = {
      ...seed.instances![0]!,
      serverInstanceId: id,
      displayName: "Durable Hosted",
      playerCount: 3,
      workerStatus: "live" as const,
      lastHeartbeatAt: now.toISOString(),
      freshness: {
        ...seed.instances![0]!.freshness,
        serverInstanceId: id,
        generatedAt: now.toISOString(),
        dataAsOf: now.toISOString(),
        lastHeartbeatAt: now.toISOString(),
        stale: false,
        staleReason: null
      }
    };
    const memory = createInMemoryAdminDurableRepositories({ instances: [summary] });
    const readyMembership: HostedReadyMembershipRecord = {
      membershipId: "membership:ready",
      playerId: "player:ready",
      reservedSpawnDistrictId: "district:1"
    };
    const repositories: AdminDurableRepositories = {
      ...memory,
      kind: "postgres",
      hosted: createInMemoryHostedControlPlaneRepository({
        servers: [hostedServer(id, now)],
        readyMembershipsByServerId: { [id]: [readyMembership] }
      })
    };
    const server = createServerApp({
      accountIdentityProvider: {
        productionReady: true,
        resolve: () => ({ accountId: "account:hosted", provider: "production" })
      },
      gameplaySessionService: createInMemoryGameplaySessionService({ productionReady: true })
    });

    const response = await handlePublicServerMatchmakingReserve(
      server,
      "POST",
      { mode: "free", preferredServerInstanceId: id },
      { "idempotency-key": "hosted-public-pending" },
      { NODE_ENV: "production" },
      repositories
    );
    const body = JSON.parse(response.body) as {
      accepted: boolean;
      reservation: { serverInstanceId: string; status: string; joinTicket: string | null };
      errors: Array<{ code: string }>;
    };

    expect(body.accepted).toBe(false);
    expect(body.reservation.serverInstanceId).toBe(id);
    expect(body.reservation.status).toBe("reserved");
    expect(body.reservation.joinTicket).toBeNull();
    expect(body.errors[0]?.code).toBe("matchmaking.preparing");

    const listResponse = await createPublicServerListResponse(createServerApp(), { NODE_ENV: "production" }, repositories);
    const listBody = JSON.parse(listResponse.body) as { servers: Array<{
      serverInstanceId: string;
      playerCount: number;
      readyPlayers: number;
      canStart: boolean;
    }> };
    expect(listBody.servers).toContainEqual(expect.objectContaining({
      serverInstanceId: id,
      playerCount: 3,
      readyPlayers: 1,
      canStart: false
    }));
  });

  it("lists scheduled and closed servers but excludes them from matchmaking candidates", async () => {
    const now = new Date();
    const scheduledId = "hosted:free:scheduled";
    const closedId = "hosted:free:closed";
    const seed = createAdminReadOnlySeed();
    const summaries = [scheduledId, closedId].map((serverInstanceId) => ({
      ...seed.instances![0]!,
      serverInstanceId,
      displayName: serverInstanceId,
      workerStatus: "live" as const,
      lastHeartbeatAt: now.toISOString()
    }));
    const memory = createInMemoryAdminDurableRepositories({ instances: summaries });
    const repositories: AdminDurableRepositories = {
      ...memory,
      kind: "postgres",
      hosted: createInMemoryHostedControlPlaneRepository({ servers: [
        hostedServer(scheduledId, now, {
          registrationOpensAt: new Date(now.getTime() + 300_000).toISOString(),
          registrationClosesAt: new Date(now.getTime() + 3_900_000).toISOString()
        }),
        hostedServer(closedId, now, {
          registrationOpensAt: new Date(now.getTime() - 3_900_000).toISOString(),
          registrationClosesAt: new Date(now.getTime() - 300_000).toISOString(),
          registrationClosedAt: new Date(now.getTime() - 300_000).toISOString(),
          registrationBaselinePlayers: 2,
          effectiveFinalLockdownTrigger: 1,
          effectiveFirstEliminationTick: 5_760
        })
      ] })
    };
    const response = await createPublicServerListResponse(createServerApp(), { NODE_ENV: "production" }, repositories);
    const body = JSON.parse(response.body) as { servers: Array<{
      serverInstanceId: string;
      registrationState: string;
      joinable: boolean;
      disabledReason: string | null;
    }> };

    expect(body.servers).toEqual(expect.arrayContaining([
      expect.objectContaining({ serverInstanceId: scheduledId, registrationState: "scheduled",
        joinable: false, disabledReason: "SERVER_REGISTRATION_NOT_OPEN" }),
      expect.objectContaining({ serverInstanceId: closedId, registrationState: "closed",
        joinable: false, disabledReason: "SERVER_REGISTRATION_CLOSED" })
    ]));
    expect(await listHostedPublicServerCandidates(repositories, now)).toEqual([]);
  });

  it("returns the registration reason instead of reserving a scheduled preferred server", async () => {
    const now = new Date();
    const id = "hosted:free:not-open";
    const seed = createAdminReadOnlySeed();
    const summary = {
      ...seed.instances![0]!,
      serverInstanceId: id,
      workerStatus: "live" as const,
      lastHeartbeatAt: now.toISOString()
    };
    const memory = createInMemoryAdminDurableRepositories({ instances: [summary] });
    const repositories: AdminDurableRepositories = {
      ...memory,
      kind: "postgres",
      hosted: createInMemoryHostedControlPlaneRepository({ servers: [hostedServer(id, now, {
        registrationOpensAt: new Date(now.getTime() + 300_000).toISOString(),
        registrationClosesAt: new Date(now.getTime() + 3_900_000).toISOString()
      })] })
    };
    const server = createServerApp({
      accountIdentityProvider: {
        productionReady: true,
        resolve: () => ({ accountId: "account:scheduled", provider: "production" })
      }
    });

    const response = await handlePublicServerMatchmakingReserve(server, "POST", {
      mode: "free",
      preferredServerInstanceId: id
    }, { "idempotency-key": "scheduled-server" }, { NODE_ENV: "production" }, repositories);
    const body = JSON.parse(response.body) as { accepted: boolean; reservation: unknown; errors: Array<{ code: string }> };

    expect(body).toMatchObject({
      accepted: false,
      reservation: null,
      errors: [{ code: "SERVER_REGISTRATION_NOT_OPEN" }]
    });
  });
});

const hostedServer = (
  serverInstanceId: string,
  now: Date,
  overrides: Partial<HostedServerRecord> = {}
): HostedServerRecord => Object.assign({
  serverInstanceId,
  mode: "free",
  serverTemplate: "full",
  displayName: "Durable Hosted",
  region: "eu-central",
  capacity: 20,
  status: "lobby",
  joinPolicy: "closed",
  provisioningState: "ready",
  minimumReadyPlayersToStart: 2,
  registrationWindowMinutes: 60,
  registrationScheduleVersion: 1,
  registrationOpensAt: new Date(now.getTime() - 30 * 60_000).toISOString(),
  registrationClosesAt: new Date(now.getTime() + 30 * 60_000).toISOString(),
  registrationClosedAt: null,
  registrationBaselinePlayers: null,
  canonicalFinalLockdownTrigger: 8,
  canonicalFirstEliminationTick: 5_760,
  canonicalTickRateMs: 5_000,
  effectiveFinalLockdownTrigger: null,
  effectiveFirstEliminationTick: null,
  worldSeed: "test-world-seed",
  configVersion: 1,
  mapComposition: { downtown: 8, commercial: 40, residential: 38, industrial: 38, park: 37 },
  initialSnapshotId: "snapshot:initial",
  currentSnapshotId: "snapshot:initial",
  runtimeLeaseOwnerId: "worker:test",
  runtimeLeaseExpiresAt: new Date(now.getTime() + 30_000).toISOString(),
  lastWorkerHeartbeatAt: now.toISOString(),
  lastStartedAt: null,
  lastPausedAt: null,
  lastStoppedAt: null,
  lastErrorCode: null,
  createdByAdminUserId: "admin-user:test",
  createdAt: now.toISOString(),
  updatedAt: now.toISOString(),
  version: 1
} satisfies HostedServerRecord, overrides);

import { describe, expect, it } from "vitest";
import { createInMemoryGameplaySessionService } from "../../apps/server/src/auth";
import {
  createInMemoryHostedControlPlaneRepository,
  type HostedServerRecord
} from "../../apps/server/src/admin/hosted";
import {
  createInMemoryAdminDurableRepositories,
  type AdminDurableRepositories
} from "../../apps/server/src/admin/read-only";
import { createServerApp } from "../../apps/server/src/app";
import { handlePublicServerMatchmakingReserve } from "../../apps/server/src/netlify/public-server-matchmaking-netlify";
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
    const repositories: AdminDurableRepositories = {
      ...memory,
      kind: "postgres",
      hosted: createInMemoryHostedControlPlaneRepository({ servers: [hostedServer(id, now)] })
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
      {},
      { NODE_ENV: "production" },
      repositories
    );
    const body = JSON.parse(response.body) as { accepted: boolean; reservation: { serverInstanceId: string; joinTicket: string } };

    expect(body.accepted).toBe(true);
    expect(body.reservation.serverInstanceId).toBe(id);
    expect(body.reservation.joinTicket).toMatch(/^join:/);
  });
});

const hostedServer = (serverInstanceId: string, now: Date): HostedServerRecord => ({
  serverInstanceId,
  mode: "free",
  displayName: "Durable Hosted",
  region: "eu-central",
  capacity: 20,
  status: "lobby",
  joinPolicy: "open",
  provisioningState: "ready",
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
});

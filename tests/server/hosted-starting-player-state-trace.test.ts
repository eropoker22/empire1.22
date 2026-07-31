import { describe, expect, it } from "vitest";
import { createPlayerView } from "@empire/game-core";
import { FREE_HOSTED_STARTING_MATERIAL_IDS } from "@empire/game-config";
import type {
  AdminCreateServerRequestView,
  AdminSessionView,
  HostedStartingPlayerStateView
} from "@empire/shared-types";
import { createHostedControlPlaneService } from "../../apps/server/src/admin/hosted";
import { createInMemoryAdminDurableRepositories } from "../../apps/server/src/admin/read-only";
import { ensureGameplaySliceMembershipInState } from "../../apps/server/src/bootstrap/gameplay-slice-session-membership";
import { ServerInstanceManager } from "../../apps/server/src/runtime";
import { createInstanceSnapshot } from "../../apps/server/src/runtime/persistence";

const NOW = new Date("2026-07-31T10:00:00.000Z");
const FLAGS = {
  NODE_ENV: "test",
  EMPIRE_ADMIN_WRITES_ENABLED: "true",
  EMPIRE_HOSTED_CONTROL_PLANE_ENABLED: "true",
  EMPIRE_SERVER_PROVISIONING_ENABLED: "true",
  EMPIRE_BUILD_SHA: "starting-state-trace"
};

describe("hosted starting player state full trace", () => {
  it("preserves configured values through server record, membership, snapshot and read model", async () => {
    const repositories = createInMemoryAdminDurableRepositories();
    await repositories.hosted.writeWorkerHeartbeat({
      workerId: "worker:starting-state-trace",
      workerIncarnationId: "worker-incarnation:starting-state-trace",
      region: "eu-central",
      startedAt: NOW.toISOString(),
      lastHeartbeatAt: NOW.toISOString(),
      buildSha: "starting-state-trace",
      status: "online"
    });
    const service = createHostedControlPlaneService({
      repositories,
      environment: FLAGS,
      now: () => NOW,
      allowInMemoryForTests: true
    });
    const configured = distinctiveStartingPlayerState();
    const created = await service.createServer({
      session: ownerSession(),
      payload: createRequest(configured),
      idempotencyKey: "starting-state-full-trace",
      correlationId: "starting-state-full-trace"
    });
    expect(created.accepted).toBe(true);
    if (!created.accepted) return;

    const server = await repositories.hosted.getServer(created.data.server.serverInstanceId);
    expect(server?.startingPlayerState).toEqual(configured);
    expect(Object.keys(server!.startingPlayerState!.materials)).toEqual(FREE_HOSTED_STARTING_MATERIAL_IDS);

    const manager = new ServerInstanceManager();
    const runtime = manager.createInstance(server!.serverInstanceId, server!.mode);
    const playerId = "player:starting-state-full-trace";
    const membership = ensureGameplaySliceMembershipInState(runtime.state, {
      serverInstanceId: server!.serverInstanceId,
      playerId,
      factionId: "mafian",
      mode: server!.mode,
      startingPlayerState: server!.startingPlayerState
    });
    expect(membership.accepted).toBe(true);
    runtime.state = membership.state;

    const player = runtime.state.playersById[playerId]!;
    const runtimeBalances = runtime.state.resourceStatesById[player.resourceStateId]!.balances;
    expect(pickCanonicalMaterials(runtimeBalances)).toEqual(configured.materials);
    expect(runtimeBalances.cash).toBe(configured.cleanCash);
    expect(runtimeBalances["dirty-cash"]).toBe(configured.dirtyCash);
    expect(player.population).toBe(configured.population);
    expect(runtime.state.playerSpyOperationStatesByPlayerId![playerId]!.slots).toHaveLength(configured.spySlots);

    const snapshot = createInstanceSnapshot(runtime);
    await manager.getPersistenceRepositories().snapshotRepository.saveRecoveryHead(snapshot);
    const recovered = await manager.getPersistenceRepositories().snapshotRepository
      .loadRecoveryHead(server!.serverInstanceId);
    expect(recovered).not.toBeNull();
    const recoveredPlayer = recovered!.state.playersById[playerId]!;
    const recoveredBalances = recovered!.state.resourceStatesById[recoveredPlayer.resourceStateId]!.balances;
    expect(pickCanonicalMaterials(recoveredBalances)).toEqual(configured.materials);
    expect(recoveredBalances.cash).toBe(0);
    expect(recoveredPlayer.population).toBe(345);

    const readModel = createPlayerView(recovered!.state, playerId);
    expect(readModel.economy).toMatchObject({
      cleanCash: configured.cleanCash,
      dirtyCash: configured.dirtyCash,
      population: configured.population
    });
    expect(pickCanonicalMaterials(readModel.resourceBalances)).toEqual(configured.materials);
    expect({
      ...readModel.economy.materials,
      ...readModel.economy.drugs,
      ...readModel.economy.weapons
    }).toEqual(configured.materials);
  });
});

const distinctiveStartingPlayerState = (): HostedStartingPlayerStateView => ({
  cleanCash: 0,
  dirtyCash: 23_456,
  population: 345,
  spySlots: 2,
  materials: Object.fromEntries(
    FREE_HOSTED_STARTING_MATERIAL_IDS.map((materialId, index) => [materialId, index * 137])
  ) as HostedStartingPlayerStateView["materials"]
});

const createRequest = (
  startingPlayerState: HostedStartingPlayerStateView
): AdminCreateServerRequestView => ({
  mode: "free",
  serverTemplate: "control",
  displayName: "Starting State Full Trace",
  region: "eu-central",
  capacity: 2,
  joinPolicy: "closed",
  mapComposition: {
    downtown: 8,
    commercial: 40,
    residential: 38,
    industrial: 38,
    park: 37
  },
  startingPlayerState
});

const ownerSession = (): AdminSessionView => ({
  adminSessionId: "session:starting-state-owner",
  adminUserId: "admin:starting-state-owner",
  actorId: "admin:starting-state-owner",
  username: "starting-state-owner",
  displayName: "Starting State Owner",
  role: "owner",
  authenticationMethod: "password",
  createdAt: NOW.toISOString(),
  expiresAt: new Date(NOW.getTime() + 60_000).toISOString(),
  revokedAt: null,
  lastSeenAt: NOW.toISOString()
});

const pickCanonicalMaterials = (
  balances: Record<string, number>
): HostedStartingPlayerStateView["materials"] => Object.fromEntries(
  FREE_HOSTED_STARTING_MATERIAL_IDS.map((materialId) => [materialId, balances[materialId]])
) as HostedStartingPlayerStateView["materials"];

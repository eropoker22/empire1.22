import { describe, expect, it } from "vitest";
import type { CoreGameState } from "@empire/game-core";
import { empireStreetsCityMapManifest, empireStreetsCityMapManifestHash } from "@empire/game-config";
import type { GameplaySliceView, LoadGameplaySliceRequest, SelectSpawnDistrictCommand } from "@empire/shared-types";
import { createServerApp } from "../../apps/server/src/app";
import { ensureGameplaySliceSessionResult } from "../../apps/server/src/bootstrap/gameplay-slice-session-bootstrap";
import { sharedCitySpawnDistrictIds } from "../../apps/server/src/bootstrap/gameplay-slice-shared-city-seed";

const createLoadRequest = (
  index: number,
  overrides: Partial<LoadGameplaySliceRequest> = {}
): LoadGameplaySliceRequest => ({
  serverInstanceId: "instance:free-multiplayer-join",
  playerId: `player:join:${index}`,
  districtId: null,
  factionId: "mafian",
  ...overrides
});

describe("gameplay slice multiplayer join bootstrap", () => {
  it("creates a player awaiting explicit spawn selection without auto-claiming a district", async () => {
    const server = createServerApp();
    const request = createLoadRequest(1);
    const result = await ensureGameplaySliceSessionResult(server.instanceManager, request);
    const runtime = server.instanceManager.getInstanceById(request.serverInstanceId);

    expect(result).toMatchObject({
      accepted: true,
      createdInstance: true,
      joinedPlayer: true,
      errors: []
    });
    expect(runtime?.state.root.playerIds).toEqual([request.playerId]);
    expect(runtime?.state.playersById[request.playerId]?.homeDistrictId).toBeNull();
    expect(getClaimedSpawnDistrictIds(runtime!.state)).toEqual([]);
  });

  it("returns a lobby spawn read model with available and occupied spawn districts", async () => {
    const server = createServerApp();
    const firstRequest = createLoadRequest(1);
    const secondRequest = createLoadRequest(2);
    await ensureGameplaySliceSessionResult(server.instanceManager, firstRequest);
    await ensureGameplaySliceSessionResult(server.instanceManager, secondRequest);

    const firstSpawn = await submitSelectSpawn(server, firstRequest, sharedCitySpawnDistrictIds[0]);
    const secondRead = server.gameplaySliceTransport.load(secondRequest).readModel as GameplaySliceView;

    expect(firstSpawn.accepted).toBe(true);
    expect(secondRead.spawnSelection?.status).toBe("awaiting_spawn_selection");
    expect(secondRead.spawnSelection?.districts.find((district) =>
      district.districtId === sharedCitySpawnDistrictIds[0]
    )).toMatchObject({
      status: "occupied",
      ownerPlayerId: firstRequest.playerId
    });
    expect(secondRead.spawnSelection?.districts.find((district) =>
      district.districtId === sharedCitySpawnDistrictIds[1]
    )).toMatchObject({
      status: "available"
    });
  });

  it("select-spawn-district claims an enabled spawn and survives read-model rebuild", async () => {
    const server = createServerApp();
    const request = createLoadRequest(1);
    await ensureGameplaySliceSessionResult(server.instanceManager, request);

    const response = await submitSelectSpawn(server, request, sharedCitySpawnDistrictIds[5]);
    const runtime = server.instanceManager.getInstanceById(request.serverInstanceId)!;
    const readModel = server.gameplaySliceTransport.load(request).readModel as GameplaySliceView;

    expect(response.accepted).toBe(true);
    expect(runtime.state.playersById[request.playerId]?.homeDistrictId).toBe(sharedCitySpawnDistrictIds[5]);
    expect(runtime.state.districtsById[sharedCitySpawnDistrictIds[5]]?.ownerPlayerId).toBe(request.playerId);
    expect(readModel.spawnSelection?.status).toBe("ready_to_play");
    expect(readModel.player.homeDistrictId).toBe(sharedCitySpawnDistrictIds[5]);
    expect(readModel.server.mapManifestHash).toBe(empireStreetsCityMapManifestHash);
  });

  it("rejects invalid requested spawn without fallback", async () => {
    const server = createServerApp();
    const request = createLoadRequest(1);
    await ensureGameplaySliceSessionResult(server.instanceManager, request);
    const downtownDistrictId = empireStreetsCityMapManifest.districts.find((district) => district.isDowntown)!.id;

    const response = await submitSelectSpawn(server, request, downtownDistrictId);
    const runtime = server.instanceManager.getInstanceById(request.serverInstanceId)!;

    expect(response.accepted).toBe(false);
    expect(response.errors).toEqual([
      expect.objectContaining({ code: "SPAWN_NOT_ALLOWED" })
    ]);
    expect(runtime.state.playersById[request.playerId]?.homeDistrictId).toBeNull();
    expect(getClaimedSpawnDistrictIds(runtime.state)).toEqual([]);
  });

  it("rejects an occupied requested spawn for a second player", async () => {
    const server = createServerApp();
    const firstRequest = createLoadRequest(1);
    const secondRequest = createLoadRequest(2);
    const spawnDistrictId = sharedCitySpawnDistrictIds[4];
    await ensureGameplaySliceSessionResult(server.instanceManager, firstRequest);
    await ensureGameplaySliceSessionResult(server.instanceManager, secondRequest);
    await submitSelectSpawn(server, firstRequest, spawnDistrictId);

    const response = await submitSelectSpawn(
      server,
      secondRequest,
      spawnDistrictId,
      "command:select-spawn:2"
    );
    const runtime = server.instanceManager.getInstanceById(firstRequest.serverInstanceId)!;

    expect(response.accepted).toBe(false);
    expect(response.errors).toEqual([
      expect.objectContaining({ code: "SPAWN_ALREADY_OCCUPIED" })
    ]);
    expect(runtime.state.playersById[firstRequest.playerId]?.homeDistrictId).toBe(spawnDistrictId);
    expect(runtime.state.playersById[secondRequest.playerId]?.homeDistrictId).toBeNull();
  });

  it("creates one connected shared city map on first load", async () => {
    const server = createServerApp();
    const request = createLoadRequest(1);

    await ensureGameplaySliceSessionResult(server.instanceManager, request);
    const runtime = server.instanceManager.getInstanceById(request.serverInstanceId);

    expect(runtime?.state.root.districtIds).toHaveLength(161);
    for (const spawnDistrictId of sharedCitySpawnDistrictIds) {
      expect(runtime?.state.districtsById[spawnDistrictId]).toBeDefined();
    }
    expect(runtime?.state.districtsById[empireStreetsCityMapManifest.districts.find((district) => district.isDowntown)!.id]?.zone).toBe("downtown");
    expect(isConnectedDistrictGraph(runtime!.state)).toBe(true);
  });

  it("does not duplicate the same player on repeated load", async () => {
    const server = createServerApp();
    const request = createLoadRequest(1);

    const first = await ensureGameplaySliceSessionResult(server.instanceManager, request);
    const second = await ensureGameplaySliceSessionResult(server.instanceManager, request);
    const runtime = server.instanceManager.getInstanceById(request.serverInstanceId);

    expect(first.joinedPlayer).toBe(true);
    expect(second).toMatchObject({
      accepted: true,
      createdInstance: false,
      joinedPlayer: false,
      errors: []
    });
    expect(runtime?.state.root.playerIds).toEqual([request.playerId]);
    expect(runtime?.state.playersById[request.playerId]?.homeDistrictId).toBeNull();
  });
});

const createSelectSpawnCommand = (
  request: LoadGameplaySliceRequest,
  districtId: string,
  id = "command:select-spawn:1"
): SelectSpawnDistrictCommand => ({
  id,
  type: "select-spawn-district",
  mode: "free",
  playerId: request.playerId,
  serverInstanceId: request.serverInstanceId,
  issuedAt: new Date(0).toISOString(),
  payload: { districtId },
  clientRequestId: null
});

const submitSelectSpawn = async (
  server: ReturnType<typeof createServerApp>,
  request: LoadGameplaySliceRequest,
  districtId: string,
  commandId?: string
) => {
  const load = server.gameplaySliceTransport.load(request);
  return server.gameplaySliceTransport.submit({
    command: createSelectSpawnCommand(request, districtId, commandId),
    expectedStateVersion: load.metadata?.stateVersion ?? null,
    sessionToken: load.sessionToken,
    focusDistrictId: districtId
  });
};

const getClaimedSpawnDistrictIds = (state: CoreGameState): string[] =>
  sharedCitySpawnDistrictIds.filter((districtId) => state.districtsById[districtId]?.ownerPlayerId);

const isConnectedDistrictGraph = (state: CoreGameState): boolean => {
  const [firstDistrictId] = state.root.districtIds;
  if (!firstDistrictId) return true;

  const visited = new Set<string>();
  const queue = [firstDistrictId];
  while (queue.length > 0) {
    const districtId = queue.shift()!;
    if (visited.has(districtId)) continue;
    visited.add(districtId);
    for (const adjacentDistrictId of state.districtsById[districtId]?.adjacentDistrictIds ?? []) {
      if (state.districtsById[adjacentDistrictId] && !visited.has(adjacentDistrictId)) {
        queue.push(adjacentDistrictId);
      }
    }
  }

  return visited.size === state.root.districtIds.length;
};

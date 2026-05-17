import { describe, expect, it } from "vitest";
import type { CoreGameState } from "@empire/game-core";
import type { GameplaySliceView, LoadGameplaySliceRequest } from "@empire/shared-types";
import { createServerApp } from "../../apps/server/src/app";
import { ensureGameplaySliceSessionResult } from "../../apps/server/src/bootstrap/gameplay-slice-session-bootstrap";
import { sharedCitySpawnDistrictIds } from "../../apps/server/src/bootstrap/gameplay-slice-shared-city-seed";

const createLoadRequest = (
  index: number,
  overrides: Partial<LoadGameplaySliceRequest> = {}
): LoadGameplaySliceRequest => ({
  serverInstanceId: "instance:free-multiplayer-join",
  playerId: `player:join:${index}`,
  districtId: `district:${1000 + index * 10}`,
  factionId: "mafian",
  ...overrides
});

describe("gameplay slice multiplayer join bootstrap", () => {
  it("creates the first free mode instance from a load request", async () => {
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
    expect(runtime?.record.mode).toBe("free");
    expect(runtime?.state.root.playerIds).toEqual([request.playerId]);
    expect(runtime?.state.playersById[request.playerId]?.homeDistrictId).toBe(sharedCitySpawnDistrictIds[0]);
  });

  it("creates one shared city map on the first load", async () => {
    const server = createServerApp();
    const request = createLoadRequest(1);

    await ensureGameplaySliceSessionResult(server.instanceManager, request);
    const runtime = server.instanceManager.getInstanceById(request.serverInstanceId);

    expect(runtime?.state.root.districtIds).toHaveLength(161);
    for (const spawnDistrictId of sharedCitySpawnDistrictIds) {
      expect(runtime?.state.districtsById[spawnDistrictId]).toBeDefined();
    }
    expect(runtime?.state.districtsById["district:central:1"]?.zone).toBe("downtown");
    expect(countDistrictZones(runtime!.state)).toMatchObject({
      downtown: 8,
      commercial: 40,
      industrial: 35,
      residential: 48,
      park: 30
    });
    expect(isConnectedDistrictGraph(runtime!.state)).toBe(true);
  });

  it("adds a second player to the same instance without replacing the world", async () => {
    const server = createServerApp();
    const firstRequest = createLoadRequest(1);
    const secondRequest = createLoadRequest(2);

    await ensureGameplaySliceSessionResult(server.instanceManager, firstRequest);
    const runtimeBeforeJoin = server.instanceManager.getInstanceById(firstRequest.serverInstanceId);
    const firstPlayer = runtimeBeforeJoin?.state.playersById[firstRequest.playerId];
    expect(firstPlayer).toBeDefined();

    runtimeBeforeJoin!.state.resourceStatesById[firstPlayer!.resourceStateId].balances.cash = 4321;
    const firstHomeDistrict = firstPlayer!.homeDistrictId;
    const firstDistrictIdsBeforeJoin = [...runtimeBeforeJoin!.state.root.districtIds];

    const result = await ensureGameplaySliceSessionResult(server.instanceManager, secondRequest);
    const runtimeAfterJoin = server.instanceManager.getInstanceById(firstRequest.serverInstanceId);

    expect(result).toMatchObject({
      accepted: true,
      createdInstance: false,
      joinedPlayer: true,
      errors: []
    });
    expect(runtimeAfterJoin).toBe(runtimeBeforeJoin);
    expect(runtimeAfterJoin?.state.root.playerIds).toEqual([firstRequest.playerId, secondRequest.playerId]);
    expect(runtimeAfterJoin?.state.playersById[firstRequest.playerId]?.homeDistrictId).toBe(firstHomeDistrict);
    expect(runtimeAfterJoin?.state.playersById[secondRequest.playerId]?.homeDistrictId).toBe(sharedCitySpawnDistrictIds[1]);
    expect(runtimeAfterJoin?.state.resourceStatesById[firstPlayer!.resourceStateId].balances.cash).toBe(4321);
    expect(runtimeAfterJoin?.state.root.districtIds).toEqual(firstDistrictIdsBeforeJoin);
    for (const districtId of firstDistrictIdsBeforeJoin) {
      expect(runtimeAfterJoin?.state.districtsById[districtId]).toBeDefined();
    }
  });

  it("lets 20 players join one free instance and rejects the 21st with a domain error", async () => {
    const server = createServerApp();

    for (let index = 1; index <= 20; index += 1) {
      const result = await ensureGameplaySliceSessionResult(server.instanceManager, createLoadRequest(index));
      expect(result.accepted).toBe(true);
    }

    const rejected = await ensureGameplaySliceSessionResult(server.instanceManager, createLoadRequest(21));
    const runtime = server.instanceManager.getInstanceById("instance:free-multiplayer-join");
    const homeDistrictIds = Object.values(runtime?.state.playersById ?? {}).map((player) => player.homeDistrictId);

    expect(rejected.accepted).toBe(false);
    expect(rejected.errors).toEqual([
      {
        code: "server.player_cap_reached",
        message: "Server instance is full. This mode allows 20 players.",
        details: {
          currentPlayerCount: 20,
          maxPlayersPerServer: 20
        }
      }
    ]);
    expect(runtime?.state.root.playerIds).toHaveLength(20);
    expect(runtime?.state.playersById["player:join:21"]).toBeUndefined();
    expect(new Set(homeDistrictIds).size).toBe(20);
    expect(homeDistrictIds.sort()).toEqual([...sharedCitySpawnDistrictIds].sort());
  });

  it("rejects a player join when no spawn district can be claimed", async () => {
    const server = createServerApp();
    const firstRequest = createLoadRequest(1, {
      serverInstanceId: "instance:free-spawn-unavailable"
    });
    const secondRequest = createLoadRequest(2, {
      serverInstanceId: firstRequest.serverInstanceId
    });

    await ensureGameplaySliceSessionResult(server.instanceManager, firstRequest);
    const runtime = server.instanceManager.getInstanceById(firstRequest.serverInstanceId)!;
    for (const [index, districtId] of sharedCitySpawnDistrictIds.entries()) {
      runtime.state.districtsById[districtId] = {
        ...runtime.state.districtsById[districtId],
        ownerPlayerId: `player:blocked-spawn:${index + 1}`,
        status: "claimed"
      };
    }

    const rejected = await ensureGameplaySliceSessionResult(server.instanceManager, secondRequest);

    expect(rejected).toEqual({
      accepted: false,
      createdInstance: false,
      joinedPlayer: false,
      errors: [
        {
          code: "server.spawn_unavailable",
          message: "No available spawn district exists for this gameplay slice session.",
          details: {
            playerId: secondRequest.playerId,
            serverInstanceId: secondRequest.serverInstanceId,
            mode: "free"
          }
        }
      ]
    });
    expect(runtime.state.playersById[secondRequest.playerId]).toBeUndefined();
    expect(runtime.state.root.playerIds).toEqual([firstRequest.playerId]);
  });

  it("does not duplicate the same player on repeated load", async () => {
    const server = createServerApp();
    const request = createLoadRequest(1);

    const first = await ensureGameplaySliceSessionResult(server.instanceManager, request);
    const runtimeAfterFirstLoad = server.instanceManager.getInstanceById(request.serverInstanceId);
    const firstHomeDistrictId = runtimeAfterFirstLoad?.state.playersById[request.playerId]?.homeDistrictId;
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
    expect(runtime?.state.playersById[request.playerId]?.homeDistrictId).toBe(firstHomeDistrictId);
    expect(Object.keys(runtime?.state.playersById ?? {}).filter((playerId) => playerId === request.playerId)).toHaveLength(1);
    expect(getClaimedSpawnDistrictIds(runtime!.state)).toEqual([sharedCitySpawnDistrictIds[0]]);
  });

  it("returns a player-scoped read model after joining an existing instance", async () => {
    const server = createServerApp();
    const firstRequest = createLoadRequest(1);
    const secondRequest = createLoadRequest(2, {
      factionId: "kartel"
    });

    await ensureGameplaySliceSessionResult(server.instanceManager, firstRequest);
    await ensureGameplaySliceSessionResult(server.instanceManager, secondRequest);

    const response = server.gameplaySliceTransport.load(secondRequest);
    const readModel = response.readModel as GameplaySliceView;

    expect(response.accepted).toBe(true);
    expect(readModel.player.playerId).toBe(secondRequest.playerId);
    expect(readModel.player.instanceId).toBe(secondRequest.serverInstanceId);
    expect(readModel.player.factionId).toBe("kartel");
    expect(readModel.district?.districtId).toBe(runtimeHomeDistrictId(server, secondRequest));
  });

  it("does not assign the same spawn district to two players", async () => {
    const server = createServerApp();
    const firstRequest = createLoadRequest(1);
    const secondRequest = createLoadRequest(2, {
      districtId: firstRequest.districtId
    });

    await ensureGameplaySliceSessionResult(server.instanceManager, firstRequest);
    await ensureGameplaySliceSessionResult(server.instanceManager, secondRequest);
    const runtime = server.instanceManager.getInstanceById(firstRequest.serverInstanceId);
    const firstPlayer = runtime?.state.playersById[firstRequest.playerId];
    const secondPlayer = runtime?.state.playersById[secondRequest.playerId];

    expect(firstPlayer?.homeDistrictId).toBe(sharedCitySpawnDistrictIds[0]);
    expect(secondPlayer?.homeDistrictId).toBe(sharedCitySpawnDistrictIds[1]);
    expect(firstPlayer?.homeDistrictId).not.toBe(secondPlayer?.homeDistrictId);
    expect(runtime?.state.districtsById[firstPlayer!.homeDistrictId!]?.ownerPlayerId).toBe(firstRequest.playerId);
    expect(runtime?.state.districtsById[secondPlayer!.homeDistrictId!]?.ownerPlayerId).toBe(secondRequest.playerId);
  });
});

const runtimeHomeDistrictId = (
  server: ReturnType<typeof createServerApp>,
  request: LoadGameplaySliceRequest
): string | null | undefined =>
  server.instanceManager.getInstanceById(request.serverInstanceId)?.state.playersById[request.playerId]?.homeDistrictId;

const getClaimedSpawnDistrictIds = (state: CoreGameState): string[] =>
  sharedCitySpawnDistrictIds.filter((districtId) => state.districtsById[districtId]?.ownerPlayerId);

const countDistrictZones = (state: CoreGameState): Record<string, number> => {
  const counts: Record<string, number> = {};
  for (const districtId of state.root.districtIds) {
    const zone = state.districtsById[districtId]?.zone ?? "unknown";
    counts[zone] = (counts[zone] ?? 0) + 1;
  }
  return counts;
};

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

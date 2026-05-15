import { describe, expect, it } from "vitest";
import type { GameplaySliceView, LoadGameplaySliceRequest } from "@empire/shared-types";
import { createServerApp } from "../../apps/server/src/app";
import { ensureGameplaySliceSessionResult } from "../../apps/server/src/bootstrap/gameplay-slice-session-bootstrap";

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
    expect(runtime?.state.playersById[request.playerId]?.homeDistrictId).toBe(request.districtId);
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
    expect(runtimeAfterJoin?.state.resourceStatesById[firstPlayer!.resourceStateId].balances.cash).toBe(4321);
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
    expect(Object.keys(runtime?.state.playersById ?? {}).filter((playerId) => playerId === request.playerId)).toHaveLength(1);
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
    expect(readModel.district?.districtId).toBe(secondRequest.districtId);
  });

  it("assigns a deterministic fallback home district when the requested spawn is already seeded", async () => {
    const server = createServerApp();
    const firstRequest = createLoadRequest(1);
    const secondRequest = createLoadRequest(2, {
      districtId: firstRequest.districtId
    });

    await ensureGameplaySliceSessionResult(server.instanceManager, firstRequest);
    await ensureGameplaySliceSessionResult(server.instanceManager, secondRequest);
    const runtime = server.instanceManager.getInstanceById(firstRequest.serverInstanceId);
    const secondPlayer = runtime?.state.playersById[secondRequest.playerId];

    expect(secondPlayer?.homeDistrictId).toBe("district:1010:join:join-2:0");
    expect(runtime?.state.districtsById[firstRequest.districtId]?.ownerPlayerId).toBe(firstRequest.playerId);
    expect(runtime?.state.districtsById[secondPlayer!.homeDistrictId!]?.ownerPlayerId).toBe(secondRequest.playerId);
  });
});

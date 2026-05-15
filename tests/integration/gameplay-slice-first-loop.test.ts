import { describe, expect, it } from "vitest";
import type {
  AttackDistrictCommand,
  DistrictId,
  GameplaySliceView,
  LoadGameplaySliceRequest,
  SpyDistrictCommand
} from "@empire/shared-types";
import type { CoreGameState } from "@empire/game-core";
import { createServerApp } from "../../apps/server/src/app";
import { ensureGameplaySliceSessionResult } from "../../apps/server/src/bootstrap/gameplay-slice-session-bootstrap";

const serverInstanceId = "instance:free-first-loop";

const createLoadRequest = (
  index: number,
  overrides: Partial<LoadGameplaySliceRequest> = {}
): LoadGameplaySliceRequest => ({
  serverInstanceId,
  playerId: `player:first-loop:${index}`,
  districtId: `district:requested:${index}`,
  factionId: "mafian",
  ...overrides
});

describe("gameplay slice first 10 minutes shared city loop", () => {
  it("loads a player into an assigned home district with neighbors and action targets", async () => {
    const server = createServerApp();
    const request = createLoadRequest(1, { districtId: "district:not-in-shared-city" });

    await ensureGameplaySliceSessionResult(server.instanceManager, request);
    const runtime = server.instanceManager.getInstanceById(serverInstanceId);
    const homeDistrictId = runtime?.state.playersById[request.playerId]?.homeDistrictId;
    const response = server.gameplaySliceTransport.load(request);
    const readModel = response.readModel as GameplaySliceView;
    const homeSummary = readModel.districts.find((district) => district.districtId === homeDistrictId);

    expect(response.accepted).toBe(true);
    expect(response.metadata?.serverTick).toBe(runtime?.state.root.tick);
    expect(readModel.district?.districtId).toBe(homeDistrictId);
    expect(readModel.district?.isOwnedByPlayer).toBe(true);
    expect(homeSummary?.adjacentDistrictIds.length).toBeGreaterThan(0);
    expect(readModel.district?.spyTargets.some((target) => target.enabled)).toBe(true);
    expect(readModel.district?.attackTargets.some((target) => target.enabled)).toBe(true);
    expect(readModel.onboarding?.suggestedNeighborDistrictId).toBe(readModel.district?.spyTargets[0]?.districtId);
    expect(readModel.onboarding?.canSpy).toBe(true);
    expect(readModel.onboarding?.canAttack).toBe(true);
  });

  it("keeps two players on distinct homes and exposes a conflict path between them", async () => {
    const server = createServerApp();
    const firstRequest = createLoadRequest(1);
    const secondRequest = createLoadRequest(2, { factionId: "kartel" });

    await ensureGameplaySliceSessionResult(server.instanceManager, firstRequest);
    await ensureGameplaySliceSessionResult(server.instanceManager, secondRequest);
    const runtime = server.instanceManager.getInstanceById(serverInstanceId)!;
    const firstHome = runtime.state.playersById[firstRequest.playerId]?.homeDistrictId;
    const secondHome = runtime.state.playersById[secondRequest.playerId]?.homeDistrictId;
    const response = server.gameplaySliceTransport.load(firstRequest);
    const readModel = response.readModel as GameplaySliceView;

    expect(firstHome).toBeTruthy();
    expect(secondHome).toBeTruthy();
    expect(firstHome).not.toBe(secondHome);
    expect(findDistrictPath(runtime.state, firstHome!, secondHome!)).toEqual([firstHome, secondHome]);
    expect(readModel.district?.spyTargets.some((target) => target.districtId === secondHome && target.enabled)).toBe(true);
    expect(readModel.district?.attackTargets.some((target) => target.districtId === secondHome && target.enabled)).toBe(true);
  });

  it("submits spy and attack commands through the existing command flow and returns reports", async () => {
    const server = createServerApp();
    const firstRequest = createLoadRequest(1);
    const secondRequest = createLoadRequest(2, { factionId: "kartel" });

    await ensureGameplaySliceSessionResult(server.instanceManager, firstRequest);
    await ensureGameplaySliceSessionResult(server.instanceManager, secondRequest);
    const initial = server.gameplaySliceTransport.load(firstRequest);
    const initialReadModel = initial.readModel as GameplaySliceView;
    const sourceDistrictId = initialReadModel.district!.districtId;
    const targetDistrictId = initialReadModel.district!.spyTargets.find((target) => target.enabled)!.districtId;
    const spy = server.gameplaySliceTransport.submit({
      focusDistrictId: sourceDistrictId,
      command: createSpyCommand({
        id: "command:first-loop:spy:1",
        playerId: firstRequest.playerId,
        sourceDistrictId,
        targetDistrictId
      })
    });
    const spyReadModel = spy.readModel as GameplaySliceView;

    expect(spy.accepted).toBe(true);
    expect(spy.errors).toEqual([]);
    expect(spy.metadata?.serverTick).toBe(0);
    expect(spyReadModel.reports[0]).toMatchObject({
      reportType: "spy",
      actionType: "spy-district",
      sourceDistrictId,
      targetDistrictId
    });
    expect(spyReadModel.cityFeed?.currentPlayerFeed.some((event) => event.districtId === targetDistrictId)).toBe(true);

    const attack = server.gameplaySliceTransport.submit({
      focusDistrictId: sourceDistrictId,
      command: createAttackCommand({
        id: "command:first-loop:attack:1",
        playerId: firstRequest.playerId,
        sourceDistrictId,
        targetDistrictId
      })
    });
    const attackReadModel = attack.readModel as GameplaySliceView;

    expect(attack.accepted).toBe(true);
    expect(attack.errors).toEqual([]);
    expect(attack.metadata?.serverTick).toBe(0);
    expect(attackReadModel.reports[0]).toMatchObject({
      reportType: "battle",
      actionType: "attack-district",
      sourceDistrictId,
      targetDistrictId
    });
  });

  it("returns a clear error and a valid read model for invalid first-loop commands", async () => {
    const server = createServerApp();
    const request = createLoadRequest(1);

    await ensureGameplaySliceSessionResult(server.instanceManager, request);
    const runtime = server.instanceManager.getInstanceById(serverInstanceId)!;
    const homeDistrictId = runtime.state.playersById[request.playerId]!.homeDistrictId!;
    const response = server.gameplaySliceTransport.submit({
      focusDistrictId: "district:missing-focus",
      command: createSpyCommand({
        id: "command:first-loop:invalid-spy:1",
        playerId: request.playerId,
        sourceDistrictId: homeDistrictId,
        targetDistrictId: "district:missing-target"
      })
    });
    const readModel = response.readModel as GameplaySliceView;

    expect(response.accepted).toBe(false);
    expect(response.errors).toEqual([
      {
        code: "spy_target_not_found",
        message: "Target district district:missing-target was not found."
      }
    ]);
    expect(readModel.district?.districtId).toBe(homeDistrictId);
    expect(response.metadata?.serverTick).toBe(runtime.state.root.tick);
  });

  it("keeps the shared city map valid after several ticks", async () => {
    const server = createServerApp();
    const firstRequest = createLoadRequest(1);
    const secondRequest = createLoadRequest(2);

    await ensureGameplaySliceSessionResult(server.instanceManager, firstRequest);
    await ensureGameplaySliceSessionResult(server.instanceManager, secondRequest);
    const runtime = server.instanceManager.getInstanceById(serverInstanceId)!;
    const districtIdsBeforeTicks = [...runtime.state.root.districtIds];
    const playerIdsBeforeTicks = [...runtime.state.root.playerIds];

    for (let index = 0; index < 3; index += 1) {
      server.instanceManager.tickInstance(serverInstanceId);
    }

    const tickedRuntime = server.instanceManager.getInstanceById(serverInstanceId)!;
    expect(tickedRuntime.state.root.tick).toBe(3);
    expect(tickedRuntime.state.root.districtIds).toEqual(districtIdsBeforeTicks);
    expect(tickedRuntime.state.root.playerIds).toEqual(playerIdsBeforeTicks);
    expect(isConnectedDistrictGraph(tickedRuntime.state)).toBe(true);
    for (const playerId of playerIdsBeforeTicks) {
      const homeDistrictId = tickedRuntime.state.playersById[playerId]?.homeDistrictId;
      expect(homeDistrictId).toBeTruthy();
      expect(tickedRuntime.state.districtsById[homeDistrictId!]?.ownerPlayerId).toBe(playerId);
    }
  });
});

const createSpyCommand = (input: {
  id: string;
  playerId: string;
  sourceDistrictId: DistrictId;
  targetDistrictId: DistrictId;
}): SpyDistrictCommand => ({
  id: input.id,
  type: "spy-district",
  mode: "free",
  playerId: input.playerId,
  serverInstanceId,
  issuedAt: new Date(0).toISOString(),
  payload: {
    districtId: input.targetDistrictId,
    sourceDistrictId: input.sourceDistrictId
  },
  clientRequestId: null
});

const createAttackCommand = (input: {
  id: string;
  playerId: string;
  sourceDistrictId: DistrictId;
  targetDistrictId: DistrictId;
}): AttackDistrictCommand => ({
  id: input.id,
  type: "attack-district",
  mode: "free",
  playerId: input.playerId,
  serverInstanceId,
  issuedAt: new Date(0).toISOString(),
  payload: {
    districtId: input.targetDistrictId,
    sourceDistrictId: input.sourceDistrictId
  },
  clientRequestId: null
});

const findDistrictPath = (
  state: CoreGameState,
  sourceDistrictId: DistrictId,
  targetDistrictId: DistrictId
): DistrictId[] | null => {
  const queue: DistrictId[][] = [[sourceDistrictId]];
  const visited = new Set<DistrictId>();

  while (queue.length > 0) {
    const path = queue.shift()!;
    const districtId = path[path.length - 1]!;
    if (districtId === targetDistrictId) return path;
    if (visited.has(districtId)) continue;
    visited.add(districtId);

    for (const adjacentDistrictId of state.districtsById[districtId]?.adjacentDistrictIds ?? []) {
      if (!visited.has(adjacentDistrictId) && state.districtsById[adjacentDistrictId]) {
        queue.push([...path, adjacentDistrictId]);
      }
    }
  }

  return null;
};

const isConnectedDistrictGraph = (state: CoreGameState): boolean => {
  const [firstDistrictId] = state.root.districtIds;
  if (!firstDistrictId) return true;
  return state.root.districtIds.every((districtId) => findDistrictPath(state, firstDistrictId, districtId) !== null);
};

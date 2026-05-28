import { describe, expect, it } from "vitest";
import {
  SERVER_ASSIGNED_FOCUS_DISTRICT_ID,
  type AttackDistrictCommand,
  type DistrictId,
  type GameplaySliceView,
  type LoadGameplaySliceRequest,
  type OccupyDistrictCommand,
  type SpyDistrictCommand
} from "@empire/shared-types";
import type { CoreGameState } from "@empire/game-core";
import { createClientApp } from "../../apps/client/src/app";
import { createInMemoryClientTransport } from "../../apps/client/src/transport";
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
    expect(readModel.police).toMatchObject({
      playerId: request.playerId,
      selectedDistrictId: homeDistrictId,
      selectedDistrictHeat: readModel.district?.heat,
      wantedLevelLabel: "0 / 5",
      raidConsequenceStatus: "none",
      protection: {
        raidConsequenceMultiplier: 1,
        sources: []
      }
    });
    expect(readModel.player.police).toBe(readModel.police);
    expect(readModel.player.homeDistrictId).toBe(homeDistrictId);
    expect(readModel.onboarding?.suggestedNeighborDistrictId).toBe(readModel.district?.spyTargets[0]?.districtId);
    expect(readModel.onboarding?.canSpy).toBe(true);
    expect(readModel.onboarding?.canAttack).toBe(true);
  });

  it("client selects server-confirmed district when initial focus is server-assigned", async () => {
    const server = createServerApp();
    const request = createLoadRequest(1, {
      districtId: null,
      preferredStartDistrictId: "district:27"
    });

    await ensureGameplaySliceSessionResult(server.instanceManager, request);
    const runtime = server.instanceManager.getInstanceById(serverInstanceId)!;
    const homeDistrictId = runtime.state.playersById[request.playerId]!.homeDistrictId!;
    const client = createClientApp({
      transport: createInMemoryClientTransport(server.gameplaySliceTransport)
    });
    const render = await client.load(request);

    expect(render.districtPanel?.districtId).toBe(homeDistrictId);
    expect(render.mapDistricts.find((district) => district.districtId === homeDistrictId)?.isSelected).toBe(true);
    expect(render.player?.homeDistrictId).toBe(homeDistrictId);
    expect(render.topBarHtml).toContain(`Server assigned home: ${homeDistrictId}`);
  });

  it("loads without a concrete district focus but rejects server-assigned submit focus", async () => {
    const server = createServerApp();
    const request: LoadGameplaySliceRequest = {
      serverInstanceId,
      playerId: "player:first-loop:no-focus",
      factionId: "mafian"
    };

    await ensureGameplaySliceSessionResult(server.instanceManager, request);
    const runtime = server.instanceManager.getInstanceById(serverInstanceId)!;
    const homeDistrictId = runtime.state.playersById[request.playerId]!.homeDistrictId!;
    const missingFocusLoad = server.gameplaySliceTransport.load(request);
    const missingFocusReadModel = missingFocusLoad.readModel as GameplaySliceView;
    const serverAssignedLoad = server.gameplaySliceTransport.load({
      ...request,
      districtId: SERVER_ASSIGNED_FOCUS_DISTRICT_ID
    });
    const serverAssignedReadModel = serverAssignedLoad.readModel as GameplaySliceView;

    expect(missingFocusLoad.accepted).toBe(true);
    expect(missingFocusReadModel.player.homeDistrictId).toBe(homeDistrictId);
    expect(missingFocusReadModel.district?.districtId).toBe(homeDistrictId);
    expect(serverAssignedLoad.accepted).toBe(true);
    expect(serverAssignedReadModel.player.homeDistrictId).toBe(homeDistrictId);
    expect(serverAssignedReadModel.district?.districtId).toBe(homeDistrictId);

    const rejectedSubmit = server.gameplaySliceTransport.submit({
      sessionToken: missingFocusLoad.sessionToken,
      focusDistrictId: SERVER_ASSIGNED_FOCUS_DISTRICT_ID,
      command: createSpyCommand({
        id: "command:first-loop:server-assigned-submit-focus",
        playerId: request.playerId,
        sourceDistrictId: homeDistrictId,
        targetDistrictId: "district:connector:1"
      })
    });
    const rejectedReadModel = rejectedSubmit.readModel as GameplaySliceView;

    expect(rejectedSubmit.accepted).toBe(false);
    expect(rejectedSubmit.errors).toEqual([
      {
        code: "transport.invalid_request",
        message: "Gameplay slice submit request field 'focusDistrictId' must be a concrete server district.",
        details: {
          field: "focusDistrictId"
        }
      }
    ]);
    expect(rejectedReadModel.district?.districtId).toBe(homeDistrictId);
    expect(rejectedReadModel.player.homeDistrictId).toBe(homeDistrictId);
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
      sessionToken: initial.sessionToken,
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
      sessionToken: spy.sessionToken,
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

  it("unlocks and submits occupy-district after successful spy intel on a neutral neighbor", async () => {
    const server = createServerApp();
    const request = createLoadRequest(1);

    await ensureGameplaySliceSessionResult(server.instanceManager, request);
    const runtime = server.instanceManager.getInstanceById(serverInstanceId)!;
    const homeDistrictId = runtime.state.playersById[request.playerId]!.homeDistrictId!;
    runtime.state.districtsById[homeDistrictId] = {
      ...runtime.state.districtsById[homeDistrictId],
      influence: 10
    };
    const initial = server.gameplaySliceTransport.load(request);
    const initialReadModel = initial.readModel as GameplaySliceView;
    const sourceDistrictId = initialReadModel.district!.districtId;
    const targetDistrictId = "district:connector:1";

    expect(initialReadModel.district!.spyTargets.some((target) =>
      target.districtId === targetDistrictId && target.enabled
    )).toBe(true);
    expect(initialReadModel.district!.occupyTargets).toContainEqual(expect.objectContaining({
      districtId: targetDistrictId,
      enabled: false,
      disabledCode: "occupy_requires_successful_spy",
      cost: { influence: 5 },
      heatGain: 2
    }));

    const spy = server.gameplaySliceTransport.submit({
      sessionToken: initial.sessionToken,
      focusDistrictId: sourceDistrictId,
      command: createSpyCommand({
        id: "command:first-loop:occupy-spy:1",
        playerId: request.playerId,
        sourceDistrictId,
        targetDistrictId
      })
    });
    const spyReadModel = spy.readModel as GameplaySliceView;

    expect(spy.accepted).toBe(true);
    expect(spy.errors).toEqual([]);
    expect(spyReadModel.reports[0]).toMatchObject({
      reportType: "spy",
      result: "success",
      targetDistrictId
    });
    expect(spyReadModel.district?.occupyTargets).toContainEqual(
      expect.objectContaining({
        districtId: targetDistrictId,
        enabled: true
      })
    );

    const occupy = server.gameplaySliceTransport.submit({
      sessionToken: spy.sessionToken,
      focusDistrictId: sourceDistrictId,
      command: createOccupyCommand({
        id: "command:first-loop:occupy:1",
        playerId: request.playerId,
        sourceDistrictId,
        targetDistrictId
      })
    });
    const occupyReadModel = occupy.readModel as GameplaySliceView;

    expect(occupy.accepted).toBe(true);
    expect(occupy.errors).toEqual([]);
    expect(runtime.state.districtsById[sourceDistrictId]?.influence).toBe(5);
    expect(runtime.state.districtsById[targetDistrictId]?.ownerPlayerId).toBe(request.playerId);
    expect(runtime.state.districtsById[targetDistrictId]?.heat).toBe(2);
    expect(runtime.state.cooldownStatesById[runtime.state.playersById[request.playerId]!.cooldownStateId]?.cooldowns[`occupy:${targetDistrictId}`]).toBe(144);
    expect(runtime.state.districtsById[targetDistrictId]?.buildingIds.every((buildingId) =>
      runtime.state.buildingsById[buildingId]?.ownerPlayerId === request.playerId
    )).toBe(true);
    expect(occupyReadModel.district?.districtId).toBe(sourceDistrictId);
    expect(occupyReadModel.reports[0]).toMatchObject({
      reportType: "occupy",
      actionType: "occupy-district",
      sourceDistrictId,
      targetDistrictId,
      heatGained: 2,
      influenceCost: 5
    });
    expect(occupyReadModel.cityFeed?.currentPlayerFeed.some((event) =>
      event.sourceType === "district_capture" && event.districtId === targetDistrictId
    )).toBe(true);
    expect(occupy.metadata?.serverTick).toBe(runtime.state.root.tick);
  });

  it("renders an occupy report from the server read model in the client report panel", async () => {
    const server = createServerApp();
    const request = createLoadRequest(1);

    await ensureGameplaySliceSessionResult(server.instanceManager, request);
    const runtime = server.instanceManager.getInstanceById(serverInstanceId)!;
    const homeDistrictId = runtime.state.playersById[request.playerId]!.homeDistrictId!;
    runtime.state.districtsById[homeDistrictId] = {
      ...runtime.state.districtsById[homeDistrictId],
      influence: 10
    };
    const client = createClientApp({
      transport: createInMemoryClientTransport(server.gameplaySliceTransport)
    });
    await client.load(request);
    const sourceDistrictId = client.getGameplaySlice()!.district!.districtId;
    const targetDistrictId = "district:connector:1";

    await client.dispatch(createSpyCommand({
      id: "command:first-loop:occupy-render-spy:1",
      playerId: request.playerId,
      sourceDistrictId,
      targetDistrictId
    }));
    const occupyRender = await client.dispatch(createOccupyCommand({
      id: "command:first-loop:occupy-render:1",
      playerId: request.playerId,
      sourceDistrictId,
      targetDistrictId
    }));

    expect(occupyRender.errors).toEqual([]);
    expect(occupyRender.reports[0]).toMatchObject({
      category: "occupy",
      result: "success"
    });
    expect(occupyRender.sidePanelHtml).toContain("Poslední reporty");
    expect(occupyRender.sidePanelHtml).toContain("Obsazení success v district:connector:1");
    expect(occupyRender.sidePanelHtml).toContain("data-report-highlight=\"latest-command\"");
    expect(occupyRender.sidePanelHtml).toContain("Vliv -5");
    expect(occupyRender.sidePanelHtml).toContain("Heat +2");
  });

  it("returns a clear error and a valid read model for invalid first-loop commands", async () => {
    const server = createServerApp();
    const request = createLoadRequest(1);

    await ensureGameplaySliceSessionResult(server.instanceManager, request);
    const runtime = server.instanceManager.getInstanceById(serverInstanceId)!;
    const homeDistrictId = runtime.state.playersById[request.playerId]!.homeDistrictId!;
    const load = server.gameplaySliceTransport.load(request);
    const response = server.gameplaySliceTransport.submit({
      sessionToken: load.sessionToken,
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

const createOccupyCommand = (input: {
  id: string;
  playerId: string;
  sourceDistrictId: DistrictId;
  targetDistrictId: DistrictId;
}): OccupyDistrictCommand => ({
  id: input.id,
  type: "occupy-district",
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

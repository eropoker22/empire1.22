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
import { createDevGameplaySession } from "../helpers/gameplay-session-test-helpers";

const serverInstanceId = "instance:free-first-loop";
type TestLoadRequest = LoadGameplaySliceRequest & {
  playerId: string;
  serverInstanceId: string;
};

const createLoadRequest = (
  index: number,
  overrides: Partial<LoadGameplaySliceRequest> = {}
): TestLoadRequest => ({
  districtId: `district:requested:${index}`,
  factionId: "mafian",
  ...overrides,
  serverInstanceId: overrides.serverInstanceId ?? serverInstanceId,
  playerId: overrides.playerId ?? `player:first-loop:${index}`
});

describe("gameplay slice first 10 minutes shared city loop", () => {
  it("loads a player into an assigned home district with neighbors and action targets", async () => {
    const server = createServerApp();
    const request = createLoadRequest(1, { districtId: "district:not-in-shared-city" });

    await ensureGameplaySliceSessionResult(server.instanceManager, request);
    const response = await loadGameplaySlice(server, request);
    const readModel = response.readModel as GameplaySliceView;
    const runtime = server.instanceManager.getInstanceById(serverInstanceId);
    const homeDistrictId = readModel.player.homeDistrictId;
    const homeSummary = readModel.districts.find((district) => district.districtId === homeDistrictId);

    expect(response.accepted).toBe(true);
    expect(response.metadata?.serverTick).toBe(runtime?.state.root.tick);
    expect(readModel.district?.districtId).toBe(homeDistrictId);
    expect(readModel.district?.isOwnedByPlayer).toBe(true);
    expect(homeSummary?.adjacentDistrictIds.length).toBeGreaterThan(0);
    expect(readModel.district?.spyTargets.some((target) => target.enabled)).toBe(true);
    expect(readModel.district?.attackTargets.length).toBeGreaterThan(0);
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
    expect(readModel.onboarding?.canAttack).toBe(false);
  });

  it("client selects server-confirmed district when initial focus is server-assigned", async () => {
    const server = createServerApp();
    const request = createLoadRequest(1, {
      districtId: null,
      preferredStartDistrictId: "district:27"
    });

    await ensureGameplaySliceSessionResult(server.instanceManager, request);
    const sessionRequest = await withDevSession(server, request);
    const runtime = server.instanceManager.getInstanceById(serverInstanceId)!;
    const homeDistrictId = runtime.state.playersById[request.playerId]!.homeDistrictId!;
    const client = createClientApp({
      transport: createInMemoryClientTransport(server.gameplaySliceTransport)
    });
    const render = await client.load(sessionRequest);

    expect(render.districtPanel?.districtId).toBe(homeDistrictId);
    expect(render.mapDistricts.find((district) => district.districtId === homeDistrictId)?.isSelected).toBe(true);
    expect(render.player?.homeDistrictId).toBe(homeDistrictId);
    expect(render.topBarHtml).toContain(`Domovský district: ${homeDistrictId}`);
  });

  it("loads without a concrete district focus but rejects server-assigned submit focus", async () => {
    const server = createServerApp();
    const request: TestLoadRequest = {
      serverInstanceId,
      playerId: "player:first-loop:no-focus",
      factionId: "mafian"
    };

    await ensureGameplaySliceSessionResult(server.instanceManager, request);
    const missingFocusLoad = await loadGameplaySlice(server, request);
    const missingFocusReadModel = missingFocusLoad.readModel as GameplaySliceView;
    const runtime = server.instanceManager.getInstanceById(serverInstanceId)!;
    const homeDistrictId = missingFocusReadModel.player.homeDistrictId!;
    const serverAssignedLoad = await loadGameplaySlice(server, {
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

    const rejectedSubmit = await server.gameplaySliceTransport.submit({
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
    await withDevSession(server, firstRequest);
    await withDevSession(server, secondRequest);
    const runtime = server.instanceManager.getInstanceById(serverInstanceId)!;
    const firstHome = runtime.state.playersById[firstRequest.playerId]?.homeDistrictId;
    const secondHome = runtime.state.playersById[secondRequest.playerId]?.homeDistrictId;
    const response = await loadGameplaySlice(server, firstRequest);
    const readModel = response.readModel as GameplaySliceView;

    expect(firstHome).toBeTruthy();
    expect(secondHome).toBeTruthy();
    expect(firstHome).not.toBe(secondHome);
    const path = findDistrictPath(runtime.state, firstHome!, secondHome!);
    expect(path?.[0]).toBe(firstHome);
    expect(path?.[path.length - 1]).toBe(secondHome);
    expect(readModel.district?.spyTargets.some((target) => target.enabled)).toBe(true);
    expect(readModel.district?.attackTargets.length).toBeGreaterThan(0);
  });

  it("submits spy and attack commands through the existing command flow and returns reports", async () => {
    const server = createServerApp();
    const firstRequest = createLoadRequest(1);
    const secondRequest = createLoadRequest(2, { factionId: "kartel" });

    await ensureGameplaySliceSessionResult(server.instanceManager, firstRequest);
    await ensureGameplaySliceSessionResult(server.instanceManager, secondRequest);
    await withDevSession(server, secondRequest);
    const initial = await loadGameplaySlice(server, firstRequest);
    const initialReadModel = initial.readModel as GameplaySliceView;
    const sourceDistrictId = initialReadModel.district!.districtId;
    const runtime = server.instanceManager.getInstanceById(serverInstanceId)!;
    const spyTargets = initialReadModel.district!.spyTargets.filter((target) => target.enabled);
    let targetDistrictId: DistrictId | null = null;
    let spyReadModel: GameplaySliceView | null = null;

    for (const [index, target] of spyTargets.entries()) {
      runtime.state.districtsById[target.districtId] = {
        ...runtime.state.districtsById[target.districtId],
        ownerPlayerId: secondRequest.playerId
      };
      const spy = await server.gameplaySliceTransport.submit({
        sessionToken: initial.sessionToken,
        focusDistrictId: sourceDistrictId,
        command: createSpyCommand({
          id: `command:first-loop:spy:${index}`,
          playerId: firstRequest.playerId,
          sourceDistrictId,
          targetDistrictId: target.districtId
        })
      });
      const candidateReadModel = spy.readModel as GameplaySliceView;

      expect(spy.accepted).toBe(true);
      expect(spy.errors).toEqual([]);
      expect(spy.metadata?.serverTick).toBe(0);
      if (candidateReadModel.reports[0]?.result === "success") {
        targetDistrictId = target.districtId;
        spyReadModel = candidateReadModel;
        break;
      }
    }

    expect(targetDistrictId, "Expected a deterministic successful spy target for attack authorization.").toBeTruthy();
    expect(spyReadModel).not.toBeNull();
    expect(spyReadModel!.reports[0]).toMatchObject({
      reportType: "spy",
      actionType: "spy-district",
      sourceDistrictId,
      targetDistrictId
    });
    expect(Array.isArray(spyReadModel!.cityFeed?.currentPlayerFeed)).toBe(true);

    setPlayerPopulation(runtime.state, firstRequest.playerId, 100);

    const attack = await server.gameplaySliceTransport.submit({
      sessionToken: initial.sessionToken,
      focusDistrictId: sourceDistrictId,
      command: createAttackCommand({
        id: "command:first-loop:attack:1",
        playerId: firstRequest.playerId,
        sourceDistrictId,
        targetDistrictId: targetDistrictId!
      })
    });
    const attackReadModel = attack.readModel as GameplaySliceView;

    expect(attack.errors).toEqual([]);
    expect(attack.accepted).toBe(true);
    expect(attack.metadata?.serverTick).toBe(0);
    expect(attackReadModel.reports[0]).toMatchObject({
      reportType: "battle",
      actionType: "attack-district",
      sourceDistrictId,
      targetDistrictId: targetDistrictId!
    });
  });

  it("unlocks and submits occupy-district after successful spy intel on a neutral neighbor", async () => {
    const server = createServerApp();
    const request = createLoadRequest(1);

    await ensureGameplaySliceSessionResult(server.instanceManager, request);
    await withDevSession(server, request);
    const runtime = server.instanceManager.getInstanceById(serverInstanceId)!;
    const homeDistrictId = runtime.state.playersById[request.playerId]!.homeDistrictId!;
    runtime.state.districtsById[homeDistrictId] = {
      ...runtime.state.districtsById[homeDistrictId],
      influence: 10
    };
    setPlayerPopulation(runtime.state, request.playerId, 1000);
    const initial = await loadGameplaySlice(server, request);
    const initialReadModel = initial.readModel as GameplaySliceView;
    const sourceDistrictId = initialReadModel.district!.districtId;
    const targetDistrictId = initialReadModel.district!.occupyTargets.find((target) =>
      target.disabledCode === "OCCUPY_SPY_REQUIRED"
    )!.districtId;

    expect(initialReadModel.district!.spyTargets.some((target) =>
      target.districtId === targetDistrictId && target.enabled
    )).toBe(true);
    expect(initialReadModel.district!.occupyTargets).toContainEqual(expect.objectContaining({
      districtId: targetDistrictId,
      enabled: false,
      disabledCode: "OCCUPY_SPY_REQUIRED",
      cost: { influence: 5, population: 50 },
      heatGain: 2
    }));

    const spy = await server.gameplaySliceTransport.submit({
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

    const occupy = await server.gameplaySliceTransport.submit({
      sessionToken: initial.sessionToken,
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
      influenceCost: 5,
      populationCost: 50,
      populationLost: 45,
      populationRefunded: 5
    });
    expect(occupyReadModel.cityFeed?.currentPlayerFeed.some((event) =>
      event.sourceType === "district_occupy" && event.districtId === targetDistrictId
    )).toBe(true);
    expect(occupy.metadata?.serverTick).toBe(runtime.state.root.tick);
  });

  it("renders an occupy report from the server read model in the client report panel", async () => {
    const server = createServerApp();
    const request = createLoadRequest(1);

    await ensureGameplaySliceSessionResult(server.instanceManager, request);
    const sessionRequest = await withDevSession(server, request);
    const runtime = server.instanceManager.getInstanceById(serverInstanceId)!;
    const homeDistrictId = runtime.state.playersById[request.playerId]!.homeDistrictId!;
    runtime.state.districtsById[homeDistrictId] = {
      ...runtime.state.districtsById[homeDistrictId],
      influence: 10
    };
    setPlayerPopulation(runtime.state, request.playerId, 1000);
    const client = createClientApp({
      transport: createInMemoryClientTransport(server.gameplaySliceTransport)
    });
    await client.load(sessionRequest);
    const sourceDistrictId = client.getGameplaySlice()!.district!.districtId;
    const targetDistrictId = client.getGameplaySlice()!.district!.occupyTargets.find((target) =>
      target.disabledCode === "OCCUPY_SPY_REQUIRED"
    )!.districtId;

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
    expect(occupyRender.sidePanelHtml).toContain(`Obsazení success v ${targetDistrictId}`);
    expect(occupyRender.sidePanelHtml).toContain("data-report-highlight=\"latest-command\"");
    expect(occupyRender.sidePanelHtml).toContain("Vliv -5");
    expect(occupyRender.sidePanelHtml).toContain("Hledanost +2");
  });

  it("returns a clear error and a valid read model for invalid first-loop commands", async () => {
    const server = createServerApp();
    const request = createLoadRequest(1);

    await ensureGameplaySliceSessionResult(server.instanceManager, request);
    const load = await loadGameplaySlice(server, request);
    const runtime = server.instanceManager.getInstanceById(serverInstanceId)!;
    const homeDistrictId = (load.readModel as GameplaySliceView).player.homeDistrictId!;
    const response = await server.gameplaySliceTransport.submit({
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
        message: "Cílový district district:missing-target nebyl nalezen."
      }
    ]);
    expect(readModel.district?.districtId).toBe(homeDistrictId);
    expect(response.metadata?.serverTick).toBe(runtime.state.root.tick);
  });

  it("keeps the shared city map valid after several ticks", async () => {
    const server = createServerApp();
    const firstRequest = createLoadRequest(1);
    const secondRequest = createLoadRequest(2);

    await withDevSession(server, firstRequest);
    await withDevSession(server, secondRequest);
    const runtime = server.instanceManager.getInstanceById(serverInstanceId)!;
    const districtIdsBeforeTicks = [...runtime.state.root.districtIds];
    const playerIdsBeforeTicks = [...runtime.state.root.playerIds];

    for (let index = 0; index < 3; index += 1) {
      server.instanceManager.tickInstance(serverInstanceId);
    }

    const tickedRuntime = server.instanceManager.getInstanceById(serverInstanceId)!;
    expect(tickedRuntime.state.root.tick).toBe(1);
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

const setPlayerPopulation = (
  state: CoreGameState,
  playerId: string,
  population: number
): void => {
  const player = state.playersById[playerId];
  if (!player) return;

  state.resourceStatesById[player.resourceStateId] = {
    ...state.resourceStatesById[player.resourceStateId],
    id: player.resourceStateId,
    ownerType: "player",
    ownerId: player.id,
    balances: {
      ...state.resourceStatesById[player.resourceStateId]?.balances,
      population
    },
    incomeModifiers: state.resourceStatesById[player.resourceStateId]?.incomeModifiers ?? {},
    lastUpdatedTick: state.root.tick,
    version: state.resourceStatesById[player.resourceStateId]?.version ?? 1
  };
};

const loadGameplaySlice = async (
  server: ReturnType<typeof createServerApp>,
  request: LoadGameplaySliceRequest
) => {
  const sessionRequest = await withDevSession(server, request);
  const response = await server.gameplaySliceTransport.load(sessionRequest);
  return {
    ...response,
    sessionToken: sessionRequest.sessionToken
  };
};

const withDevSession = async (
  server: ReturnType<typeof createServerApp>,
  request: LoadGameplaySliceRequest
): Promise<LoadGameplaySliceRequest> => {
  if (request.sessionToken) {
    return request;
  }
  return (await createDevGameplaySession(server, {
    serverInstanceId: request.serverInstanceId,
    playerId: request.playerId ?? "",
    districtId: request.districtId,
    preferredStartDistrictId: request.preferredStartDistrictId,
    factionId: request.factionId,
    autoSelectSpawn: true
  })).loadRequest;
};

const isConnectedDistrictGraph = (state: CoreGameState): boolean => {
  const [firstDistrictId] = state.root.districtIds;
  if (!firstDistrictId) return true;
  return state.root.districtIds.every((districtId) => findDistrictPath(state, firstDistrictId, districtId) !== null);
};

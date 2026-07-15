import { describe, expect, it } from "vitest";
import type { Alliance, Building, District, Player } from "@empire/shared-types";
import {
  applyCommand,
  createCityFeedProjection,
  createPoliceReadModel,
  runTick,
  type CoreGameState
} from "@empire/game-core";
import { resolveModeConfig } from "@empire/game-config";
import {
  createAllianceFixture,
  createCoreStateFixture,
  createDistrictFixture,
  createFixedBuildingFixture,
  createPlayerFixture,
  createResourceStateFixture
} from "../../fixtures/game-state-fixtures";
import {
  createAttackDistrictCommandFixture,
  createCollectProductionCommandFixture,
  createCraftItemCommandFixture,
  createOccupyDistrictCommandFixture,
  createRunBuildingActionCommandFixture,
  createSpyDistrictCommandFixture
} from "../../fixtures/command-fixtures";

const FREE_CONFIG = resolveModeConfig("free");
const CONTEXT = { config: FREE_CONFIG };
const TICKS_PER_MINUTE = Math.ceil(60_000 / FREE_CONFIG.tickRateMs);
const TOTAL_DISTRICTS = 40;
const CONTROL_DOMINANCE_MILESTONE = 0.75;

type ScenarioKind =
  | "new-player"
  | "normal"
  | "aggressive"
  | "passive"
  | "snowball"
  | "alliance"
  | "low-activity";

interface ScenarioPlan {
  kind: ScenarioKind;
  minutes: number;
  playerIds: string[];
  initialOwnedByPlayer: Record<string, number[]>;
  allianceId?: string;
  collectEveryMinutes?: number;
  craftMinutes?: number[];
  spyMinutes?: number[];
  attackMinutes?: number[];
  dirtyActionMinutes?: number[];
}

interface ScenarioMetrics {
  name: ScenarioKind;
  minutes: number;
  firstCollectMinute: number | null;
  firstCraftMinute: number | null;
  firstSpyMinute: number | null;
  firstAttackMinute: number | null;
  firstExpansionMinute: number | null;
  firstPoliceWarningMinute: number | null;
  firstRaidMinute: number | null;
  ownedDistricts: number;
  winProgress: number;
  resources: Record<string, number>;
  storageUsage: Record<string, number>;
  craftedItems: number;
  successfulAttacks: number;
  failedAttacks: number;
  heat: number;
  aggregatePolicePressure: number;
  pendingRaids: number;
  resolvedRaids: number;
  dirtyCash: number;
  cleanCash: number;
  cityFeedEvents: number;
  maxOpenPendingRaids: number;
  mostUsedBuildings: Record<string, number>;
  mostUsedActions: Record<string, number>;
  timeline: Array<{
    minute: number;
    ownedDistricts: number;
    cleanCash: number;
    dirtyCash: number;
    heat: number;
    aggregatePolicePressure: number;
    pendingRaids: number;
    cityFeedEvents: number;
    winProgress: number;
  }>;
}

const runtimeEnv = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {};

const plans: ScenarioPlan[] = [
  {
    kind: "new-player",
    minutes: 15,
    playerIds: ["player:1"],
    initialOwnedByPlayer: { "player:1": [1] },
    collectEveryMinutes: 2,
    craftMinutes: [6],
    spyMinutes: [10],
    attackMinutes: [12],
    dirtyActionMinutes: []
  },
  {
    kind: "normal",
    minutes: 60,
    playerIds: ["player:1"],
    initialOwnedByPlayer: { "player:1": [1] },
    collectEveryMinutes: 4,
    craftMinutes: [8, 22, 38],
    spyMinutes: [12, 28, 44],
    attackMinutes: [16, 34, 52],
    dirtyActionMinutes: [20, 42]
  },
  {
    kind: "aggressive",
    minutes: 60,
    playerIds: ["player:1"],
    initialOwnedByPlayer: { "player:1": [1, 2] },
    collectEveryMinutes: 3,
    craftMinutes: [6, 18, 30, 42],
    spyMinutes: [6, 14, 22, 30, 38, 46, 54],
    attackMinutes: [9, 15, 21, 27, 33, 39, 45, 51, 57],
    dirtyActionMinutes: [12, 24, 36, 48]
  },
  {
    kind: "passive",
    minutes: 60,
    playerIds: ["player:1"],
    initialOwnedByPlayer: { "player:1": [1] },
    collectEveryMinutes: 8,
    craftMinutes: [20, 45],
    spyMinutes: [],
    attackMinutes: [],
    dirtyActionMinutes: []
  },
  {
    kind: "snowball",
    minutes: 60,
    playerIds: ["player:1"],
    initialOwnedByPlayer: { "player:1": [1, 2, 3, 4] },
    collectEveryMinutes: 2,
    craftMinutes: [4, 10, 16, 22, 28, 34, 40, 46],
    spyMinutes: [5, 11, 17, 23, 29, 35, 41, 47, 53],
    attackMinutes: [6, 12, 18, 24, 30, 36, 42, 48, 54],
    dirtyActionMinutes: [8, 20, 32, 44, 56]
  },
  {
    kind: "alliance",
    minutes: 60,
    playerIds: ["player:1", "player:2", "player:3", "player:4"],
    initialOwnedByPlayer: {
      "player:1": [1],
      "player:2": [11],
      "player:3": [21],
      "player:4": [31]
    },
    allianceId: "alliance:1",
    collectEveryMinutes: 4,
    craftMinutes: [8, 20, 32, 44],
    spyMinutes: [8, 16, 24, 32, 40, 48],
    attackMinutes: [10, 18, 26, 34, 42, 50, 58],
    dirtyActionMinutes: [22, 46]
  },
  {
    kind: "low-activity",
    minutes: 60,
    playerIds: ["player:1"],
    initialOwnedByPlayer: { "player:1": [1] },
    collectEveryMinutes: 20,
    craftMinutes: [40],
    spyMinutes: [],
    attackMinutes: [],
    dirtyActionMinutes: []
  }
];

describe("free session balance and anti-snowball simulation", () => {
  it("keeps free mode pacing, pressure, and safety inside MVP targets", () => {
    const results = Object.fromEntries(plans.map((plan) => [plan.kind, simulate(plan)])) as Record<ScenarioKind, ScenarioMetrics>;

    if (runtimeEnv.FREE_BALANCE_SIM_LOG === "1") {
      console.info("FREE_BALANCE_ANTI_SNOWBALL", JSON.stringify(toScenarioSummary(results), null, 2));
    }

    expect(results["new-player"].firstCollectMinute).toBeNull();
    expect(results["new-player"].firstCraftMinute).toBeGreaterThanOrEqual(5);
    expect(results["new-player"].firstCraftMinute).toBeLessThanOrEqual(10);
    expect(results["new-player"].firstSpyMinute).toBeLessThanOrEqual(20);
    if (results["new-player"].firstExpansionMinute !== null) {
      expect(results["new-player"].firstExpansionMinute).toBeLessThanOrEqual(20);
    }
    expect(results["new-player"].ownedDistricts).toBeGreaterThanOrEqual(1);

    expect(results.normal.ownedDistricts).toBeGreaterThanOrEqual(results.passive.ownedDistricts);
    expect(results.normal.mostUsedActions["spy-district"]).toBeGreaterThan(0);
    expect(results.normal.craftedItems).toBeGreaterThanOrEqual(2);
    expect(results.normal.aggregatePolicePressure).toBeGreaterThan(results.passive.aggregatePolicePressure);
    if (results.normal.firstPoliceWarningMinute !== null) {
      expect(results.normal.firstPoliceWarningMinute).toBeGreaterThanOrEqual(15);
      expect(results.normal.firstPoliceWarningMinute).toBeLessThanOrEqual(60);
    }

    expect(results.aggressive.aggregatePolicePressure).toBeGreaterThan(results.passive.aggregatePolicePressure);
    expect(results.aggressive.firstPoliceWarningMinute).not.toBeNull();
    expect(results.aggressive.ownedDistricts).toBeGreaterThan(results.normal.ownedDistricts);

    expect(results.passive.mostUsedActions["collect-production"] ?? 0).toBe(0);
    expect(results["low-activity"].mostUsedActions["collect-production"] ?? 0).toBe(0);
    expect(results.passive.ownedDistricts).toBe(1);
    expect(results["low-activity"].cleanCash).toBeGreaterThan(0);
    expect(results["low-activity"].ownedDistricts).toBe(1);

    expect(results.snowball.ownedDistricts).toBeGreaterThan(results.aggressive.ownedDistricts);
    expect(results.snowball.aggregatePolicePressure).toBeGreaterThan(results.aggressive.aggregatePolicePressure);
    expect(results.snowball.pendingRaids + results.snowball.resolvedRaids).toBeGreaterThanOrEqual(
      results.aggressive.pendingRaids + results.aggressive.resolvedRaids
    );
    expect(results.snowball.ownedDistricts).toBeLessThan(Math.ceil(TOTAL_DISTRICTS * CONTROL_DOMINANCE_MILESTONE));

    expect(results.alliance.winProgress).toBeLessThan(0.7);
    expect(results.alliance.winProgress).toBeLessThan(CONTROL_DOMINANCE_MILESTONE);

    for (const result of Object.values(results)) {
      assertNoUnsafeNumbers(result);
      expect(result.maxOpenPendingRaids).toBeLessThanOrEqual(FREE_CONFIG.balance.police!.maxPendingRaidsPerPlayer);
      expect(Object.values(result.resources).every((value) => value >= 0)).toBe(true);
      expect(result.timeline.length).toBe(result.minutes);
    }
  });

  it("documents key free-mode knobs used by the balance simulation", () => {
    expect(FREE_CONFIG).toMatchObject({
      tickRateMs: 5000,
      balance: {
        maxPlayersPerServer: 20,
        maxAllianceSize: 4,
        victoryConditionKey: "final-lockdown",
        allowDurationVictoryFallback: false,
        hardTimeoutTicks: 120960,
        cooldownMultiplier: 0.8,
        productionMultiplier: 1.2,
        conflict: {
          spyCooldownTicks: 72,
          attackCooldownTicks: 264,
          occupyCooldownTicks: 144,
          minAttackDurationTicks: 264,
          attackHeatGain: 8
        },
        police: {
          highPressureRaidThreshold: 115,
          extremePressureRaidThreshold: 180,
          raidDurationTicks: 360,
          pendingRaidTtlTicks: 360,
          maxPendingRaidsPerPlayer: 1
        }
      }
    });
    expect(FREE_CONFIG.balance.districtControlVictoryThreshold).toBe(1);
    expect(FREE_CONFIG.balance.districtControlVictoryThreshold).not.toBe(0.75);
    expect(FREE_CONFIG.balance.minimumVictoryTicks).toBeUndefined();
    expect(FREE_CONFIG.balance.districtControlHoldTicks).toBeUndefined();
    expect(resolveModeConfig("war").balance.districtControlVictoryThreshold).toBeDefined();
  });
});

const simulate = (plan: ScenarioPlan): ScenarioMetrics => {
  let state = createSimulationState(plan);
  const metrics = createInitialMetrics(plan);

  for (let minute = 1; minute <= plan.minutes; minute += 1) {
    for (let step = 0; step < TICKS_PER_MINUTE; step += 1) {
      const tickResult = runTick(state, CONTEXT);
      state = tickResult.nextState;
      captureTickEvents(metrics, state, tickResult.events);
    }
    executeMinutePlan(plan, state, metrics, minute);
    captureMinute(metrics, state, minute, plan.allianceId);
  }

  return metrics;
};

const createSimulationState = (plan: ScenarioPlan): CoreGameState => {
  const state = createCoreStateFixture();
  state.serverInstance.worldSeed = `free-balance:${plan.kind}`;
  state.playersById = {};
  state.districtsById = {};
  state.buildingsById = {};
  state.resourceStatesById = {};
  state.cooldownStatesById = {};
  state.policeStatesById = {};
  state.root.playerIds = [];
  state.root.districtIds = [];
  state.root.notificationIds = [];

  if (plan.allianceId) {
    state.alliancesById[plan.allianceId] = createAllianceFixture({
      id: plan.allianceId,
      memberIds: plan.playerIds,
      ownerPlayerId: plan.playerIds[0]
    }) as Alliance;
    state.root.allianceIds = [plan.allianceId];
  }

  for (const playerId of plan.playerIds) {
    const index = Number(playerId.split(":")[1] ?? 1);
    const player = createPlayerFixture({
      id: playerId,
      accountId: `account:${index}`,
      name: `Player ${index}`,
      homeDistrictId: `district:${plan.initialOwnedByPlayer[playerId]?.[0] ?? index}`,
      resourceStateId: `resource:${playerId}`,
      cooldownStateId: `cooldown:${playerId}`,
      effectStateId: `effect:${playerId}`,
      policeStateId: `police:${playerId}`,
      allianceId: plan.allianceId ?? null,
      population: resolveStartingPopulation(plan.kind),
      attackLoadout: {
        "baseball-bat": plan.kind === "new-player" ? 3 : 8,
        pistol: plan.kind === "new-player" ? 1 : 4,
        smg: plan.kind === "snowball" ? 2 : 0
      }
    }) as Player;
    state.playersById[playerId] = player;
    state.root.playerIds.push(playerId);
    state.resourceStatesById[player.resourceStateId] = createResourceStateFixture({
      id: player.resourceStateId,
      ownerType: "player",
      ownerId: player.id,
      balances: {
        cash: plan.kind === "snowball" ? 5000 : 1500,
        "dirty-cash": plan.kind === "snowball" ? 3500 : 300,
        population: resolveStartingPopulation(plan.kind),
        chemicals: 10,
        biomass: 6,
        "metal-parts": plan.kind === "snowball" ? 30 : 8,
        "tech-core": plan.kind === "snowball" ? 8 : 2
      }
    });
  }

  for (let id = 1; id <= TOTAL_DISTRICTS; id += 1) {
    const ownerPlayerId = findOwner(plan, id);
    const district = createDistrictFixture({
      id: `district:${id}`,
      name: `District ${id}`,
      templateId: `template:${id}`,
      ownerPlayerId,
      controllerAllianceId: ownerPlayerId ? plan.allianceId ?? null : null,
      status: ownerPlayerId ? "claimed" : "neutral",
      zone: resolveZone(id),
      adjacentDistrictIds: [id > 1 ? `district:${id - 1}` : "", id < TOTAL_DISTRICTS ? `district:${id + 1}` : ""].filter(Boolean),
      influence: ownerPlayerId ? 8 : 0,
      defenseLoadout: ownerPlayerId ? {} : { barricades: id <= 5 ? 0 : 1 },
      buildingIds: []
    }) as District;
    state.districtsById[district.id] = district;
    state.root.districtIds.push(district.id);
  }

  for (const [playerId, districtIds] of Object.entries(plan.initialOwnedByPlayer)) {
    for (const districtNumber of districtIds) {
      attachStarterBuildings(state, `district:${districtNumber}`, playerId, plan.kind);
    }
  }

  return state;
};

const executeMinutePlan = (
  plan: ScenarioPlan,
  state: CoreGameState,
  metrics: ScenarioMetrics,
  minute: number
): void => {
  for (const playerId of plan.playerIds) {
    if (plan.collectEveryMinutes && minute % plan.collectEveryMinutes === 0) {
      collectReadyProduction(state, metrics, playerId, minute);
    }
    if (plan.craftMinutes?.includes(minute)) {
      craftFirstAvailableArmoryItem(state, metrics, playerId, minute);
    }
    if (plan.dirtyActionMinutes?.includes(minute)) {
      runFirstDirtyAction(state, metrics, playerId, minute);
    }
    if (plan.spyMinutes?.includes(minute)) {
      spyNextTarget(state, metrics, playerId, minute);
    }
    if (plan.attackMinutes?.includes(minute)) {
      expandOrAttackNextTarget(state, metrics, playerId, minute);
    }
  }
};

const collectReadyProduction = (
  state: CoreGameState,
  metrics: ScenarioMetrics,
  playerId: string,
  minute: number
): void => {
  for (const building of Object.values(state.buildingsById).filter((entry) => entry.ownerPlayerId === playerId)) {
    const profile = FREE_CONFIG.balance.productionBuildings?.[building.buildingTypeId];
    if (!profile) continue;
    const resourceState = state.resourceStatesById[`resource:${building.id}`];
    if (Math.max(0, Number(resourceState?.balances[profile.resourceKey] || 0)) <= 0) continue;
    const result = applyCommand(state, createCollectProductionCommandFixture({
      id: `command:${metrics.name}:${playerId}:collect:${building.id}:${minute}`,
      playerId,
      payload: { districtId: building.districtId, buildingId: building.id }
    }), CONTEXT);
    if (result.errors.length === 0) {
      copyState(state, result.nextState);
      metrics.firstCollectMinute ??= minute;
      increment(metrics.mostUsedBuildings, building.buildingTypeId);
      increment(metrics.mostUsedActions, "collect-production");
    }
  }
};

const craftFirstAvailableArmoryItem = (
  state: CoreGameState,
  metrics: ScenarioMetrics,
  playerId: string,
  minute: number
): void => {
  const armory = Object.values(state.buildingsById).find((building) =>
    building.ownerPlayerId === playerId && building.buildingTypeId === "armory" && !building.processing
  );
  if (!armory) return;
  const result = applyCommand(state, createCraftItemCommandFixture({
    id: `command:${metrics.name}:${playerId}:craft:${minute}`,
    playerId,
    payload: { districtId: armory.districtId, buildingId: armory.id, recipeId: "pistol" }
  }), CONTEXT);
  if (result.errors.length === 0) {
    copyState(state, result.nextState);
    metrics.firstCraftMinute ??= minute;
    metrics.craftedItems += 1;
    increment(metrics.mostUsedBuildings, "armory");
    increment(metrics.mostUsedActions, "craft:pistol");
  }
};

const runFirstDirtyAction = (
  state: CoreGameState,
  metrics: ScenarioMetrics,
  playerId: string,
  minute: number
): void => {
  const building = Object.values(state.buildingsById).find((entry) =>
    entry.ownerPlayerId === playerId && (entry.buildingTypeId === "exchange" || entry.buildingTypeId === "casino" || entry.buildingTypeId === "arcade")
  );
  if (!building) return;
  const actionId = building.buildingTypeId === "casino"
    ? "quiet_backroom"
    : building.buildingTypeId === "arcade"
      ? "back_cashdesk"
      : "good_rate";
  const result = applyCommand(state, createRunBuildingActionCommandFixture({
    id: `command:${metrics.name}:${playerId}:dirty:${minute}`,
    playerId,
    payload: { districtId: building.districtId, buildingId: building.id, actionId }
  }), CONTEXT);
  if (result.errors.length === 0) {
    copyState(state, result.nextState);
    increment(metrics.mostUsedBuildings, building.buildingTypeId);
    increment(metrics.mostUsedActions, actionId);
  }
};

const spyNextTarget = (state: CoreGameState, metrics: ScenarioMetrics, playerId: string, minute: number): void => {
  const route = findNextFrontierRoute(state, playerId);
  if (!route) return;
  const result = applyCommand(state, createSpyDistrictCommandFixture({
    id: `command:${metrics.name}:${playerId}:spy:${minute}`,
    playerId,
    payload: {
      sourceDistrictId: route.sourceDistrictId,
      districtId: route.targetDistrictId
    }
  }), CONTEXT);
  if (result.errors.length === 0) {
    copyState(state, result.nextState);
    metrics.firstSpyMinute ??= minute;
    increment(metrics.mostUsedActions, "spy-district");
  }
};

const expandOrAttackNextTarget = (state: CoreGameState, metrics: ScenarioMetrics, playerId: string, minute: number): void => {
  const route = findNextFrontierRoute(state, playerId);
  if (!route) return;
  const target = state.districtsById[route.targetDistrictId];
  if (!target) return;

  if (!target.ownerPlayerId) {
    occupyNeutralTarget(state, metrics, playerId, route, minute);
    return;
  }

  const targetBefore = state.districtsById[route.targetDistrictId]?.ownerPlayerId;
  const result = applyCommand(state, createAttackDistrictCommandFixture({
    id: `command:${metrics.name}:${playerId}:attack:${minute}`,
    playerId,
    payload: {
      sourceDistrictId: route.sourceDistrictId,
      districtId: route.targetDistrictId,
      weapons: { ...(state.playersById[playerId]?.attackLoadout ?? {}) }
    }
  }), CONTEXT);
  if (result.errors.length > 0) {
    metrics.failedAttacks += 1;
    return;
  }
  copyState(state, result.nextState);
  metrics.firstAttackMinute ??= minute;
  const targetAfter = state.districtsById[route.targetDistrictId]?.ownerPlayerId;
  if (targetBefore !== playerId && targetAfter === playerId) {
    metrics.successfulAttacks += 1;
    attachStarterBuildings(state, route.targetDistrictId, playerId, metrics.name);
  } else {
    metrics.failedAttacks += 1;
  }
  increment(metrics.mostUsedActions, "attack-district");
};

const occupyNeutralTarget = (
  state: CoreGameState,
  metrics: ScenarioMetrics,
  playerId: string,
  route: { sourceDistrictId: string; targetDistrictId: string },
  minute: number
): void => {
  const result = applyCommand(state, createOccupyDistrictCommandFixture({
    id: `command:${metrics.name}:${playerId}:occupy:${minute}`,
    playerId,
    payload: {
      sourceDistrictId: route.sourceDistrictId,
      districtId: route.targetDistrictId
    }
  }), CONTEXT);
  if (result.errors.length > 0) return;

  copyState(state, result.nextState);
  metrics.firstExpansionMinute ??= minute;
  if (state.districtsById[route.targetDistrictId]?.ownerPlayerId === playerId) {
    attachStarterBuildings(state, route.targetDistrictId, playerId, metrics.name);
  }
  increment(metrics.mostUsedActions, "occupy-district");
};

const attachStarterBuildings = (
  state: CoreGameState,
  districtId: string,
  playerId: string,
  kind: ScenarioKind
): void => {
  const baseTypes = ["apartment_block", "pharmacy", "factory", "armory", "warehouse"];
  const extraTypes = kind === "aggressive" || kind === "snowball"
    ? ["exchange", "casino", "smuggling_tunnel"]
    : kind === "passive" || kind === "low-activity"
      ? ["restaurant", "convenience_store", "fitness_club"]
      : ["exchange", "restaurant", "power_station"];
  for (const buildingTypeId of [...baseTypes, ...extraTypes]) {
    if (state.districtsById[districtId].buildingIds.some((buildingId) => state.buildingsById[buildingId]?.buildingTypeId === buildingTypeId)) {
      continue;
    }
    const building = createFixedBuildingFixture(buildingTypeId, {
      id: `building:${districtId}:${buildingTypeId}:${state.districtsById[districtId].buildingIds.length + 1}`,
      districtId,
      ownerPlayerId: playerId
    }) as Building;
    state.buildingsById[building.id] = building;
    state.districtsById[districtId] = {
      ...state.districtsById[districtId],
      buildingIds: [...state.districtsById[districtId].buildingIds, building.id],
      ownerPlayerId: playerId,
      controllerAllianceId: state.playersById[playerId]?.allianceId ?? null,
      status: "claimed"
    };
  }
};

const findNextFrontierRoute = (
  state: CoreGameState,
  playerId: string
): { sourceDistrictId: string; targetDistrictId: string } | null => {
  const owned = Object.values(state.districtsById)
    .filter((district) => district.ownerPlayerId === playerId)
    .sort(compareDistrictIds);
  for (const source of owned) {
    const targetDistrictId = source.adjacentDistrictIds.find((districtId) => {
      const target = state.districtsById[districtId];
      return target && target.status !== "destroyed" && target.ownerPlayerId !== playerId;
    });
    if (targetDistrictId) return { sourceDistrictId: source.id, targetDistrictId };
  }
  return null;
};

const captureTickEvents = (
  metrics: ScenarioMetrics,
  state: CoreGameState,
  events: ReturnType<typeof runTick>["events"]
): void => {
  const minute = Math.ceil(state.root.tick / TICKS_PER_MINUTE);
  for (const event of events) {
    if (event.type === "police-warning-issued") {
      metrics.firstPoliceWarningMinute ??= minute;
    }
    if (event.type === "police-raid-triggered") {
      metrics.firstRaidMinute ??= minute;
      metrics.pendingRaids += 1;
    }
    if (event.type === "police-raid-resolved") {
      metrics.resolvedRaids += 1;
    }
  }
};

const captureMinute = (
  metrics: ScenarioMetrics,
  state: CoreGameState,
  minute: number,
  allianceId?: string
): void => {
  const playerId = metrics.name === "alliance" ? "player:1" : "player:1";
  const police = createPoliceReadModel(state, playerId, CONTEXT);
  const player = state.playersById[playerId];
  const resources = player ? { ...(state.resourceStatesById[player.resourceStateId]?.balances ?? {}) } : {};
  const ownedDistricts = countControlledDistricts(state, allianceId);
  const pendingRaids = Object.values(state.policeStatesById).reduce(
    (total, policeState) => total + (policeState.pendingRaids ?? []).filter((raid) => raid.status === "pending" || raid.status === "acknowledged").length,
    0
  );
  metrics.ownedDistricts = ownedDistricts;
  metrics.winProgress = ownedDistricts / TOTAL_DISTRICTS;
  metrics.resources = resources;
  metrics.storageUsage = resolveStorageUsage(state, playerId);
  metrics.heat = police.heat;
  metrics.aggregatePolicePressure = police.aggregatePressure;
  metrics.dirtyCash = Number(resources["dirty-cash"] || 0);
  metrics.cleanCash = Number(resources.cash || 0);
  metrics.cityFeedEvents = createCityFeedProjection(state, { playerId }).currentPlayerFeed.length;
  metrics.maxOpenPendingRaids = Math.max(metrics.maxOpenPendingRaids, pendingRaids);
  metrics.timeline.push({
    minute,
    ownedDistricts,
    cleanCash: metrics.cleanCash,
    dirtyCash: metrics.dirtyCash,
    heat: metrics.heat,
    aggregatePolicePressure: metrics.aggregatePolicePressure,
    pendingRaids,
    cityFeedEvents: metrics.cityFeedEvents,
    winProgress: metrics.winProgress
  });
};

const createInitialMetrics = (plan: ScenarioPlan): ScenarioMetrics => ({
  name: plan.kind,
  minutes: plan.minutes,
  firstCollectMinute: null,
  firstCraftMinute: null,
  firstSpyMinute: null,
  firstAttackMinute: null,
  firstExpansionMinute: null,
  firstPoliceWarningMinute: null,
  firstRaidMinute: null,
  ownedDistricts: 0,
  winProgress: 0,
  resources: {},
  storageUsage: {},
  craftedItems: 0,
  successfulAttacks: 0,
  failedAttacks: 0,
  heat: 0,
  aggregatePolicePressure: 0,
  pendingRaids: 0,
  resolvedRaids: 0,
  dirtyCash: 0,
  cleanCash: 0,
  cityFeedEvents: 0,
  maxOpenPendingRaids: 0,
  mostUsedBuildings: {},
  mostUsedActions: {},
  timeline: []
});

const findOwner = (plan: ScenarioPlan, districtNumber: number): string | null =>
  Object.entries(plan.initialOwnedByPlayer).find(([, districtIds]) => districtIds.includes(districtNumber))?.[0] ?? null;

const resolveStartingPopulation = (kind: ScenarioKind): number => {
  if (kind === "new-player") return 250;
  if (kind === "snowball") return 2000;
  return 800;
};

const resolveZone = (districtNumber: number): string =>
  districtNumber % 5 === 0 ? "industrial" : districtNumber % 4 === 0 ? "commercial" : districtNumber % 3 === 0 ? "park" : "residential";

const countControlledDistricts = (state: CoreGameState, allianceId?: string): number =>
  Object.values(state.districtsById).filter((district) =>
    allianceId
      ? district.controllerAllianceId === allianceId
      : district.ownerPlayerId === "player:1"
  ).length;

const resolveStorageUsage = (state: CoreGameState, playerId: string): Record<string, number> => {
  const player = state.playersById[playerId];
  if (!player) return {};
  const balances = state.resourceStatesById[player.resourceStateId]?.balances ?? {};
  return Object.fromEntries(["chemicals", "biomass", "metal-parts", "tech-core", "pistol", "smg"].map((key) => [
    key,
    Math.max(0, Number(balances[key] || 0))
  ]));
};

const copyState = (target: CoreGameState, source: CoreGameState): void => {
  Object.assign(target, source);
};

const increment = (collection: Record<string, number>, key: string): void => {
  collection[key] = (collection[key] ?? 0) + 1;
};

const compareDistrictIds = (left: District, right: District): number =>
  Number(left.id.split(":")[1] || 0) - Number(right.id.split(":")[1] || 0);

const toScenarioSummary = (results: Record<ScenarioKind, ScenarioMetrics>): Record<string, object> =>
  Object.fromEntries(
    Object.entries(results).map(([kind, metrics]) => [
      kind,
      {
        minutes: metrics.minutes,
        firstCollectMinute: metrics.firstCollectMinute,
        firstCraftMinute: metrics.firstCraftMinute,
        firstSpyMinute: metrics.firstSpyMinute,
        firstAttackMinute: metrics.firstAttackMinute,
        firstExpansionMinute: metrics.firstExpansionMinute,
        firstPoliceWarningMinute: metrics.firstPoliceWarningMinute,
        firstRaidMinute: metrics.firstRaidMinute,
        ownedDistricts: metrics.ownedDistricts,
        winProgress: Number(metrics.winProgress.toFixed(3)),
        cleanCash: Math.round(metrics.cleanCash),
        dirtyCash: Math.round(metrics.dirtyCash),
        craftedItems: metrics.craftedItems,
        successfulAttacks: metrics.successfulAttacks,
        failedAttacks: metrics.failedAttacks,
        heat: metrics.heat,
        aggregatePolicePressure: metrics.aggregatePolicePressure,
        pendingRaids: metrics.pendingRaids,
        resolvedRaids: metrics.resolvedRaids,
        cityFeedEvents: metrics.cityFeedEvents,
        maxOpenPendingRaids: metrics.maxOpenPendingRaids,
        mostUsedBuildings: metrics.mostUsedBuildings,
        mostUsedActions: metrics.mostUsedActions
      }
    ])
  );

const assertNoUnsafeNumbers = (metrics: ScenarioMetrics): void => {
  const values = [
    metrics.ownedDistricts,
    metrics.winProgress,
    metrics.craftedItems,
    metrics.successfulAttacks,
    metrics.failedAttacks,
    metrics.heat,
    metrics.aggregatePolicePressure,
    metrics.pendingRaids,
    metrics.resolvedRaids,
    metrics.dirtyCash,
    metrics.cleanCash,
    metrics.cityFeedEvents,
    metrics.maxOpenPendingRaids,
    ...Object.values(metrics.resources),
    ...Object.values(metrics.storageUsage),
    ...metrics.timeline.flatMap((entry) => [
      entry.minute,
      entry.ownedDistricts,
      entry.cleanCash,
      entry.dirtyCash,
      entry.heat,
      entry.aggregatePolicePressure,
      entry.pendingRaids,
      entry.cityFeedEvents,
      entry.winProgress
    ])
  ];
  expect(values.every((value) => Number.isFinite(value))).toBe(true);
  expect(metrics.timeline.every((entry) => entry.pendingRaids <= FREE_CONFIG.balance.police!.maxPendingRaidsPerPlayer * plans.find((plan) => plan.kind === metrics.name)!.playerIds.length)).toBe(true);
};

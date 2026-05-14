import { describe, expect, it } from "vitest";
import {
  createPoliceReadModel,
  resolveWantedLevel,
  runTick,
  type CoreGameState
} from "@empire/game-core";
import { resolveModeConfig } from "@empire/game-config";
import { createCoreStateFixture, createDistrictFixture, createFixedBuildingFixture } from "../../fixtures/game-state-fixtures";

const PLAYER_ID = "player:1";
const POLICE_STATE_ID = "police:1";
const RESOURCE_STATE_ID = "resource:1";
const FREE_CONFIG = resolveModeConfig("free");
const CONTEXT = { config: FREE_CONFIG };
const TICKS_PER_MINUTE = Math.round(60_000 / FREE_CONFIG.tickRateMs);
const SESSION_MINUTES = 120;
const SESSION_TICKS = SESSION_MINUTES * TICKS_PER_MINUTE;
const runtimeEnv = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {};

type RiskTier = "low" | "medium" | "high" | "extreme";

interface ScenarioDefinition {
  name: string;
  totalDistricts?: number;
  initialOwnedDistricts: number;
  initialPlayerHeat?: number;
  initialDistrictHeat?: Record<number, number>;
  initialResources?: Record<string, number>;
  passiveCashPerMinute?: number;
  passiveDirtyCashPerMinute?: number;
  passiveDistrictHeatPerMinute?: number;
  applyMinute?: (state: CoreGameState, minute: number) => void;
}

interface ScenarioMetrics {
  name: string;
  ticksElapsed: number;
  firstWarningMinute: number | null;
  firstPendingRaidMinute: number | null;
  maxRiskTier: RiskTier;
  maxAggregatePressure: number;
  maxDistrictHeatPressure: number;
  maxWantedLevel: number;
  pendingRaidCount: number;
  resolvedRaidCount: number;
  warningCount: number;
  highRaidCount: number;
  extremeRaidCount: number;
  targetedRaidCount: number;
  maxOpenPendingRaids: number;
  seizedDirtyCash: number;
  seizedResources: number;
  lockdownCount: number;
  heatReducedBy: number;
  finalHeat: number;
  finalDistrictHeatPressure: number;
  finalAggregatePressure: number;
  finalWantedLevel: number;
  finalResources: Record<string, number>;
  finalOwnedDistricts: number;
  hottestDistrictId: string | null;
  hottestDistrictHeat: number;
}

const riskScore: Record<RiskTier, number> = {
  low: 0,
  medium: 1,
  high: 2,
  extreme: 3
};

const createSimulationState = (scenario: ScenarioDefinition): CoreGameState => {
  const state = createCoreStateFixture();
  const totalDistricts = scenario.totalDistricts ?? 12;

  state.districtsById = {};
  state.buildingsById = {};
  state.root.districtIds = [];

  for (let index = 1; index <= totalDistricts; index += 1) {
    const districtId = `district:${index}`;
    const ownerPlayerId = index <= scenario.initialOwnedDistricts ? PLAYER_ID : null;
    state.districtsById[districtId] = createDistrictFixture({
      id: districtId,
      templateId: `template:${index}`,
      name: `District ${index}`,
      ownerPlayerId,
      adjacentDistrictIds: [
        index > 1 ? `district:${index - 1}` : "",
        index < totalDistricts ? `district:${index + 1}` : ""
      ].filter(Boolean),
      heat: scenario.initialDistrictHeat?.[index] ?? 0,
      buildingIds: []
    });
    state.root.districtIds.push(districtId);
    if (ownerPlayerId) {
      attachBuilding(state, districtId, "warehouse");
    }
  }

  state.playersById[PLAYER_ID] = {
    ...state.playersById[PLAYER_ID],
    homeDistrictId: "district:1"
  };
  state.resourceStatesById[RESOURCE_STATE_ID] = {
    ...state.resourceStatesById[RESOURCE_STATE_ID],
    balances: {
      cash: 1200,
      "dirty-cash": 250,
      chemicals: 20,
      "metal-parts": 16,
      "tech-core": 4,
      ...(scenario.initialResources ?? {})
    }
  };
  setPlayerHeat(state, scenario.initialPlayerHeat ?? 0);
  return state;
};

const attachBuilding = (state: CoreGameState, districtId: string, buildingTypeId: string): void => {
  const building = createFixedBuildingFixture(buildingTypeId, {
    id: `building:${districtId}:${buildingTypeId}:1`,
    districtId,
    ownerPlayerId: PLAYER_ID
  });
  state.buildingsById[building.id] = building;
  state.districtsById[districtId] = {
    ...state.districtsById[districtId],
    buildingIds: [...state.districtsById[districtId].buildingIds, building.id]
  };
};

const setPlayerHeat = (state: CoreGameState, heat: number): void => {
  const safeHeat = Math.max(0, Math.floor(heat));
  state.policeStatesById[POLICE_STATE_ID] = {
    id: POLICE_STATE_ID,
    ownerPlayerId: PLAYER_ID,
    heat: safeHeat,
    wantedLevel: resolveWantedLevel(safeHeat),
    lastDecayTick: 0,
    activeFlags: [],
    pendingRaids: state.policeStatesById[POLICE_STATE_ID]?.pendingRaids ?? [],
    policeEvents: state.policeStatesById[POLICE_STATE_ID]?.policeEvents ?? [],
    lastRaidCreatedAtTick: state.policeStatesById[POLICE_STATE_ID]?.lastRaidCreatedAtTick,
    lastRaidResolvedAtTick: state.policeStatesById[POLICE_STATE_ID]?.lastRaidResolvedAtTick,
    lastWarningAtTick: state.policeStatesById[POLICE_STATE_ID]?.lastWarningAtTick,
    version: (state.policeStatesById[POLICE_STATE_ID]?.version ?? 0) + 1
  };
};

const addPlayerHeat = (state: CoreGameState, heat: number): void => {
  const current = state.policeStatesById[POLICE_STATE_ID]?.heat ?? 0;
  setPlayerHeat(state, current + heat);
};

const ownedDistrictIds = (state: CoreGameState): string[] =>
  Object.values(state.districtsById)
    .filter((district) => district.ownerPlayerId === PLAYER_ID)
    .map((district) => district.id)
    .sort((left, right) => Number(left.split(":")[1]) - Number(right.split(":")[1]));

const addDistrictHeat = (state: CoreGameState, districtId: string, heat: number): void => {
  const district = state.districtsById[districtId];
  if (!district) return;
  state.districtsById[districtId] = {
    ...district,
    heat: Math.max(0, Number(district.heat || 0) + heat),
    version: district.version + 1
  };
};

const addHeatToOwnedDistrict = (state: CoreGameState, heat: number, offset = 0): void => {
  const districts = ownedDistrictIds(state);
  const districtId = districts[offset % Math.max(1, districts.length)];
  if (districtId) addDistrictHeat(state, districtId, heat);
};

const addResources = (state: CoreGameState, resources: Record<string, number>): void => {
  const resourceState = state.resourceStatesById[RESOURCE_STATE_ID];
  state.resourceStatesById[RESOURCE_STATE_ID] = {
    ...resourceState,
    balances: Object.entries(resources).reduce(
      (balances, [key, amount]) => ({
        ...balances,
        [key]: Math.max(0, Number(balances[key] || 0) + amount)
      }),
      { ...resourceState.balances }
    ),
    version: resourceState.version + 1
  };
};

const claimNextDistrict = (state: CoreGameState): void => {
  const nextDistrict = Object.values(state.districtsById)
    .sort((left, right) => Number(left.id.split(":")[1]) - Number(right.id.split(":")[1]))
    .find((district) => district.ownerPlayerId !== PLAYER_ID);
  if (!nextDistrict) return;
  state.districtsById[nextDistrict.id] = {
    ...nextDistrict,
    ownerPlayerId: PLAYER_ID,
    status: "claimed",
    version: nextDistrict.version + 1
  };
  attachBuilding(state, nextDistrict.id, "warehouse");
};

const applyPassiveMinute = (state: CoreGameState, scenario: ScenarioDefinition): void => {
  if (scenario.passiveCashPerMinute || scenario.passiveDirtyCashPerMinute) {
    addResources(state, {
      cash: scenario.passiveCashPerMinute ?? 0,
      "dirty-cash": scenario.passiveDirtyCashPerMinute ?? 0
    });
  }

  if (scenario.passiveDistrictHeatPerMinute) {
    for (const districtId of ownedDistrictIds(state)) {
      addDistrictHeat(state, districtId, scenario.passiveDistrictHeatPerMinute);
    }
  }
};

const createEmptyMetrics = (name: string): ScenarioMetrics => ({
  name,
  ticksElapsed: 0,
  firstWarningMinute: null,
  firstPendingRaidMinute: null,
  maxRiskTier: "low",
  maxAggregatePressure: 0,
  maxDistrictHeatPressure: 0,
  maxWantedLevel: 0,
  pendingRaidCount: 0,
  resolvedRaidCount: 0,
  warningCount: 0,
  highRaidCount: 0,
  extremeRaidCount: 0,
  targetedRaidCount: 0,
  maxOpenPendingRaids: 0,
  seizedDirtyCash: 0,
  seizedResources: 0,
  lockdownCount: 0,
  heatReducedBy: 0,
  finalHeat: 0,
  finalDistrictHeatPressure: 0,
  finalAggregatePressure: 0,
  finalWantedLevel: 0,
  finalResources: {},
  finalOwnedDistricts: 0,
  hottestDistrictId: null,
  hottestDistrictHeat: 0
});

const captureEvents = (metrics: ScenarioMetrics, state: CoreGameState, events: ReturnType<typeof runTick>["events"]): void => {
  const minute = Math.floor(state.root.tick / TICKS_PER_MINUTE);
  for (const event of events) {
    const payload = event.payload as Record<string, unknown>;
    if (event.type === "police-warning-issued") {
      metrics.warningCount += 1;
      metrics.firstWarningMinute ??= minute;
    }
    if (event.type === "police-raid-triggered") {
      metrics.pendingRaidCount += 1;
      metrics.firstPendingRaidMinute ??= minute;
      if (payload.severity === "high") metrics.highRaidCount += 1;
      if (payload.severity === "extreme") metrics.extremeRaidCount += 1;
      if (payload.targetDistrictId) metrics.targetedRaidCount += 1;
    }
    if (event.type === "police-raid-resolved") {
      metrics.resolvedRaidCount += 1;
      metrics.seizedDirtyCash += Math.max(0, Number(payload.seizedDirtyCash || 0));
      metrics.heatReducedBy += Math.max(0, Number(payload.heatReducedBy || 0));
      if (payload.lockedDistrictId) metrics.lockdownCount += 1;
      const seizedResources = payload.seizedResources && typeof payload.seizedResources === "object"
        ? payload.seizedResources as Record<string, number>
        : {};
      metrics.seizedResources += Object.values(seizedResources).reduce((total, amount) => total + Math.max(0, Number(amount || 0)), 0);
    }
  }
};

const captureModel = (metrics: ScenarioMetrics, state: CoreGameState): void => {
  const model = createPoliceReadModel(state, PLAYER_ID, CONTEXT);
  if (riskScore[model.riskTier] > riskScore[metrics.maxRiskTier]) {
    metrics.maxRiskTier = model.riskTier;
  }
  metrics.maxAggregatePressure = Math.max(metrics.maxAggregatePressure, model.aggregatePressure);
  metrics.maxDistrictHeatPressure = Math.max(metrics.maxDistrictHeatPressure, model.districtHeatPressure);
  metrics.maxWantedLevel = Math.max(metrics.maxWantedLevel, model.wantedLevel);
  metrics.maxOpenPendingRaids = Math.max(
    metrics.maxOpenPendingRaids,
    (state.policeStatesById[POLICE_STATE_ID].pendingRaids ?? []).filter((raid) => raid.status === "pending" || raid.status === "acknowledged").length
  );
  metrics.finalHeat = model.heat;
  metrics.finalDistrictHeatPressure = model.districtHeatPressure;
  metrics.finalAggregatePressure = model.aggregatePressure;
  metrics.finalWantedLevel = model.wantedLevel;
  metrics.hottestDistrictId = model.hottestDistrictId;
  metrics.hottestDistrictHeat = model.hottestDistrictHeat;
  metrics.finalResources = { ...state.resourceStatesById[RESOURCE_STATE_ID].balances };
  metrics.finalOwnedDistricts = ownedDistrictIds(state).length;
};

const simulateScenario = (scenario: ScenarioDefinition): ScenarioMetrics => {
  let state = createSimulationState(scenario);
  const metrics = createEmptyMetrics(scenario.name);

  for (let tick = 0; tick < SESSION_TICKS; tick += 1) {
    if (tick % TICKS_PER_MINUTE === 0) {
      const minute = tick / TICKS_PER_MINUTE;
      applyPassiveMinute(state, scenario);
      scenario.applyMinute?.(state, minute);
    }
    const tickResult = runTick(state, CONTEXT);
    state = tickResult.nextState;
    captureEvents(metrics, state, tickResult.events);
    captureModel(metrics, state);
  }

  metrics.ticksElapsed = SESSION_TICKS;
  return metrics;
};

const scenarios: ScenarioDefinition[] = [
  {
    name: "Quiet Builder",
    initialOwnedDistricts: 1,
    passiveCashPerMinute: 45,
    passiveDirtyCashPerMinute: 8,
    passiveDistrictHeatPerMinute: 0.03
  },
  {
    name: "Normal Player",
    initialOwnedDistricts: 1,
    passiveCashPerMinute: 70,
    passiveDirtyCashPerMinute: 18,
    passiveDistrictHeatPerMinute: 0.1,
    applyMinute: (state, minute) => {
      if ([8, 18, 40, 90].includes(minute)) {
        addPlayerHeat(state, 2);
        addHeatToOwnedDistrict(state, 1);
      }
      if (minute === 12) {
        addPlayerHeat(state, 10);
        addHeatToOwnedDistrict(state, 8);
      }
      if (minute === 70) {
        addPlayerHeat(state, 8);
        addHeatToOwnedDistrict(state, 6);
      }
      if ([15, 75].includes(minute)) {
        addPlayerHeat(state, minute === 15 ? 6 : 4);
        addHeatToOwnedDistrict(state, minute === 15 ? 4 : 3);
        addResources(state, { "dirty-cash": 500 });
      }
    }
  },
  {
    name: "Aggressive Raider",
    initialOwnedDistricts: 2,
    passiveCashPerMinute: 110,
    passiveDirtyCashPerMinute: 45,
    passiveDistrictHeatPerMinute: 0.18,
    applyMinute: (state, minute) => {
      if (minute >= 6 && minute % 6 === 0) {
        addPlayerHeat(state, 10);
        addHeatToOwnedDistrict(state, 10, minute / 6);
        addResources(state, { "dirty-cash": 900, chemicals: 3, "metal-parts": 4 });
      }
      if ([24, 42, 60, 78, 96].includes(minute)) {
        claimNextDistrict(state);
      }
    }
  },
  {
    name: "Dirty Money Stacker",
    initialOwnedDistricts: 2,
    initialResources: { "dirty-cash": 2500 },
    passiveCashPerMinute: 55,
    passiveDirtyCashPerMinute: 140,
    passiveDistrictHeatPerMinute: 0.08,
    applyMinute: (state, minute) => {
      if (minute > 0 && minute % 5 === 0) {
        addPlayerHeat(state, 4);
        addHeatToOwnedDistrict(state, 3, minute / 5);
        addResources(state, { "dirty-cash": 1500 });
      }
    }
  },
  {
    name: "Hot District Owner",
    initialOwnedDistricts: 4,
    initialPlayerHeat: 8,
    initialDistrictHeat: {
      1: 80,
      2: 25,
      3: 25,
      4: 10
    },
    initialResources: { "dirty-cash": 1800 },
    passiveCashPerMinute: 80,
    passiveDirtyCashPerMinute: 20,
    passiveDistrictHeatPerMinute: 0.02
  },
  {
    name: "Snowball Leader",
    initialOwnedDistricts: 2,
    initialResources: { cash: 5000, "dirty-cash": 4000, chemicals: 80, "metal-parts": 90, "tech-core": 20 },
    passiveCashPerMinute: 180,
    passiveDirtyCashPerMinute: 90,
    passiveDistrictHeatPerMinute: 0.2,
    applyMinute: (state, minute) => {
      if (minute >= 5 && minute % 5 === 0) {
        addPlayerHeat(state, 10);
        addHeatToOwnedDistrict(state, 9, minute / 5);
        addResources(state, { "dirty-cash": 1200, chemicals: 4, "metal-parts": 5 });
      }
      if ([15, 30, 45, 60, 75, 90].includes(minute)) {
        claimNextDistrict(state);
      }
    }
  }
];

describe("free-session police balance simulation", () => {
  it("keeps free police balance separate from war defaults", () => {
    const warConfig = resolveModeConfig("war");

    expect(FREE_CONFIG.balance.police).toMatchObject({
      raidCooldownTicks: 360,
      pendingRaidTtlTicks: 12,
      highPressureRaidThreshold: 115,
      heatDecay: {
        playerIntervalTicks: 30,
        districtIntervalTicks: 60,
        districtBaseDecay: 3
      }
    });
    expect(warConfig.balance.police).toMatchObject({
      raidCooldownTicks: 4,
      pendingRaidTtlTicks: 2,
      highPressureRaidThreshold: 100
    });
  });

  it("keeps quiet play safe, pressures active play, and checks snowball control", () => {
    const results = Object.fromEntries(scenarios.map((scenario) => [scenario.name, simulateScenario(scenario)])) as Record<string, ScenarioMetrics>;

    if (runtimeEnv.POLICE_SIM_LOG === "1") {
      console.info("POLICE_FREE_SESSION_SIMULATION", JSON.stringify(results, null, 2));
    }

    expect(results["Quiet Builder"]).toMatchObject({
      maxRiskTier: "low",
      pendingRaidCount: 0,
      highRaidCount: 0,
      extremeRaidCount: 0
    });
    expect(results["Quiet Builder"].maxAggregatePressure).toBeLessThan(FREE_CONFIG.balance.police!.raidSeverityThresholds.medium);

    expect(results["Normal Player"].maxAggregatePressure).toBeGreaterThan(results["Quiet Builder"].maxAggregatePressure);
    expect(results["Normal Player"].maxRiskTier).toBe("low");
    expect(results["Normal Player"].resolvedRaidCount).toBeLessThanOrEqual(1);
    expect(results["Normal Player"].seizedDirtyCash).toBeLessThanOrEqual(500);

    expect(riskScore[results["Aggressive Raider"].maxRiskTier]).toBeGreaterThanOrEqual(riskScore.medium);
    expect(results["Aggressive Raider"].warningCount).toBeGreaterThanOrEqual(1);
    expect(results["Aggressive Raider"].maxAggregatePressure).toBeGreaterThanOrEqual(FREE_CONFIG.balance.police!.raidSeverityThresholds.medium);

    expect(results["Dirty Money Stacker"].maxAggregatePressure).toBeGreaterThan(results["Quiet Builder"].maxAggregatePressure);
    expect(results["Dirty Money Stacker"].pendingRaidCount).toBe(0);
    expect(results["Dirty Money Stacker"].finalResources["dirty-cash"]).toBeGreaterThan(0);

    expect(results["Hot District Owner"].finalDistrictHeatPressure).toBeGreaterThan(results["Hot District Owner"].finalHeat);
    expect(results["Hot District Owner"].hottestDistrictId).toBe("district:1");
    expect(results["Hot District Owner"].targetedRaidCount).toBeGreaterThanOrEqual(1);

    expect(results["Snowball Leader"].resolvedRaidCount).toBeGreaterThanOrEqual(1);
    expect(results["Snowball Leader"].heatReducedBy + results["Snowball Leader"].seizedDirtyCash + results["Snowball Leader"].seizedResources).toBeGreaterThan(0);
    expect(results["Snowball Leader"].finalOwnedDistricts).toBeGreaterThanOrEqual(6);

    for (const result of Object.values(results)) {
      expect(result.maxOpenPendingRaids).toBeLessThanOrEqual(FREE_CONFIG.balance.police!.maxPendingRaidsPerPlayer);
      expect(Object.values(result.finalResources).every((value) => Number.isFinite(value) && value >= 0)).toBe(true);
      expect(Number.isFinite(result.finalAggregatePressure)).toBe(true);
      expect(Number.isFinite(result.finalDistrictHeatPressure)).toBe(true);
      expect(Number.isFinite(result.seizedDirtyCash)).toBe(true);
      expect(Number.isFinite(result.seizedResources)).toBe(true);
    }
  });
});

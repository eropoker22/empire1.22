import { resolveModeConfig } from "@empire/game-config";
import type { InstanceSnapshotDto } from "../../apps/server/src/runtime/persistence";
import {
  applyHostedMultiplayerCoreScenario,
  applyHostedSocialConcurrencyPrivacyScenario
} from "./hosted-multiplayer-core-scenario";
import hostedBuildingActionMatrixJson from "./hosted-building-action-matrix.json";
import { applyHostedBuildingParityNonSpawnScenario } from "./hosted-building-parity-non-spawn-scenario";

export const HOSTED_E2E_SCENARIOS = [
  "realistic-new-player",
  "city-events",
  "building-parity-non-spawn",
  "building-actions-day",
  "building-actions-night",
  "multiplayer-core",
  "social-concurrency-privacy"
] as const;

export type HostedE2eScenario = typeof HOSTED_E2E_SCENARIOS[number];
type HostedBuildingActionPhase = "day" | "night";

interface HostedBuildingActionMatrixEntry {
  buildingTypeId: string;
  districtId: string;
  actionId: string;
  phase: HostedBuildingActionPhase;
}

const hostedBuildingActionMatrix = hostedBuildingActionMatrixJson as HostedBuildingActionMatrixEntry[];

export const applyHostedE2eScenario = (
  source: InstanceSnapshotDto,
  scenario: HostedE2eScenario,
  createdAt: string
): InstanceSnapshotDto => {
  const snapshot = structuredClone(source);
  if (scenario === "city-events") {
    const config = resolveModeConfig(snapshot.state.serverInstance.mode);
    const cityEventStartTick = config.balance.dayNight!.phases.day.durationTicks;
    snapshot.state.root.tick = cityEventStartTick;
    snapshot.state.serverInstance.currentTick = cityEventStartTick;
    snapshot.state.playerCityEventStatesByPlayerId = {};
    snapshot.runtime.commandRateLimitWindow = {
      tick: cityEventStartTick,
      commandCountsByPlayerId: {}
    };
  }
  if (scenario === "building-actions-day" || scenario === "building-actions-night") {
    applyHostedBuildingActionScenario(
      snapshot,
      scenario === "building-actions-night" ? "night" : "day",
      createdAt
    );
  }
  if (scenario === "building-parity-non-spawn") {
    applyHostedBuildingParityNonSpawnScenario(snapshot);
  }
  if (scenario === "multiplayer-core") {
    applyHostedMultiplayerCoreScenario(snapshot, createdAt);
  }
  if (scenario === "social-concurrency-privacy") {
    applyHostedSocialConcurrencyPrivacyScenario(snapshot, createdAt);
  }
  snapshot.state.root.version += 1;
  snapshot.tick = snapshot.state.root.tick;
  snapshot.integrity.rootVersion = snapshot.state.root.version;
  snapshot.createdAt = createdAt;
  snapshot.snapshotId = [
    "snapshot",
    snapshot.instanceId,
    snapshot.tick,
    snapshot.integrity.rootVersion
  ].join(":");
  return snapshot;
};

export const isHostedE2eScenario = (value: string): value is HostedE2eScenario =>
  HOSTED_E2E_SCENARIOS.includes(value as HostedE2eScenario);

const applyHostedBuildingActionScenario = (
  snapshot: InstanceSnapshotDto,
  phase: HostedBuildingActionPhase,
  createdAt: string
): void => {
  const players = Object.values(snapshot.state.playersById)
    .filter((player) => player.status === "active" && Boolean(player.homeDistrictId));
  if (players.length !== 1) {
    throw new Error("Hosted building action scenario requires exactly one ready active player.");
  }
  const player = players[0];
  const config = resolveModeConfig(snapshot.state.serverInstance.mode);
  const phaseDurationTicks = config.balance.dayNight!.phases.day.durationTicks;
  const scenarioTick = phase === "night" ? phaseDurationTicks + 5 : 5;
  const targetDistrictIds = new Set(
    hostedBuildingActionMatrix
      .filter((entry) => entry.phase === phase)
      .map((entry) => entry.districtId)
  );

  snapshot.state.root.tick = scenarioTick;
  snapshot.state.serverInstance.currentTick = scenarioTick;
  snapshot.runtime.commandRateLimitWindow = {
    tick: scenarioTick,
    commandCountsByPlayerId: {}
  };

  for (const districtId of targetDistrictIds) {
    const district = snapshot.state.districtsById[districtId];
    if (!district) throw new Error(`Hosted building action district is missing: ${districtId}.`);
    district.ownerPlayerId = player.id;
    district.controllerAllianceId = null;
    district.status = "claimed";
    district.heat = 80;
    district.influence = 500;
    district.version += 1;

    for (const buildingId of district.buildingIds) {
      const building = snapshot.state.buildingsById[buildingId];
      if (!building) throw new Error(`Hosted building action building is missing: ${buildingId}.`);
      building.ownerPlayerId = player.id;
      building.status = "active";
      building.actionCooldowns = {};
      building.metadata = prepareBuildingMetadata(
        building.buildingTypeId,
        building.metadata,
        scenarioTick,
        config.balance.convenienceStore?.basePopulationCapacity ?? 1
      );
      building.version += 1;
    }
  }

  for (const entry of hostedBuildingActionMatrix.filter((candidate) => candidate.phase === phase)) {
    const district = snapshot.state.districtsById[entry.districtId];
    const matchingBuilding = district?.buildingIds
      .map((buildingId) => snapshot.state.buildingsById[buildingId])
      .find((building) => building?.buildingTypeId === entry.buildingTypeId);
    if (!matchingBuilding) {
      throw new Error(`Hosted building action fixture cannot resolve ${entry.buildingTypeId}/${entry.actionId}.`);
    }
  }

  const resourceState = snapshot.state.resourceStatesById[player.resourceStateId];
  if (!resourceState) throw new Error("Hosted building action player resource state is missing.");
  resourceState.balances = {
    ...resourceState.balances,
    cash: 1_000_000,
    "dirty-cash": 1_000_000,
    "gang-members": 500,
    population: 500,
    chemicals: 0,
    biomass: 0,
    "metal-parts": 0,
    "tech-core": 0,
    "combat-module": 0,
    "neon-dust": 100,
    "pulse-shot": 100,
    "velvet-smoke": 100
  };
  resourceState.lastUpdatedTick = scenarioTick;
  resourceState.version += 1;

  player.population = 500;
  player.recoveryPool = [{
    id: `recovery:hosted-e2e:${phase}`,
    itemType: "population",
    amount: 40,
    lostAtTick: scenarioTick,
    lostAt: createdAt,
    source: "attack"
  }];
  player.salvagePool = [{
    id: `salvage:hosted-e2e:${phase}`,
    itemId: "metal-parts",
    itemName: "Metal Parts",
    category: "materials",
    amount: 40,
    lostAtTick: scenarioTick,
    lostAt: createdAt,
    source: "attack"
  }];
  player.metadata = {
    ...(player.metadata ?? {}),
    streetDealers: {
      slots: [],
      saleHistory: []
    }
  };
  player.version += 1;
};

const prepareBuildingMetadata = (
  buildingTypeId: string,
  source: Record<string, unknown> | undefined,
  tick: number,
  convenienceStorePopulationCapacity: number
): Record<string, unknown> => {
  const metadata = { ...(source ?? {}) };
  if (buildingTypeId === "apartment_block") {
    metadata.apartmentBlock = {
      storedPopulation: 20,
      lastUpdatedTick: tick,
      lastCapacity: 20,
      wasFull: true
    };
  }
  if (buildingTypeId === "convenience_store") {
    const populationCapacity = Math.max(1, Math.floor(convenienceStorePopulationCapacity));
    metadata.convenienceStore = {
      storedPopulation: populationCapacity,
      populationLastUpdatedTick: tick,
      populationCapacity,
      populationWasFull: true,
      rumorEvents: []
    };
  }
  return metadata;
};

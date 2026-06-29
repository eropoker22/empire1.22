import { createCityFeedProjection, createConflictReportViews, createOnboardingReadModel, createPlayerFrontierSummaryView, createPoliceReadModel, getMarketViewModel } from "@empire/game-core";
import {
  empireStreetsCityMapManifestHash,
  empireStreetsCityMapManifestId,
  empireStreetsCityMapManifestVersion,
  toPublicModeConfig
} from "@empire/game-config";
import {
  SERVER_ASSIGNED_FOCUS_DISTRICT_ID,
  type DistrictId,
  type DistrictPanelView,
  type GameplayModeView,
  type GameplaySliceCommandHintsView,
  type GameplaySliceSpawnSelectionView,
  type GameplaySliceView
} from "@empire/shared-types";
import type { ServerInstanceRuntime } from "../instance/server-instance-runtime";
import { createDistrictPanelProjection } from "./district-panel-projection-service";
import { createDistrictListProjection } from "./district-list-projection-service";
import { createPlayerProjection } from "./player-projection-service";
import { sharedCitySpawnPool } from "../../bootstrap/gameplay-slice-shared-city-seed";

/**
 * Responsibility: Aggregates the minimal read model for the first migrated gameplay slice.
 * Belongs here: server-side composition of player and district projections.
 * Does not belong here: command handling or transport concerns.
 */
export const createGameplaySliceProjection = (
  runtime: ServerInstanceRuntime,
  playerId: string,
  districtId?: string | null
): GameplaySliceView => {
  const publicMode = toPublicModeConfig(runtime.config);
  const mode: GameplayModeView = {
    mode: publicMode.mode,
    label: publicMode.label,
    matchStyle: publicMode.matchStyle,
    tickRateMs: publicMode.tickRateMs,
    sessionKeyPrefix: publicMode.sessionKeyPrefix
  };
  const basePlayer = createPlayerProjection(runtime, playerId);
  const selectedDistrictId = resolveSelectedDistrictId(runtime, playerId, districtId);
  const police = createPoliceReadModel(runtime.state, playerId, { config: runtime.config, clock: runtime.clock }, {
    ...(selectedDistrictId ? { selectedDistrictId } : {})
  });
  const player = {
    ...basePlayer,
    police
  };
  const district = selectedDistrictId
    ? createDistrictPanelProjection(runtime, playerId, selectedDistrictId)
    : null;

  return {
    server: {
      serverInstanceId: runtime.record.id,
      mode: runtime.record.mode,
      currentTick: runtime.state.root.tick,
      stateVersion: runtime.state.root.version,
      maxPlayersPerServer: runtime.config.balance.maxPlayersPerServer,
      selectedDistrictId: district?.districtId ?? null,
      mapManifestId: empireStreetsCityMapManifestId,
      mapManifestVersion: empireStreetsCityMapManifestVersion,
      mapManifestHash: empireStreetsCityMapManifestHash,
      generatedAt: runtime.clock.nowIso()
    },
    mode,
    player,
    commandHints: createGameplaySliceCommandHints(district),
    spawnSelection: createSpawnSelectionView(runtime, playerId),
    frontier: createPlayerFrontierSummaryView(runtime.state, playerId),
    dayNight: player.dayNight ?? null,
    elimination: player.elimination ?? null,
    onboarding: createOnboardingReadModel(runtime.state, playerId, { config: runtime.config, clock: runtime.clock }),
    police,
    market: getMarketViewModel(runtime.state, runtime.state.playersById[playerId] ?? {}),
    cityFeed: createCityFeedProjection(runtime.state, {
      playerId,
      ...(selectedDistrictId ? { selectedDistrictId } : {}),
      factionId: player.factionId,
      allianceId: runtime.state.playersById[playerId]?.allianceId ?? null,
      limit: 50
    }),
    districts: createDistrictListProjection(runtime, playerId),
    district,
    reports: createConflictReportViews(runtime.state, {
      playerId,
      limit: runtime.config.balance.conflict?.reportsLimit ?? 6
    })
  };
};

const createSpawnSelectionView = (
  runtime: ServerInstanceRuntime,
  playerId: string
): GameplaySliceSpawnSelectionView => {
  const player = runtime.state.playersById[playerId];

  return {
    status: player?.homeDistrictId ? "ready_to_play" : "awaiting_spawn_selection",
    districts: sharedCitySpawnPool.map((candidate) => {
      const district = runtime.state.districtsById[candidate.districtId];
      const owner = district?.ownerPlayerId ? runtime.state.playersById[district.ownerPlayerId] : null;
      const firstBuilding = district?.buildingIds
        .map((buildingId) => runtime.state.buildingsById[buildingId])
        .find((building) => building !== undefined);

      return {
        districtId: candidate.districtId,
        districtName: district?.name ?? candidate.districtId,
        districtType: district?.zone ?? "unknown",
        buildingType: firstBuilding?.buildingTypeId ?? null,
        spawnZones: [...candidate.zones],
        neighborCount: district?.adjacentDistrictIds.length ?? 0,
        status: resolveSpawnDistrictStatus(candidate.enabled, district, playerId),
        ownerPublicName: owner?.name ?? null,
        ownerPlayerId: owner?.id ?? null,
        version: district?.version ?? 0
      };
    })
  };
};

const resolveSpawnDistrictStatus = (
  enabled: boolean,
  district: ServerInstanceRuntime["state"]["districtsById"][string] | undefined,
  playerId: string
): GameplaySliceSpawnSelectionView["districts"][number]["status"] => {
  if (!enabled || !district) return "disabled";
  if (district.status === "locked" || district.status === "destroyed" || district.lockdownUntilTick) {
    return "locked";
  }
  if (district.ownerPlayerId === playerId) return "selected_by_me";
  if (district.ownerPlayerId) return "occupied";
  return "available";
};

const resolveSelectedDistrictId = (
  runtime: ServerInstanceRuntime,
  playerId: string,
  requestedDistrictId?: string | null
): DistrictId | null => {
  const playerHomeDistrictId = runtime.state.playersById[playerId]?.homeDistrictId;

  if (
    requestedDistrictId &&
    requestedDistrictId !== SERVER_ASSIGNED_FOCUS_DISTRICT_ID &&
    runtime.state.districtsById[requestedDistrictId]
  ) {
    return requestedDistrictId;
  }

  return playerHomeDistrictId && runtime.state.districtsById[playerHomeDistrictId]
    ? playerHomeDistrictId
    : null;
};

const createGameplaySliceCommandHints = (
  district: DistrictPanelView | null
): GameplaySliceCommandHintsView => {
  if (!district) {
    return {
      selectedDistrictId: null,
      availableBuildingActionCount: 0,
      availableSpyTargetCount: 0,
      availableAttackTargetCount: 0,
      availableOccupyTargetCount: 0,
      cooldowns: [],
      disabledReasons: []
    };
  }

  const buildingActions = district.buildings.flatMap((building) => building.actions);
  const cooldowns = [
    ...buildingActions
      .filter((action) => (action.cooldownRemainingTicks ?? 0) > 0)
      .map((action) => ({
        commandType: "run-building-action",
        targetId: `${action.buildingId}:${action.actionId}`,
        remainingTicks: action.cooldownRemainingTicks ?? 0,
        reason: action.disabledReason
      })),
    ...district.occupyTargets
      .filter((target) => target.cooldownRemainingTicks > 0)
      .map((target) => ({
        commandType: "occupy-district",
        targetId: target.districtId,
        remainingTicks: target.cooldownRemainingTicks,
        reason: target.disabledReason
      }))
  ];
  const disabledReasons = [
    ...buildingActions
      .filter((action) => action.disabledReason)
      .map((action) => ({
        commandType: "run-building-action",
        targetId: `${action.buildingId}:${action.actionId}`,
        reason: action.disabledReason!
      })),
    ...district.spyTargets
      .filter((target) => target.disabledReason)
      .map((target) => ({
        commandType: "spy-district",
        targetId: target.districtId,
        reason: target.disabledReason!
      })),
    ...district.attackTargets
      .filter((target) => target.disabledReason)
      .map((target) => ({
        commandType: "attack-district",
        targetId: target.districtId,
        reason: target.disabledReason!
      })),
    ...district.occupyTargets
      .filter((target) => target.disabledReason)
      .map((target) => ({
        commandType: "occupy-district",
        targetId: target.districtId,
        reason: target.disabledReason!
      })),
    ...(district.trap?.disabledReason
      ? [{
          commandType: "place-trap",
          targetId: district.districtId,
          reason: district.trap.disabledReason
        }]
      : [])
  ];

  return {
    selectedDistrictId: district.districtId,
    availableBuildingActionCount: buildingActions.filter((action) => action.enabled).length,
    availableSpyTargetCount: district.spyTargets.filter((target) => target.enabled).length,
    availableAttackTargetCount: district.attackTargets.filter((target) => target.enabled).length,
    availableOccupyTargetCount: district.occupyTargets.filter((target) => target.enabled).length,
    cooldowns,
    disabledReasons
  };
};

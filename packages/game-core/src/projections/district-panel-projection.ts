import type { DistrictPanelView } from "@empire/shared-types";
import type { CoreGameState } from "../entities/game-state";
import { createDistrictAttackTargetViews } from "./district-attack-target-projection";
import {
  createDistrictDefenseActionView,
  createDistrictHeistTargetViews,
  createDistrictRobTargetViews
} from "./district-basic-action-projection";
import { createDistrictCapabilitiesView } from "./district-capabilities-projection";
import { createDistrictPanelBuildingViews } from "./district-building-action-projection";
import { createDistrictOccupyTargetViews } from "./district-occupy-target-projection";
import { createDistrictSlotViews } from "./district-panel-slot-projection";
import type { DistrictPanelProjectionInput } from "./district-panel-projection-types";
import { createDistrictSpyTargetViews } from "./district-spy-target-projection";

export type { DistrictPanelProjectionInput } from "./district-panel-projection-types";

/**
 * Responsibility: Shapes one district into a client-ready panel projection.
 * Belongs here: read-only mapping from authoritative state into UI-safe district data.
 * Does not belong here: transport delivery or command dispatch.
 */
export const createDistrictPanelView = (
  state: CoreGameState,
  input: DistrictPanelProjectionInput
): DistrictPanelView | null => {
  const district = state.districtsById[input.districtId];

  if (!district) {
    return null;
  }

  const filledBuildings = district.buildingIds
    .map((buildingId) => state.buildingsById[buildingId])
    .filter((building) => building !== undefined && building.status !== "destroyed");
  const filledSlotCount = filledBuildings.length;
  const isOwnedByPlayer = district.ownerPlayerId === input.playerId;
  const player = state.playersById[input.playerId];
  const playerBalances = player
    ? state.resourceStatesById[player.resourceStateId]?.balances ?? {}
    : {};
  const issuedAt = input.issuedAt ?? new Date().toISOString();
  const attackTargets = createDistrictAttackTargetViews(state, input.playerId, district.id, issuedAt, input.config);
  const occupyTargets = createDistrictOccupyTargetViews(state, input.playerId, district.id, input.conflictConfig, issuedAt);
  const spyTargets = createDistrictSpyTargetViews(state, input.playerId, district.id, issuedAt, input.conflictConfig);
  const robTargets = createDistrictRobTargetViews(state, input.playerId, district.id, input.conflictConfig, issuedAt);
  const heistTargets = createDistrictHeistTargetViews(state, input.playerId, district.id, input.conflictConfig, issuedAt);
  const placeDefense = createDistrictDefenseActionView(state, input.playerId, district.id, "place_defense", input.conflictConfig);
  const removeDefense = createDistrictDefenseActionView(state, input.playerId, district.id, "remove_defense", input.conflictConfig);
  const trap = createTrapView(state, input.playerId, district.id);
  const isDestroyed = district.status === "destroyed";

  return {
    districtId: district.id,
    name: district.name,
    zone: district.zone,
    status: district.status,
    ownerPlayerId: isDestroyed ? null : district.ownerPlayerId,
    isOwnedByPlayer: isDestroyed ? false : isOwnedByPlayer,
    heat: isDestroyed ? 0 : district.heat,
    influence: isDestroyed ? 0 : district.influence,
    securityRevision: district.securityRevision,
    conflictRevision: district.conflictRevision,
    stabilizingUntilTick: district.stabilizingUntilTick ?? null,
    slotCount: district.slotCount,
    filledSlotCount,
    buildings: isDestroyed
      ? []
      : createDistrictPanelBuildingViews({
      state,
      buildings: filledBuildings,
      buildCatalog: input.buildCatalog,
      actionCatalog: input.buildingActionCatalog,
      config: input.config,
      stripClubConfig: input.stripClubConfig,
      restaurantConfig: input.restaurantConfig,
      convenienceStoreConfig: input.convenienceStoreConfig,
      shoppingMallConfig: input.shoppingMallConfig,
      stockExchangeConfig: input.stockExchangeConfig,
      centralBankConfig: input.centralBankConfig,
      airportConfig: input.airportConfig,
      cityHallConfig: input.cityHallConfig,
      courthouseConfig: input.courthouseConfig,
      lobbyClubConfig: input.lobbyClubConfig,
      vipLoungeConfig: input.vipLoungeConfig,
      powerStationConfig: input.powerStationConfig,
      recruitmentCenterConfig: input.recruitmentCenterConfig,
      fitnessClubConfig: input.fitnessClubConfig,
      garageConfig: input.garageConfig,
      carDealerConfig: input.carDealerConfig,
      smugglingTunnelConfig: input.smugglingTunnelConfig,
      streetDealersConfig: input.streetDealersConfig,
      schoolConfig: input.schoolConfig,
      recyclingCenterConfig: input.recyclingCenterConfig,
      district,
      playerId: input.playerId,
      playerBalances,
      tick: state.root.tick,
      tickRateMs: input.tickRateMs
    }),
    attackTargets: isDestroyed ? [] : attackTargets,
    spyTargets: isDestroyed ? [] : spyTargets,
    occupyTargets: isDestroyed ? [] : occupyTargets,
    robTargets: isDestroyed ? [] : robTargets,
    heistTargets: isDestroyed ? [] : heistTargets,
    placeDefense: isDestroyed ? null : placeDefense,
    removeDefense: isDestroyed ? null : removeDefense,
    trap: isDestroyed ? null : trap,
    capabilities: createDistrictCapabilitiesView(state, input.playerId, district.id),
    slots: isDestroyed
      ? []
      : createDistrictSlotViews({ state, input, district, playerBalances, isOwnedByPlayer })
  };
};

const createTrapView = (
  state: CoreGameState,
  playerId: string,
  districtId: string
) => {
  const district = state.districtsById[districtId];

  if (!district || district.ownerPlayerId !== playerId) {
    return null;
  }

  const activeTrap = Object.values(state.trapsById).find(
    (trap) => trap.districtId === district.id && trap.status === "active"
  );
  const otherActiveTrap = Object.values(state.trapsById).find(
    (trap) => trap.ownerPlayerId === playerId && trap.status === "active" && trap.districtId !== district.id
  );
  const player = state.playersById[playerId];
  const relocationCooldownUntilTick = player
    ? state.cooldownStatesById[player.cooldownStateId]?.cooldowns?.["trap:relocate"] ?? 0
    : 0;
  const relocationCooldownRemainingTicks = Math.max(
    0,
    Number(relocationCooldownUntilTick) - state.root.tick
  );
  const relocationTargets = activeTrap
    ? district.adjacentDistrictIds
        .map((targetId) => state.districtsById[targetId])
        .filter((target) => target?.ownerPlayerId === playerId)
        .map((target) => {
          const targetHasTrap = Object.values(state.trapsById).some(
            (candidate) => candidate.id !== activeTrap.id
              && candidate.districtId === target.id
              && candidate.status === "active"
          );
          const disabledReason = relocationCooldownRemainingTicks > 0
            ? "TRAP_RELOCATION_COOLDOWN"
            : targetHasTrap
              ? "TRAP_TARGET_OCCUPIED"
              : (target.status === "destroyed" || target.status === "locked")
                ? "DISTRICT_LOCKED"
                : (target.stabilizingUntilTick ?? 0) > state.root.tick
                  ? "DISTRICT_STABILIZING"
                  : null;
          return {
            districtId: target.id,
            name: target.name,
            expectedVersion: target.version,
            canRelocate: disabledReason === null,
            disabledReason
          };
        })
    : [];
  const relocationSourceDistrict = otherActiveTrap
    ? state.districtsById[otherActiveTrap.districtId]
    : null;
  const relocationSourceDisabledReason = otherActiveTrap
    ? relocationCooldownRemainingTicks > 0
      ? "TRAP_RELOCATION_COOLDOWN"
      : !relocationSourceDistrict?.adjacentDistrictIds.includes(district.id)
        ? "DISTRICTS_NOT_ADJACENT"
        : (district.status === "destroyed" || district.status === "locked")
          ? "DISTRICT_LOCKED"
          : (district.stabilizingUntilTick ?? 0) > state.root.tick
            ? "DISTRICT_STABILIZING"
            : null
    : null;
  const relocationSource = otherActiveTrap && relocationSourceDistrict
    ? {
        trapId: otherActiveTrap.id,
        districtId: relocationSourceDistrict.id,
        expectedSourceVersion: relocationSourceDistrict.version,
        expectedTargetVersion: district.version,
        expectedTrapVersion: otherActiveTrap.version,
        canRelocate: relocationSourceDisabledReason === null,
        disabledReason: relocationSourceDisabledReason
      }
    : null;

  return {
    enabled: !activeTrap && (!otherActiveTrap || relocationSource?.canRelocate === true),
    disabledReason: activeTrap
      ? `Past už je v districtu ${district.name} nastražená.`
      : otherActiveTrap
        ? relocationSource?.disabledReason ?? "Past lze přesunout do tohoto districtu."
        : null,
    activeTrap: activeTrap
      ? {
          trapId: activeTrap.id,
          label: "Skrytá past nastražená",
          placedAtTick: activeTrap.placedAtTick
        }
      : null,
    relocationCooldownRemainingTicks,
    relocationSource,
    relocationTargets
  };
};

import type { ResourceState, UpgradeBuildingCommand } from "@empire/shared-types";
import type { CoreGameState } from "../entities";
import type { CoreEvent } from "../events";
import type { CoreError } from "../errors";
import type { GameCoreContext } from "../engine/context";
import { CORE_EVENT_TYPES, createEvent } from "../events";
import {
  describeBuildingUpgradeEffects,
  hasEnoughResourcesForUpgrade,
  resolveBuildingUpgradeCost
} from "../rules/buildings/buildingUpgradeRules";

/**
 * Responsibility: Server-authoritative upgrade flow for fixed/craft/production buildings.
 * Belongs here: validation, server cost deduction, level mutation and event emission.
 * Does not belong here: UI preview, modal rendering, or client-side reward calculation.
 */
export const handleUpgradeBuilding = (
  state: CoreGameState,
  command: UpgradeBuildingCommand,
  context: GameCoreContext
): { nextState: CoreGameState; events: CoreEvent[]; errors: CoreError[] } => {
  const validation = validateUpgradeBuilding(state, command, context);
  if (validation.errors.length > 0 || !validation.upgradeCost || !validation.playerResourceState) {
    return {
      nextState: state,
      events: [],
      errors: validation.errors
    };
  }

  const { building, playerResourceState, upgradeCost } = validation;
  const nextBalances = { ...playerResourceState.balances };
  for (const [resourceKey, amount] of Object.entries(upgradeCost.costs)) {
    nextBalances[resourceKey] = Math.max(0, Number(nextBalances[resourceKey] || 0) - Math.max(0, Number(amount || 0)));
  }

  const nextResourceState: ResourceState = {
    ...playerResourceState,
    balances: nextBalances,
    lastUpdatedTick: state.root.tick,
    version: playerResourceState.version + (state.resourceStatesById[playerResourceState.id] ? 1 : 0)
  };
  const nextBuilding = {
    ...building,
    level: upgradeCost.nextLevel,
    version: building.version + 1
  };

  return {
    nextState: {
      ...state,
      buildingsById: {
        ...state.buildingsById,
        [nextBuilding.id]: nextBuilding
      },
      resourceStatesById: {
        ...state.resourceStatesById,
        [nextResourceState.id]: nextResourceState
      }
    },
    events: [
      createEvent(CORE_EVENT_TYPES.buildingUpgraded, {
        playerId: command.playerId,
        districtId: command.payload.districtId,
        buildingId: building.id,
        buildingTypeId: building.buildingTypeId,
        level: upgradeCost.level,
        nextLevel: upgradeCost.nextLevel,
        costs: upgradeCost.costs,
        effects: describeBuildingUpgradeEffects(building, context)
      })
    ],
    errors: []
  };
};

const validateUpgradeBuilding = (
  state: CoreGameState,
  command: UpgradeBuildingCommand,
  context: GameCoreContext
): {
  building: CoreGameState["buildingsById"][string];
  playerResourceState: ResourceState | undefined;
  upgradeCost: ReturnType<typeof resolveBuildingUpgradeCost>;
  errors: CoreError[];
} => {
  const errors: CoreError[] = [];
  const district = state.districtsById[command.payload.districtId];
  const building = state.buildingsById[command.payload.buildingId];
  const player = state.playersById[command.playerId];

  if (!district) {
    errors.push({ code: "district_not_found", message: "District neexistuje." });
  }
  if (!building) {
    errors.push({ code: "building_not_found", message: "Budova neexistuje." });
  }
  if (!player) {
    errors.push({ code: "player_not_found", message: "Hráč neexistuje." });
  }
  if (errors.length > 0 || !district || !building || !player) {
    return { building: building as CoreGameState["buildingsById"][string], playerResourceState: undefined, upgradeCost: null, errors };
  }

  if (building.districtId !== district.id || !district.buildingIds.includes(building.id)) {
    errors.push({ code: "building_district_mismatch", message: "Budova není v odeslaném districtu." });
  }
  if (building.ownerPlayerId !== command.playerId || district.ownerPlayerId !== command.playerId) {
    errors.push({ code: "building_not_owned", message: "Tuhle budovu může upgradovat jen majitel." });
  }
  if (building.status !== "active" || district.status === "destroyed") {
    errors.push({ code: "building_not_active", message: "Upgradovat jde jen aktivní budovy v aktivních districtech." });
  }

  const upgradeCost = resolveBuildingUpgradeCost(building, context);
  if (!upgradeCost) {
    errors.push({ code: "building_upgrade_unavailable", message: "Tahle budova už nemá další level upgradu." });
  }

  const playerResourceState = state.resourceStatesById[player.resourceStateId] ?? createPlayerResourceState(player, state.root.tick);
  if (upgradeCost && !hasEnoughResourcesForUpgrade(playerResourceState, upgradeCost.costs)) {
    errors.push({
      code: "insufficient_upgrade_resources",
      message: "Hráč nemá dost zdrojů na upgrade téhle budovy.",
      details: {
        costs: upgradeCost.costs
      }
    });
  }

  return {
    building,
    playerResourceState,
    upgradeCost,
    errors
  };
};

const createPlayerResourceState = (
  player: CoreGameState["playersById"][string],
  tick: number
): ResourceState => ({
  id: player.resourceStateId,
  ownerType: "player",
  ownerId: player.id,
  balances: {},
  incomeModifiers: {},
  lastUpdatedTick: tick,
  version: 1
});

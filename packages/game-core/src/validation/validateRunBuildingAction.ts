import type { RunBuildingActionCommand } from "@empire/shared-types";
import type { CoreGameState } from "../entities";
import type { CoreError } from "../errors";
import type { GameCoreContext } from "../engine/context";

/**
 * Responsibility: Pure precondition checks for fixed-building gameplay actions.
 * Belongs here: existence, ownership, action compatibility, affordability, and cooldown checks.
 * Does not belong here: state mutation, transport mapping, or UI formatting.
 */
export const validateRunBuildingAction = (
  state: CoreGameState,
  command: RunBuildingActionCommand,
  context: GameCoreContext
): CoreError[] => {
  const player = state.playersById[command.playerId];
  const district = state.districtsById[command.payload.districtId];
  const building = state.buildingsById[command.payload.buildingId];
  const action = context.config.balance.buildingActions?.[command.payload.actionId];
  const errors: CoreError[] = [];

  if (!player) {
    errors.push({
      code: "player_not_found",
      message: `Player ${command.playerId} was not found.`
    });
  }

  if (!district) {
    errors.push({
      code: "district_not_found",
      message: `District ${command.payload.districtId} was not found.`
    });
  }

  if (!building) {
    errors.push({
      code: "building_not_found",
      message: `Building ${command.payload.buildingId} was not found.`
    });
  }

  if (!action) {
    errors.push({
      code: "building_action_not_found",
      message: `Building action ${command.payload.actionId} is not configured.`
    });
  }

  if (errors.length > 0 || !player || !district || !building || !action) {
    return errors;
  }

  if (!district.buildingIds.includes(building.id) || building.districtId !== district.id) {
    errors.push({
      code: "building_not_in_district",
      message: "Target building is not fixed in the selected district."
    });
  }

  if (district.status === "destroyed") {
    errors.push({
      code: "district_destroyed",
      message: "Destroyed districts cannot run fixed-building actions."
    });
  }

  if (action.buildingType !== building.buildingTypeId) {
    errors.push({
      code: "building_action_type_mismatch",
      message: `Action ${action.actionId} cannot run on ${building.buildingTypeId}.`
    });
  }

  if (action.requiredOwner && (district.ownerPlayerId !== command.playerId || building.ownerPlayerId !== command.playerId)) {
    errors.push({
      code: "building_action_owner_required",
      message: "Player must own the district and fixed building to run this action."
    });
  }

  if (district.status === "contested" && !action.allowedIfContested) {
    errors.push({
      code: "building_action_contested",
      message: "This building action cannot run while the district is contested."
    });
  }

  if (building.status !== "active") {
    errors.push({
      code: "building_not_active",
      message: "Only active fixed buildings can run actions."
    });
  }

  const cooldownUntilTick = Number((building.actionCooldowns ?? {})[action.actionId] ?? 0);
  if (cooldownUntilTick > state.root.tick) {
    errors.push({
      code: "building_action_cooldown",
      message: `Building action is cooling down for ${cooldownUntilTick - state.root.tick} more ticks.`
    });
  }

  const balances = state.resourceStatesById[player.resourceStateId]?.balances ?? {};
  const missingCosts = Object.entries(action.inputCost).filter(
    ([resourceKey, requiredAmount]) => Math.max(0, Number(balances[resourceKey] || 0)) < requiredAmount
  );

  if (missingCosts.length > 0) {
    errors.push({
      code: "building_action_insufficient_resources",
      message: `Missing resources: ${missingCosts.map(([key, amount]) => `${amount} ${key}`).join(", ")}.`
    });
  }

  return errors;
};

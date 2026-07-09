import type { RunBuildingActionCommand } from "@empire/shared-types";
import type { CoreGameState } from "../entities";
import type { CoreError } from "../errors";
import type { GameCoreContext } from "../engine/context";
import { resolveEffectiveBuildingActionCostForValidation } from "../rules/buildings/buildingActionCosts";
import { resolveDayNightActionRule } from "../rules/day-night/dayNightActionRules";
import { validateRunBuildingActionSpecifics } from "./validateRunBuildingActionSpecifics";

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
      message: `Hráč ${command.playerId} nebyl nalezen.`
    });
  }

  if (!district) {
    errors.push({
      code: "district_not_found",
      message: `District ${command.payload.districtId} nebyl nalezen.`
    });
  }

  if (!building) {
    errors.push({
      code: "building_not_found",
      message: `Budova ${command.payload.buildingId} nebyla nalezena.`
    });
  }

  if (!action) {
    errors.push({
      code: "building_action_not_found",
      message: `Akce budovy ${command.payload.actionId} není nakonfigurovaná.`
    });
  }

  if (errors.length > 0 || !player || !district || !building || !action) {
    return errors;
  }

  if (!district.buildingIds.includes(building.id) || building.districtId !== district.id) {
    errors.push({
      code: "building_not_in_district",
      message: "Cílová budova není pevně umístěná ve vybraném districtu."
    });
  }

  if (district.status === "destroyed") {
    errors.push({
      code: "district_destroyed",
      message: "Zničený district nemůže spouštět akce pevných budov."
    });
  }

  if (action.buildingType !== building.buildingTypeId) {
    errors.push({
      code: "building_action_type_mismatch",
      message: `Akci ${action.actionId} nejde spustit na budově ${building.buildingTypeId}.`
    });
  }

  const dayNightRule = resolveDayNightActionRule(state, context, action.actionId, building.buildingTypeId);
  if (!dayNightRule.allowed) {
    errors.push({
      code: "building_action_phase_blocked",
      message: dayNightRule.blockedReason || "Tahle akce budovy je blokovaná aktuální fází města."
    });
  }

  if (action.requiredOwner && (district.ownerPlayerId !== command.playerId || building.ownerPlayerId !== command.playerId)) {
    errors.push({
      code: "building_action_owner_required",
      message: "Tuhle akci může spustit jen majitel districtu i pevné budovy."
    });
  }

  if (district.status === "contested" && !action.allowedIfContested) {
    errors.push({
      code: "building_action_contested",
      message: "Tahle akce nejde spustit, dokud je district sporný."
    });
  }

  if (building.status !== "active") {
    errors.push({
      code: "building_not_active",
      message: "Akce může spustit jen aktivní pevná budova."
    });
  }

  const cooldownUntilTick = Number((building.actionCooldowns ?? {})[action.actionId] ?? 0);
  if (cooldownUntilTick > state.root.tick) {
    errors.push({
      code: "building_action_cooldown",
      message: `Akce čeká ještě ${cooldownUntilTick - state.root.tick} ticků.`
    });
  }

  const balances = state.resourceStatesById[player.resourceStateId]?.balances ?? {};
  const effectiveInputCost = resolveEffectiveBuildingActionCostForValidation({
    action,
    state,
    context,
    buildingTypeId: building.buildingTypeId
  });
  const missingCosts = Object.entries(effectiveInputCost).filter(
    ([resourceKey, requiredAmount]) => Math.max(0, Number(balances[resourceKey] || 0)) < requiredAmount
  );

  if (missingCosts.length > 0) {
    errors.push({
      code: "building_action_insufficient_resources",
      message: `Chybí suroviny: ${missingCosts.map(([key, amount]) => `${amount} ${key}`).join(", ")}.`
    });
  }

  errors.push(...validateRunBuildingActionSpecifics({
    state,
    command,
    context,
    player,
    district,
    building,
    action,
    balances
  }));
  return errors;
};

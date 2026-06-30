import type { CoreGameState } from "../../entities";
import type {
  ActionValidationResult,
  DistrictRelation,
  MapActionBlockReason,
  MapActionContext,
  MapActionValidationOptions
} from "./mapActionTypes";
import { isDistrictLocked, isTargetAdjacentToOwnedDistrict, resolveDistrictRelation } from "./mapRelations";
import { validateBorderAction, validateEmptyBorderAction, validateSpyAction } from "./mapBorderValidators";
import { hasFormerAllyTruce } from "../alliances/allianceLifecycle";

export const validateMapAction = (
  state: CoreGameState,
  context: MapActionContext,
  options: MapActionValidationOptions = {}
): ActionValidationResult => {
  const actor = state.playersById[context.actorPlayerId];
  const target = state.districtsById[context.targetDistrictId];

  if (!target) {
    return blocked("TARGET_NOT_FOUND", "blocked", false);
  }

  const relation = actor ? resolveDistrictRelation(state, actor, target) : "blocked";
  const origin = context.originDistrictId
    ? state.districtsById[context.originDistrictId]
    : undefined;
  const isAdjacentToOwnedDistrict = isTargetAdjacentToOwnedDistrict(
    state,
    context.actorPlayerId,
    target.id
  );

  if (!actor) {
    return blocked("TARGET_NOT_FOUND", relation, isAdjacentToOwnedDistrict);
  }

  if (context.action !== "select_spawn" && !actor.homeDistrictId) {
    return blocked("PLAYER_HAS_NO_SPAWN", relation, isAdjacentToOwnedDistrict);
  }

  if (isDistrictLocked(target)) {
    return blocked("DISTRICT_LOCKED", relation, isAdjacentToOwnedDistrict);
  }

  if (
    typeof context.expectedTargetVersion === "number"
    && target.version !== context.expectedTargetVersion
  ) {
    return blocked("VERSION_CONFLICT", relation, isAdjacentToOwnedDistrict);
  }

  if (
    origin
    && typeof context.expectedOriginVersion === "number"
    && origin.version !== context.expectedOriginVersion
  ) {
    return blocked("VERSION_CONFLICT", relation, isAdjacentToOwnedDistrict);
  }

  if (
    target.ownerPlayerId
    && ["attack", "heist", "spy"].includes(context.action)
    && hasFormerAllyTruce(state, actor.id, target.ownerPlayerId, context.serverTime ?? new Date().toISOString())
  ) {
    return blocked("FORMER_ALLY_TRUCE_ACTIVE", relation, isAdjacentToOwnedDistrict);
  }

  switch (context.action) {
    case "attack":
      return validateBorderAction({
        state,
        actorPlayerId: actor.id,
        target,
        origin,
        relation,
        isAdjacentToOwnedDistrict,
        expectedRelation: "enemy",
        reasonWhenNotExpected: "TARGET_NOT_ENEMY",
        requireAttackAuthorization: true,
        hasAttackAuthorization: options.hasAttackAuthorization
      });
    case "heist":
      return validateBorderAction({
        state,
        actorPlayerId: actor.id,
        target,
        origin,
        relation,
        isAdjacentToOwnedDistrict,
        expectedRelation: "enemy",
        reasonWhenNotExpected: "TARGET_NOT_ENEMY"
      });
    case "spy":
      return validateSpyAction({
        state,
        actorPlayerId: actor.id,
        target,
        origin,
        relation,
        isAdjacentToOwnedDistrict,
      });
    case "occupy":
    case "rob":
      return validateEmptyBorderAction({
        state,
        actorPlayerId: actor.id,
        target,
        origin,
        relation,
        isAdjacentToOwnedDistrict,
        requireOccupyAuthorization: context.action === "occupy",
        hasOccupyAuthorization: options.hasOccupyAuthorization,
        detectConsentRequired: context.action === "occupy" ? options.detectConsentRequired : undefined
      });
    case "place_trap":
      if (relation !== "self") {
        return blocked("TRAP_TARGET_NOT_OWNED", relation, isAdjacentToOwnedDistrict);
      }
      return allowed(relation, isAdjacentToOwnedDistrict, target.id);
    case "place_defense":
      if (relation !== "self" && relation !== "ally") {
        return blocked("ALLIANCE_REQUIRED", relation, isAdjacentToOwnedDistrict);
      }
      return allowed(relation, isAdjacentToOwnedDistrict, target.id);
    case "remove_defense":
      if (relation !== "self" && relation !== "ally") {
        return blocked("DEFENSE_NOT_OWNED", relation, isAdjacentToOwnedDistrict);
      }
      return allowed(relation, isAdjacentToOwnedDistrict, target.id);
    case "relocate_trap":
      if (relation !== "self") {
        return blocked("TRAP_TARGET_NOT_OWNED", relation, isAdjacentToOwnedDistrict);
      }
      return allowed(relation, isAdjacentToOwnedDistrict, target.id);
    case "select_spawn":
      if (relation !== "empty") {
        return blocked("SPAWN_ALREADY_OCCUPIED", relation, isAdjacentToOwnedDistrict);
      }
      return allowed(relation, isAdjacentToOwnedDistrict, target.id);
    default:
      return blocked("GAME_PHASE_BLOCKED", relation, isAdjacentToOwnedDistrict);
  }
};


const allowed = (
  relation: DistrictRelation,
  isAdjacentToOwnedDistrict: boolean,
  originDistrictId?: string
): ActionValidationResult => ({
  allowed: true,
  relation,
  isAdjacentToOwnedDistrict,
  originDistrictId
});

const blocked = (
  reasonCode: MapActionBlockReason,
  relation: DistrictRelation,
  isAdjacentToOwnedDistrict: boolean
): ActionValidationResult => ({
  allowed: false,
  reasonCode,
  relation,
  isAdjacentToOwnedDistrict
});

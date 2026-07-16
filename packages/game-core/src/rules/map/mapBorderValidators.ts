import type { District } from "@empire/shared-types";
import type { CoreGameState } from "../../entities";
import type {
  ActionValidationResult,
  DistrictRelation,
  MapActionBlockReason
} from "./mapActionTypes";
import {
  arePlayersActiveAllies,
  areDistrictsAdjacent,
  isDistrictLocked
} from "./mapRelations";
import { calculatePlayerFrontier } from "./frontier";

export const validateSpyAction = (input: {
  state: CoreGameState;
  actorPlayerId: string;
  target: District;
  origin?: District;
  route?: District;
  relation: DistrictRelation;
  isAdjacentToOwnedDistrict: boolean;
}): ActionValidationResult => {
  if (input.relation === "self") {
    return blocked("SPY_TARGET_IS_SELF", input.relation, input.isAdjacentToOwnedDistrict);
  }
  if (input.relation === "ally") {
    return blocked("SPY_TARGET_IS_ALLY", input.relation, input.isAdjacentToOwnedDistrict);
  }
  if (input.relation !== "enemy" && input.relation !== "empty") {
    return blocked("SPY_TARGET_INVALID", input.relation, input.isAdjacentToOwnedDistrict);
  }
  return validateOwnedOriginAdjacency(input, "SPY_TARGET_NOT_ADJACENT");
};

export const validateEmptyBorderAction = (input: {
  state: CoreGameState;
  actorPlayerId: string;
  target: District;
  origin?: District;
  route?: District;
  relation: DistrictRelation;
  isAdjacentToOwnedDistrict: boolean;
  requireOccupyAuthorization?: boolean;
  hasOccupyAuthorization?: () => boolean | MapActionBlockReason;
  detectConsentRequired?: () => { requiresConsent: boolean; affectedPlayerIds: string[] };
}): ActionValidationResult => {
  if (input.relation === "self") {
    return blocked("TARGET_IS_SELF", input.relation, input.isAdjacentToOwnedDistrict);
  }
  if (input.relation === "ally") {
    return blocked("TARGET_IS_ALLY", input.relation, input.isAdjacentToOwnedDistrict);
  }
  if (input.relation !== "empty") {
    return blocked("TARGET_NOT_EMPTY", input.relation, input.isAdjacentToOwnedDistrict);
  }

  const originValidation = validateOwnedOriginAdjacency(input, "TARGET_NOT_ADJACENT");
  if (!originValidation.allowed) return originValidation;

  if (input.requireOccupyAuthorization) {
    const authorization = input.hasOccupyAuthorization?.() ?? false;
    if (authorization !== true) {
      return blocked(
        typeof authorization === "string" ? authorization : "OCCUPY_SPY_REQUIRED",
        input.relation,
        input.isAdjacentToOwnedDistrict
      );
    }

    const consent = input.detectConsentRequired?.();
    if (consent?.requiresConsent) {
      return {
        ...blocked("CONSENT_REQUIRED", input.relation, input.isAdjacentToOwnedDistrict),
        requiresConsent: true,
        affectedPlayerIds: consent.affectedPlayerIds
      };
    }
  }

  return originValidation;
};

export const validateBorderAction = (input: {
  state: CoreGameState;
  actorPlayerId: string;
  target: District;
  origin?: District;
  route?: District;
  relation: DistrictRelation;
  isAdjacentToOwnedDistrict: boolean;
  expectedRelation: DistrictRelation;
  reasonWhenNotExpected: MapActionBlockReason;
  requireAttackAuthorization?: boolean;
  hasAttackAuthorization?: () => boolean;
}): ActionValidationResult => {
  if (input.relation === "self") {
    return blocked("TARGET_IS_SELF", input.relation, input.isAdjacentToOwnedDistrict);
  }
  if (input.relation === "ally") {
    return blocked("TARGET_IS_ALLY", input.relation, input.isAdjacentToOwnedDistrict);
  }
  if (input.relation !== input.expectedRelation) {
    return blocked(input.reasonWhenNotExpected, input.relation, input.isAdjacentToOwnedDistrict);
  }

  const originValidation = validateOwnedOriginAdjacency(input, "TARGET_NOT_ADJACENT");
  if (!originValidation.allowed) return originValidation;

  if (input.requireAttackAuthorization && !input.hasAttackAuthorization?.()) {
    return blocked("SPY_REQUIRED", input.relation, input.isAdjacentToOwnedDistrict);
  }

  return originValidation;
};

const validateOwnedOriginAdjacency = (input: {
  state: CoreGameState;
  actorPlayerId: string;
  target: District;
  origin?: District;
  route?: District;
  relation: DistrictRelation;
  isAdjacentToOwnedDistrict: boolean;
}, adjacencyReason: MapActionBlockReason): ActionValidationResult => {
  if (!input.origin || input.origin.ownerPlayerId !== input.actorPlayerId) {
    return blocked("NO_VALID_ORIGIN", input.relation, input.isAdjacentToOwnedDistrict);
  }
  if (isDistrictLocked(input.origin)) {
    return blocked("DISTRICT_LOCKED", input.relation, input.isAdjacentToOwnedDistrict);
  }
  if (input.route) {
    const actor = input.state.playersById[input.actorPlayerId];
    const routeOwner = input.route.ownerPlayerId ? input.state.playersById[input.route.ownerPlayerId] : null;
    if (!actor || !routeOwner || !arePlayersActiveAllies(input.state, actor, routeOwner)) {
      return blocked("ROUTE_NOT_ALLY", input.relation, input.isAdjacentToOwnedDistrict);
    }
    if (isDistrictLocked(input.route) || (input.route.stabilizingUntilTick ?? 0) > input.state.root.tick) {
      return blocked("ROUTE_LOCKED", input.relation, input.isAdjacentToOwnedDistrict);
    }
    if (input.isAdjacentToOwnedDistrict) {
      return blocked("CORRIDOR_NOT_REQUIRED", input.relation, input.isAdjacentToOwnedDistrict);
    }
    if (!areDistrictsAdjacent(input.state, input.origin.id, input.route.id)
      || !areDistrictsAdjacent(input.state, input.route.id, input.target.id)) {
      return blocked("ROUTE_NOT_ADJACENT", input.relation, input.isAdjacentToOwnedDistrict);
    }
    if (!isAllianceCorridorRecoveryState(input.state, input.actorPlayerId, input.relation)) {
      return blocked("CORRIDOR_NOT_AVAILABLE", input.relation, input.isAdjacentToOwnedDistrict);
    }
    return {
      ...allowed(input.relation, input.isAdjacentToOwnedDistrict, input.origin.id),
      routeDistrictId: input.route.id,
      routeOwnerPlayerId: routeOwner.id,
      usedAllianceCorridor: true
    };
  }
  if (!areDistrictsAdjacent(input.state, input.origin.id, input.target.id)) {
    return blocked(adjacencyReason, input.relation, input.isAdjacentToOwnedDistrict);
  }
  return allowed(input.relation, input.isAdjacentToOwnedDistrict, input.origin.id);
};

const isAllianceCorridorRecoveryState = (
  state: CoreGameState,
  playerId: string,
  targetRelation: DistrictRelation
): boolean => {
  const frontier = calculatePlayerFrontier(state, playerId);
  if (frontier.state === "allied_encircled") return true;
  if (frontier.state !== "mixed_encircled") return false;
  if (targetRelation === "empty") return frontier.emptyDistrictIds.length === 0;
  if (targetRelation === "enemy") return frontier.enemyDistrictIds.length === 0;
  return false;
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

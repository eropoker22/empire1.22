import type { District } from "@empire/shared-types";
import type { CoreGameState } from "../../entities";
import type {
  ActionValidationResult,
  DistrictRelation,
  MapActionBlockReason
} from "./mapActionTypes";
import {
  areDistrictsAdjacent,
  isDistrictLocked
} from "./mapRelations";

export const validateSpyAction = (input: {
  state: CoreGameState;
  actorPlayerId: string;
  target: District;
  origin?: District;
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
  relation: DistrictRelation;
  isAdjacentToOwnedDistrict: boolean;
}, adjacencyReason: MapActionBlockReason): ActionValidationResult => {
  if (!input.origin || input.origin.ownerPlayerId !== input.actorPlayerId) {
    return blocked("NO_VALID_ORIGIN", input.relation, input.isAdjacentToOwnedDistrict);
  }
  if (isDistrictLocked(input.origin)) {
    return blocked("DISTRICT_LOCKED", input.relation, input.isAdjacentToOwnedDistrict);
  }
  if (!areDistrictsAdjacent(input.state, input.origin.id, input.target.id)) {
    return blocked(adjacencyReason, input.relation, input.isAdjacentToOwnedDistrict);
  }
  return allowed(input.relation, input.isAdjacentToOwnedDistrict, input.origin.id);
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

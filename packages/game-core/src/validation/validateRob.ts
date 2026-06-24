import type { RobDistrictCommand } from "@empire/shared-types";
import type { CoreGameState } from "../entities";
import type { CoreError } from "../errors";
import { validateMapAction } from "../rules";

export const validateRob = (
  state: CoreGameState,
  command: RobDistrictCommand
): CoreError[] => {
  const originDistrictId = command.payload.sourceDistrictId
    ?? resolveSingleOwnedOrigin(state, command.playerId, command.payload.targetDistrictId);

  if (!originDistrictId) {
    return [{
      code: "NO_VALID_ORIGIN",
      message: "Rob command requires one unambiguous owned adjacent source district.",
      details: { targetDistrictId: command.payload.targetDistrictId }
    }];
  }

  const result = validateMapAction(state, {
    actorPlayerId: command.playerId,
    targetDistrictId: command.payload.targetDistrictId,
    originDistrictId,
    action: "rob",
    expectedTargetVersion: command.payload.expectedTargetVersion,
    expectedOriginVersion: command.payload.expectedSourceVersion
  });

  if (result.allowed) return [];

  return [{
    code: result.reasonCode ?? "ROB_BLOCKED",
    message: "Rob command is not allowed for this district.",
    details: {
      targetDistrictId: command.payload.targetDistrictId,
      sourceDistrictId: originDistrictId,
      relation: result.relation
    }
  }];
};

const resolveSingleOwnedOrigin = (
  state: CoreGameState,
  playerId: string,
  targetDistrictId: string
): string | undefined => {
  const target = state.districtsById[targetDistrictId];
  if (!target) return undefined;

  const origins = Object.values(state.districtsById).filter((district) =>
    district.ownerPlayerId === playerId
    && district.adjacentDistrictIds.includes(target.id)
    && target.adjacentDistrictIds.includes(district.id)
  );

  return origins.length === 1 ? origins[0].id : undefined;
};

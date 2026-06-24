import type { HeistDistrictCommand } from "@empire/shared-types";
import type { CoreGameState } from "../entities";
import type { CoreError } from "../errors";
import { validateMapAction } from "../rules";

const HEIST_STYLES = new Set(["stealth", "balanced", "all_in"]);

export const validateHeist = (
  state: CoreGameState,
  command: HeistDistrictCommand
): CoreError[] => {
  if (!HEIST_STYLES.has(command.payload.style)) {
    return [{
      code: "HEIST_STYLE_INVALID",
      message: "Heist style is not supported.",
      details: { style: command.payload.style }
    }];
  }

  if (!Number.isInteger(command.payload.gangMembersSent) || command.payload.gangMembersSent <= 0) {
    return [{
      code: "HEIST_GANG_MEMBERS_INVALID",
      message: "Heist requires a positive integer gang member count.",
      details: { gangMembersSent: command.payload.gangMembersSent }
    }];
  }

  const player = state.playersById[command.playerId];
  const availablePopulation = Math.max(0, Math.floor(Number(player?.population ?? 0)));
  if (availablePopulation < command.payload.gangMembersSent) {
    return [{
      code: "INSUFFICIENT_GANG_MEMBERS",
      message: "Not enough available gang members for this heist.",
      details: {
        requested: command.payload.gangMembersSent,
        available: availablePopulation
      }
    }];
  }

  const originDistrictId = command.payload.sourceDistrictId
    ?? resolveSingleOwnedOrigin(state, command.playerId, command.payload.targetDistrictId);

  if (!originDistrictId) {
    return [{
      code: "NO_VALID_ORIGIN",
      message: "Heist command requires one unambiguous owned adjacent source district.",
      details: { targetDistrictId: command.payload.targetDistrictId }
    }];
  }

  const result = validateMapAction(state, {
    actorPlayerId: command.playerId,
    targetDistrictId: command.payload.targetDistrictId,
    originDistrictId,
    action: "heist",
    expectedTargetVersion: command.payload.expectedTargetVersion,
    expectedOriginVersion: command.payload.expectedSourceVersion
  });

  if (result.allowed) return [];

  return [{
    code: result.reasonCode ?? "HEIST_BLOCKED",
    message: "Heist command is not allowed for this district.",
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

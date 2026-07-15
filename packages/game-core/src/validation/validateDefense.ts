import type { PlaceDefenseCommand, RemoveDefenseCommand } from "@empire/shared-types";
import { DEFENSE_WEAPON_IDS } from "@empire/shared-types";
import type { CoreGameState } from "../entities";
import type { CoreError } from "../errors";
import { validateMapAction } from "../rules";

const DEFENSE_WEAPON_SET = new Set<string>(DEFENSE_WEAPON_IDS);

export const validatePlaceDefense = (
  state: CoreGameState,
  command: PlaceDefenseCommand
): CoreError[] => validateDefenseCommand(state, command, "place_defense");

export const validateRemoveDefense = (
  state: CoreGameState,
  command: RemoveDefenseCommand
): CoreError[] => validateDefenseCommand(state, command, "remove_defense");

const validateDefenseCommand = (
  state: CoreGameState,
  command: PlaceDefenseCommand | RemoveDefenseCommand,
  action: "place_defense" | "remove_defense"
): CoreError[] => {
  if (!DEFENSE_WEAPON_SET.has(command.payload.defenseItemId)) {
    return [{
      code: "DEFENSE_ITEM_INVALID",
      message: "Defense item is not supported.",
      details: { defenseItemId: command.payload.defenseItemId }
    }];
  }

  if (!Number.isInteger(command.payload.amount) || command.payload.amount <= 0) {
    return [{
      code: "DEFENSE_AMOUNT_INVALID",
      message: "Defense amount must be a positive integer.",
      details: { amount: command.payload.amount }
    }];
  }

  const result = validateMapAction(state, {
    actorPlayerId: command.playerId,
    targetDistrictId: command.payload.targetDistrictId,
    serverTime: command.issuedAt,
    action,
    expectedTargetVersion: command.payload.expectedTargetVersion
  });

  if (!result.allowed) {
    return [{
      code: result.reasonCode ?? "DEFENSE_BLOCKED",
      message: "Defense command is not allowed for this district.",
      details: {
        targetDistrictId: command.payload.targetDistrictId,
        relation: result.relation
      }
    }];
  }

  return [];
};

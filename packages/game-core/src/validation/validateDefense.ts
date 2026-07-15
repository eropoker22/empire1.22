import type { PlaceDefenseCommand, RemoveDefenseCommand } from "@empire/shared-types";
import { DEFENSE_WEAPON_IDS } from "@empire/shared-types";
import type { CoreGameState } from "../entities";
import type { CoreError } from "../errors";
import type { GameCoreContext } from "../engine/context";
import {
  calculateDefenseCapacityUsage,
  calculateDefensePlacementPoints,
  resolveDefenseCapacityPoints,
  validateMapAction
} from "../rules";

const DEFENSE_WEAPON_SET = new Set<string>(DEFENSE_WEAPON_IDS);

export const validatePlaceDefense = (
  state: CoreGameState,
  command: PlaceDefenseCommand,
  context?: GameCoreContext
): CoreError[] => {
  const errors = validateDefenseCommand(state, command, "place_defense");
  if (errors.length > 0) return errors;
  const district = state.districtsById[command.payload.targetDistrictId]!;
  const capacityConfig = context?.config.balance.conflict?.defenseCapacity;
  const usedPoints = calculateDefenseCapacityUsage(district.defenseLoadout, capacityConfig);
  const requestedPoints = calculateDefensePlacementPoints(
    command.payload.defenseItemId,
    command.payload.amount,
    capacityConfig
  );
  const capacityPoints = resolveDefenseCapacityPoints(district.zone, capacityConfig);
  if (usedPoints + requestedPoints > capacityPoints) {
    return [{
      code: "DEFENSE_CAPACITY_EXCEEDED",
      message: "District defense capacity would be exceeded.",
      details: { usedPoints, requestedPoints, capacityPoints }
    }];
  }
  const isAlliedPlacement = district.ownerPlayerId !== command.playerId;
  const supportBlocked = isAlliedPlacement && Object.values(state.allianceExitPenaltiesById ?? {}).some(
    (penalty) =>
      penalty.playerId === command.playerId
      && penalty.blocksAllianceDefenseSupport
      && Date.parse(penalty.penaltyEndsAt) > Date.parse(command.issuedAt)
  );
  return supportBlocked
    ? [{ code: "ALLIANCE_DEFENSE_SUPPORT_BLOCKED", message: "Alliance defense support is temporarily blocked." }]
    : [];
};

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

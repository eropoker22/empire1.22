import type { RobDistrictCommand } from "@empire/shared-types";
import type { ConflictBalanceConfig } from "../contracts";
import type { CoreGameState } from "../entities";
import type { CoreError } from "../errors";
import { createRobCooldownKey, createRobSourceCooldownKey, validateMapAction } from "../rules";

export const validateRob = (
  state: CoreGameState,
  command: RobDistrictCommand,
  _conflictConfig?: ConflictBalanceConfig
): CoreError[] => {
  const originDistrictId = command.payload.sourceDistrictId
    ?? resolveSingleOwnedOrigin(state, command.playerId, command.payload.targetDistrictId);

  if (!originDistrictId) {
    return [{
      code: "NO_VALID_ORIGIN",
      message: "Vykradení vyžaduje jeden jasný vlastní sousední zdrojový district.",
      details: { targetDistrictId: command.payload.targetDistrictId }
    }];
  }

  const result = validateMapAction(state, {
    actorPlayerId: command.playerId,
    targetDistrictId: command.payload.targetDistrictId,
    originDistrictId,
    serverTime: command.issuedAt,
    action: "rob",
    expectedTargetVersion: command.payload.expectedTargetVersion,
    expectedOriginVersion: command.payload.expectedSourceVersion,
    routeDistrictId: command.payload.routeDistrictId,
    expectedRouteVersion: command.payload.expectedRouteVersion
  });

  const player = state.playersById[command.playerId];
  if (!player) {
    return [{
      code: "PLAYER_NOT_FOUND",
      message: "Vykradení může spustit jen existující hráč.",
      details: { playerId: command.playerId }
    }];
  }

  if (result.reasonCode !== "NO_VALID_ORIGIN") {
    const availablePopulation = Math.floor(
      Number(
        player.population ??
        state.resourceStatesById[player.resourceStateId]?.balances?.population ??
        0
      )
    );

    if (!Number.isFinite(availablePopulation) || availablePopulation < 1) {
      return [{
        code: "INSUFFICIENT_POPULATION",
        message: "Vykradení vyžaduje alespoň jednoho člověka z populace.",
        details: {
          requiredPopulation: 1,
          availablePopulation
        }
      }];
    }
  }

  if (!result.allowed) {
    return [{
      code: result.reasonCode ?? "ROB_BLOCKED",
      message: "Vykradení není v tomhle districtu povolené.",
      details: {
        targetDistrictId: command.payload.targetDistrictId,
        sourceDistrictId: originDistrictId,
        relation: result.relation
      }
    }];
  }

  const cooldownState = state.cooldownStatesById[player.cooldownStateId];
  const activeCooldown = getActiveRobCooldown(
    cooldownState?.cooldowns ?? {},
    originDistrictId,
    command.payload.targetDistrictId,
    state.root.tick
  );

  if (activeCooldown) {
    return [{
      code: "rob_cooldown_active",
      message: `Vykradení tohoto districtu nebo zdrojové trasy se obnoví za ${activeCooldown.remainingTicks} ticků.`,
      details: {
        targetDistrictId: command.payload.targetDistrictId,
        sourceDistrictId: originDistrictId,
        cooldownKey: activeCooldown.key,
        cooldownUntilTick: activeCooldown.untilTick,
        remainingTicks: activeCooldown.remainingTicks
      }
    }];
  }

  return [];
};

const getActiveRobCooldown = (
  cooldowns: Record<string, number>,
  sourceDistrictId: string,
  targetDistrictId: string,
  currentTick: number
): { key: string; untilTick: number; remainingTicks: number } | null => {
  for (const key of [createRobCooldownKey(targetDistrictId), createRobSourceCooldownKey(sourceDistrictId)]) {
    const untilTick = cooldowns[key];
    if (typeof untilTick === "number" && untilTick > currentTick) {
      return {
        key,
        untilTick,
        remainingTicks: untilTick - currentTick
      };
    }
  }

  return null;
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

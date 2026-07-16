import type { HeistDistrictCommand } from "@empire/shared-types";
import type { ConflictBalanceConfig } from "../contracts";
import type { CoreGameState } from "../entities";
import type { CoreError } from "../errors";
import {
  createHeistAttackerTargetCooldownKey,
  createHeistGlobalCooldownKey,
  resolveDistrictActionAvailability,
  resolveMajorOperationBlock,
  validateDistrictConflictRevision,
  validateMapAction
} from "../rules";

const HEIST_STYLES = new Set(["stealth", "balanced", "all_in"]);

export const validateHeist = (
  state: CoreGameState,
  command: HeistDistrictCommand,
  conflictConfig?: ConflictBalanceConfig
): CoreError[] => {
  const targetDistrict = state.districtsById[command.payload.targetDistrictId];
  if (!targetDistrict) return [{ code: "TARGET_NOT_FOUND", message: "Cílový district neexistuje." }];
  const revisionError = validateDistrictConflictRevision(targetDistrict, command.payload.expectedConflictRevision);
  if (revisionError) return [revisionError];
  const availabilityError = resolveDistrictActionAvailability(state, command.playerId, targetDistrict.id, "heist");
  if (availabilityError) return [availabilityError];

  if (!HEIST_STYLES.has(command.payload.style)) {
    return [{
      code: "HEIST_STYLE_INVALID",
      message: "Tenhle styl heistu není podporovaný.",
      details: { style: command.payload.style }
    }];
  }

  if (!Number.isInteger(command.payload.gangMembersSent) || command.payload.gangMembersSent <= 0) {
    return [{
      code: "HEIST_GANG_MEMBERS_INVALID",
      message: "Heist vyžaduje kladný počet členů gangu.",
      details: { gangMembersSent: command.payload.gangMembersSent }
    }];
  }

  const styleConfig = conflictConfig?.heist?.styles[command.payload.style];
  if (styleConfig && (
    command.payload.gangMembersSent < styleConfig.minMembers
    || command.payload.gangMembersSent > styleConfig.maxMembers
  )) {
    return [{
      code: "HEIST_GANG_MEMBERS_OUT_OF_RANGE",
      message: "Počet členů neodpovídá zvolenému stylu heistu.",
      details: { minMembers: styleConfig.minMembers, maxMembers: styleConfig.maxMembers }
    }];
  }

  const player = state.playersById[command.playerId];
  const availablePopulation = Math.max(0, Math.floor(Number(player?.population ?? 0)));
  if (availablePopulation < command.payload.gangMembersSent) {
    return [{
      code: "INSUFFICIENT_GANG_MEMBERS",
      message: "Na tenhle heist nemáš dost dostupných členů gangu.",
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
      message: "Heist vyžaduje jeden jasný vlastní sousední zdrojový district.",
      details: { targetDistrictId: command.payload.targetDistrictId }
    }];
  }

  const result = validateMapAction(state, {
    actorPlayerId: command.playerId,
    targetDistrictId: command.payload.targetDistrictId,
    originDistrictId,
    serverTime: command.issuedAt,
    action: "heist",
    expectedTargetVersion: command.payload.expectedTargetVersion,
    expectedOriginVersion: command.payload.expectedSourceVersion,
    routeDistrictId: command.payload.routeDistrictId,
    expectedRouteVersion: command.payload.expectedRouteVersion
  });

  if (!result.allowed) {
    return [{
      code: result.reasonCode ?? "HEIST_BLOCKED",
      message: "Heist není v tomhle districtu povolený.",
      details: {
        targetDistrictId: command.payload.targetDistrictId,
        sourceDistrictId: originDistrictId,
        relation: result.relation
      }
    }];
  }

  const sourceDistrict = state.districtsById[originDistrictId];
  if (sourceDistrict && (sourceDistrict.stabilizingUntilTick ?? 0) > state.root.tick) {
    return [{
      code: "SOURCE_DISTRICT_STABILIZING",
      message: "Stabilizující district nelze použít jako zdroj heistu."
    }];
  }

  const cooldownState = state.cooldownStatesById[player.cooldownStateId];
  const majorOperationBlock = resolveMajorOperationBlock(
    cooldownState?.cooldowns ?? {},
    originDistrictId,
    state.root.tick
  );
  if (majorOperationBlock) {
    return [{
      code: majorOperationBlock.code,
      message: majorOperationBlock.code === "SOURCE_CONFLICT_LOCKED"
        ? "Tento source district právě podporuje jinou operaci."
        : "Tvůj gang právě dokončuje jinou velkou operaci.",
      details: { cooldownUntilTick: majorOperationBlock.untilTick }
    }];
  }
  const activeCooldown = getActiveHeistCooldown(
    cooldownState?.cooldowns ?? {},
    command.payload.targetDistrictId,
    state.root.tick
  );

  if (activeCooldown) {
    return [{
      code: "heist_cooldown_active",
      message: `Vykradení hráče nebo zdrojová trasa se obnoví za ${activeCooldown.remainingTicks} ticků.`,
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

const getActiveHeistCooldown = (
  cooldowns: Record<string, number>,
  targetDistrictId: string,
  currentTick: number
): { key: string; untilTick: number; remainingTicks: number } | null => {
  for (const key of [createHeistGlobalCooldownKey(), createHeistAttackerTargetCooldownKey(targetDistrictId)]) {
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

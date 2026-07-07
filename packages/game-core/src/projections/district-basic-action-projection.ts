import type { CoreGameState } from "../entities/game-state";
import type { ConflictBalanceConfig } from "../contracts";
import type { HeistDistrictCommand, RobDistrictCommand } from "@empire/shared-types";
import {
  createHeistCooldownKey,
  createHeistSourceCooldownKey,
  createRobCooldownKey,
  createRobSourceCooldownKey,
  validateMapAction
} from "../rules";
import { validateHeist, validateRob } from "../validation";

export const createDistrictRobTargetViews = (
  state: CoreGameState,
  playerId: string,
  sourceDistrictId: string,
  conflictConfig?: ConflictBalanceConfig,
  issuedAt = new Date().toISOString()
) => {
  const source = state.districtsById[sourceDistrictId];
  if (!source) return [];
  const player = state.playersById[playerId];
  const availablePopulation = Math.floor(
    Number(
      player?.population ??
      state.resourceStatesById[player?.resourceStateId]?.balances?.population ??
      0
    )
  );
  const hasPopulationForRob = Number.isFinite(availablePopulation) && availablePopulation >= 1;

  return source.adjacentDistrictIds
    .map((districtId) => state.districtsById[districtId])
    .filter((target) => target !== undefined)
    .map((target) => {
      const previewCommand: RobDistrictCommand = {
        id: `preview:rob:${source.id}:${target.id}`,
        type: "rob-district",
        mode: state.serverInstance.mode,
        playerId,
        serverInstanceId: state.serverInstance.id,
        issuedAt,
        payload: {
          targetDistrictId: target.id,
          sourceDistrictId: source.id,
          expectedTargetVersion: target.version,
          expectedSourceVersion: source.version
        },
        clientRequestId: null
      };
      const errors = validateRob(state, previewCommand, conflictConfig);
      const cooldownRemainingTicks = getMaxCooldownRemainingTicks(
        state,
        playerId,
        [createRobCooldownKey(target.id), createRobSourceCooldownKey(source.id)]
      );
      const populationBlocked = hasPopulationForRob ? null : "INSUFFICIENT_POPULATION";
      const disabledCode = errors[0]?.code ?? populationBlocked ?? null;
      const actionAllowed = errors.length === 0 && !populationBlocked;

      return {
        districtId: target.id,
        name: target.name,
        ownerPlayerId: target.ownerPlayerId,
        status: target.status,
        enabled: actionAllowed,
        disabledCode,
        disabledReason: errors[0]?.message ?? (disabledCode ? formatActionReason(disabledCode) : null),
        cooldownRemainingTicks,
        expectedTargetVersion: target.version,
        expectedSourceVersion: source.version
      };
    });
};

export const createDistrictHeistTargetViews = (
  state: CoreGameState,
  playerId: string,
  sourceDistrictId: string,
  conflictConfig?: ConflictBalanceConfig,
  issuedAt = new Date().toISOString()
) => {
  const source = state.districtsById[sourceDistrictId];
  if (!source) return [];

  return source.adjacentDistrictIds
    .map((districtId) => state.districtsById[districtId])
    .filter((target) => target !== undefined)
    .map((target) => {
      const previewCommand: HeistDistrictCommand = {
        id: `preview:heist:${source.id}:${target.id}`,
        type: "heist-district",
        mode: state.serverInstance.mode,
        playerId,
        serverInstanceId: state.serverInstance.id,
        issuedAt,
        payload: {
          targetDistrictId: target.id,
          sourceDistrictId: source.id,
          style: "balanced",
          gangMembersSent: 10,
          expectedTargetVersion: target.version,
          expectedSourceVersion: source.version
        },
        clientRequestId: null
      };
      const errors = validateHeist(state, previewCommand, conflictConfig);
      const cooldownRemainingTicks = getMaxCooldownRemainingTicks(
        state,
        playerId,
        [createHeistCooldownKey(target.id), createHeistSourceCooldownKey(source.id)]
      );
      return {
        districtId: target.id,
        name: target.name,
        ownerPlayerId: target.ownerPlayerId,
        status: target.status,
        enabled: errors.length === 0,
        disabledCode: errors[0]?.code ?? null,
        disabledReason: errors[0]?.message ?? null,
        cooldownRemainingTicks,
        expectedTargetVersion: target.version,
        expectedSourceVersion: source.version,
        styles: [
          { style: "stealth" as const, label: "Tichý", defaultGangMembersSent: 5 },
          { style: "balanced" as const, label: "Vyvážený", defaultGangMembersSent: 10 },
          { style: "all_in" as const, label: "Tvrdý", defaultGangMembersSent: 25 }
        ]
      };
    });
};

const getMaxCooldownRemainingTicks = (
  state: CoreGameState,
  playerId: string,
  cooldownKeys: string[]
): number => {
  const player = state.playersById[playerId];
  const cooldowns = state.cooldownStatesById[player?.cooldownStateId ?? ""]?.cooldowns ?? {};
  return cooldownKeys.reduce((remainingTicks, key) => {
    const untilTick = cooldowns[key];
    return Math.max(
      remainingTicks,
      typeof untilTick === "number" ? Math.max(0, untilTick - state.root.tick) : 0
    );
  }, 0);
};

export const createDistrictDefenseActionView = (
  state: CoreGameState,
  playerId: string,
  districtId: string,
  action: "place_defense" | "remove_defense"
) => {
  const district = state.districtsById[districtId];
  if (!district) return null;

  const validation = validateMapAction(state, {
    actorPlayerId: playerId,
    targetDistrictId: district.id,
    action
  });
  const disabledCode = validation.reasonCode ?? null;

  return {
    enabled: validation.allowed,
    disabledCode,
    disabledReason: disabledCode ? formatActionReason(disabledCode) : null,
    expectedTargetVersion: district.version
  };
};

const formatActionReason = (reasonCode: string | undefined): string | null =>
  reasonCode ? reasonCode : null;

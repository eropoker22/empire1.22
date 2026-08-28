import type { CoreGameState } from "../entities/game-state";
import type { ConflictBalanceConfig } from "../contracts";
import {
  DEFENSE_WEAPON_IDS,
  type HeistDistrictCommand
} from "@empire/shared-types";
import {
  calculateDefensePlacementPoints,
  calculateContributorDefenseAmount,
  calculateDefenseCapacityUsage,
  calculateOwnerOwnedDefenseAmount,
  calculateImmediateHeistChances,
  createHeistAttackerTargetCooldownKey,
  createHeistGlobalCooldownKey,
  listDeployedDefenseContributions,
  resolveDefenseCapacityPoints,
  validateMapAction
} from "../rules";
import { validateHeist } from "../validation";
import { resolvePlayerPopulation } from "../state/playerPopulation";
export { createDistrictRobTargetViews } from "./district-rob-target-projection";

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
      const availablePopulation = Math.max(0, Math.floor(resolvePlayerPopulation(state, playerId)));
      const styleConfig = conflictConfig?.heist?.styles;
      const styleMinimum = (style: "stealth" | "balanced" | "all_in") => (
        styleConfig?.[style]?.minMembers ?? (style === "stealth" ? 5 : style === "balanced" ? 10 : 25)
      );
      const recommendedStyle = availablePopulation >= styleMinimum("balanced")
        ? "balanced" as const
        : availablePopulation >= styleMinimum("stealth")
          ? "stealth" as const
          : availablePopulation >= styleMinimum("all_in")
            ? "all_in" as const
            : "stealth" as const;
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
          style: recommendedStyle,
          populationSent: styleMinimum(recommendedStyle),
          expectedTargetVersion: target.version,
          expectedSourceVersion: source.version,
          expectedConflictRevision: target.conflictRevision
        },
        clientRequestId: null
      };
      const errors = validateHeist(state, previewCommand, conflictConfig);
      const cooldownRemainingTicks = Math.max(getMaxCooldownRemainingTicks(
        state,
        playerId,
        [createHeistGlobalCooldownKey(), createHeistAttackerTargetCooldownKey(target.id)]
      ), Math.max(0, Number(target.heistProtectedUntilTick ?? 0) - state.root.tick));
      const heistConfig = conflictConfig?.heist;
      const victimProtectionRemainingTicks = Math.max(
        0,
        Number(target.heistProtectedUntilTick ?? 0) - state.root.tick
      );
      const createStyleView = (style: "stealth" | "balanced" | "all_in", label: string) => {
        const config = styleConfig?.[style];
        const minMembers = config?.minMembers ?? (style === "stealth" ? 5 : style === "balanced" ? 10 : 25);
        const maxMembers = config?.maxMembers ?? (style === "stealth" ? 35 : style === "balanced" ? 70 : 120);
        const chances = config && heistConfig
          ? calculateImmediateHeistChances({
              defenseLoadout: target.defenseLoadout,
              style: config,
              populationSent: minMembers,
              config: heistConfig
            })
          : {
              successChance: config?.baseSuccessChance ?? 0,
              detectionChance: config?.baseDetectionChance ?? 0
            };
        return {
          style,
          label,
          enabled: availablePopulation >= minMembers,
          defaultPopulationSent: minMembers,
          minMembers,
          maxMembers,
          successChance: chances.successChance,
          detectionChance: chances.detectionChance,
          lossRisk: style === "stealth" ? "low" as const : style === "balanced" ? "high" as const : "extreme" as const,
          heatOnSuccess: config?.heatOnSuccess ?? 0,
          heatOnDetected: config?.heatOnDetected ?? 0
        };
      };
      return {
        sourceDistrictId: source.id,
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
        expectedConflictRevision: target.conflictRevision,
        styles: [
          createStyleView("stealth", "Tichý"),
          createStyleView("balanced", "Vyvážený"),
          createStyleView("all_in", "Tvrdý")
        ],
        recommendedStyle: errors.length === 0 ? recommendedStyle : null,
        availablePopulation,
        victimProtectionRemainingTicks,
        majorOffenseCooldownEndsAtTick: state.cooldownStatesById[state.playersById[playerId]?.cooldownStateId ?? ""]
          ?.cooldowns["offense:global"] ?? null,
        sourceConflictLockEndsAtTick: state.cooldownStatesById[state.playersById[playerId]?.cooldownStateId ?? ""]
          ?.cooldowns[`conflict:source:${source.id}`] ?? null
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
  action: "place_defense" | "remove_defense",
  conflictConfig?: ConflictBalanceConfig
) => {
  const district = state.districtsById[districtId];
  if (!district) return null;

  const validation = validateMapAction(state, {
    actorPlayerId: playerId,
    targetDistrictId: district.id,
    action
  });
  const usedCapacityPoints = calculateDefenseCapacityUsage(district.defenseLoadout, conflictConfig?.defenseCapacity);
  const maxCapacityPoints = resolveDefenseCapacityPoints(district.zone, conflictConfig?.defenseCapacity);
  const ownerOwnedAmounts = Object.fromEntries(DEFENSE_WEAPON_IDS.map((itemId) => [
    itemId,
    calculateOwnerOwnedDefenseAmount(state, district.id, itemId)
  ]));
  const alliedContributionAmounts = Object.fromEntries(DEFENSE_WEAPON_IDS.map((itemId) => [
    itemId,
    listDeployedDefenseContributions(state, district.id, itemId)
      .reduce((sum, contribution) => sum + contribution.remainingAmount, 0)
  ]));
  const playerRemovableAmounts = Object.fromEntries(DEFENSE_WEAPON_IDS.map((itemId) => [
    itemId,
    district.ownerPlayerId === playerId
      ? ownerOwnedAmounts[itemId]
      : calculateContributorDefenseAmount(state, playerId, district.id, itemId)
  ]));
  const player = state.playersById[playerId];
  const playerBalances = state.resourceStatesById[player?.resourceStateId ?? ""]?.balances ?? {};
  const availableInventoryAmounts = Object.fromEntries(DEFENSE_WEAPON_IDS.map((itemId) => [
    itemId,
    Math.max(0, Math.floor(Number(playerBalances[itemId] ?? 0)))
  ]));
  const preferredItemId = action === "place_defense"
    ? DEFENSE_WEAPON_IDS.find((itemId) =>
        availableInventoryAmounts[itemId] > 0
        && usedCapacityPoints + calculateDefensePlacementPoints(
          itemId,
          1,
          conflictConfig?.defenseCapacity
        ) <= maxCapacityPoints
      ) ?? null
    : DEFENSE_WEAPON_IDS.find((itemId) => playerRemovableAmounts[itemId] > 0) ?? null;
  const hasPlaceableInventory = DEFENSE_WEAPON_IDS.some((itemId) => availableInventoryAmounts[itemId] > 0);
  const actionBlockedCode = action === "place_defense"
    ? hasPlaceableInventory
      ? "DEFENSE_CAPACITY_EXCEEDED"
      : "DEFENSE_ITEM_UNAVAILABLE"
    : "DEFENSE_NOT_OWNED";
  const disabledCode = validation.reasonCode ?? (preferredItemId ? null : actionBlockedCode);

  return {
    enabled: validation.allowed && preferredItemId !== null,
    disabledCode,
    disabledReason: disabledCode ? formatActionReason(disabledCode) : null,
    expectedTargetVersion: district.version,
    preferredItemId,
    preferredAmount: 1,
    usedCapacityPoints,
    maxCapacityPoints,
    availableInventoryAmounts,
    ownerOwnedAmounts,
    alliedContributionAmounts,
    playerRemovableAmounts
  };
};

const formatActionReason = (reasonCode: string | undefined): string | null => {
  switch (reasonCode) {
    case "DEFENSE_ITEM_UNAVAILABLE":
      return "V inventáři nemáš žádnou obrannou položku.";
    case "DEFENSE_CAPACITY_EXCEEDED":
      return "Kapacita obrany districtu je plná.";
    case "DEFENSE_NOT_OWNED":
      return "V districtu nemáš žádnou vlastní obranu k odebrání.";
    case "ALLIANCE_REQUIRED":
      return "Obranu lze vložit jen do vlastního nebo aktivního aliančního districtu.";
    default:
      return reasonCode ?? null;
  }
};

import type { AllianceLifecycleBalanceConfig } from "../../contracts/game-mode-config";

export const freeModeAllianceLifecycleConfig: AllianceLifecycleBalanceConfig = {
  readiness: {
    readyIntervalSeconds: 24 * 60 * 60,
    readyButtonAvailableBeforeDueSeconds: 4 * 60 * 60,
    gracePeriodSeconds: 4 * 60 * 60,
    voteDurationSeconds: 2 * 60 * 60,
    voteRetryCooldownSeconds: 2 * 60 * 60
  },
  voluntaryLeavePenalty: {
    allianceJoinLockoutSeconds: 12 * 60 * 60,
    allianceCreateLockoutSeconds: 12 * 60 * 60,
    influenceDebuffSeconds: 8 * 60 * 60,
    actionCooldownDebuffSeconds: 6 * 60 * 60,
    formerAllyTruceSeconds: 60 * 60,
    influenceGenerationMultiplier: 0.8,
    actionCooldownMultiplier: 1.15,
    statDebuffSeconds: 12 * 60 * 60,
    attackMultiplier: 0.8,
    defenseMultiplier: 0.8,
    blocksAllianceDefenseSupport: true
  },
  inactiveKickPenalty: {
    allianceJoinLockoutSeconds: 6 * 60 * 60,
    allianceCreateLockoutSeconds: 6 * 60 * 60,
    influenceDebuffSeconds: 0,
    actionCooldownDebuffSeconds: 0,
    statDebuffSeconds: 12 * 60 * 60,
    formerAllyTruceSeconds: 60 * 60,
    influenceGenerationMultiplier: 1,
    actionCooldownMultiplier: 1,
    attackMultiplier: 0.8,
    defenseMultiplier: 0.8,
    productionMultiplier: 0.8,
    incomeMultiplier: 0.8,
    blocksAllianceDefenseSupport: true
  },
  disbandPenalty: {
    allianceJoinLockoutSeconds: 30 * 60,
    allianceCreateLockoutSeconds: 30 * 60,
    influenceDebuffSeconds: 0,
    actionCooldownDebuffSeconds: 0,
    formerAllyTruceSeconds: 60 * 60,
    influenceGenerationMultiplier: 1,
    actionCooldownMultiplier: 1,
    blocksAllianceDefenseSupport: false
  },
  administrativeRemovalPenalty: {
    allianceJoinLockoutSeconds: 0,
    allianceCreateLockoutSeconds: 0,
    influenceDebuffSeconds: 0,
    actionCooldownDebuffSeconds: 0,
    formerAllyTruceSeconds: 0,
    influenceGenerationMultiplier: 1,
    actionCooldownMultiplier: 1,
    blocksAllianceDefenseSupport: false
  },
  affectedCooldownActionIds: ["spy", "heist", "attack", "rob"],
  exitPendingTimeoutSeconds: 15 * 60
};

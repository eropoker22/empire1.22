import type {
  DistrictPanelView,
  GameplaySliceCommandHintsView
} from "@empire/shared-types";

/** Builds compact client hints from the already-authoritative district projection. */
export const createGameplaySliceCommandHints = (
  district: DistrictPanelView | null
): GameplaySliceCommandHintsView => {
  if (!district) {
    return {
      selectedDistrictId: null,
      availableBuildingActionCount: 0,
      availableSpyTargetCount: 0,
      availableAttackTargetCount: 0,
      availableOccupyTargetCount: 0,
      cooldowns: [],
      disabledReasons: []
    };
  }

  const buildingActions = district.buildings.flatMap((building) => building.actions);
  const cooldowns = [
    ...buildingActions
      .filter((action) => (action.cooldownRemainingTicks ?? 0) > 0)
      .map((action) => ({
        commandType: "run-building-action",
        targetId: `${action.buildingId}:${action.actionId}`,
        remainingTicks: action.cooldownRemainingTicks ?? 0,
        reason: action.disabledReason
      })),
    ...district.occupyTargets
      .filter((target) => target.cooldownRemainingTicks > 0)
      .map((target) => ({
        commandType: "occupy-district",
        targetId: target.districtId,
        remainingTicks: target.cooldownRemainingTicks,
        reason: target.disabledReason
      })),
    ...district.attackTargets
      .filter((target) => (target.cooldownRemainingTicks ?? 0) > 0)
      .map((target) => ({
        commandType: "attack-district",
        targetId: target.districtId,
        remainingTicks: target.cooldownRemainingTicks ?? 0,
        reason: target.disabledReason
      })),
    ...(district.robTargets ?? [])
      .filter((target) => (target.cooldownRemainingTicks ?? 0) > 0)
      .map((target) => ({
        commandType: "rob-district",
        targetId: target.districtId,
        remainingTicks: target.cooldownRemainingTicks ?? 0,
        reason: target.disabledReason
      })),
    ...(district.heistTargets ?? [])
      .filter((target) => (target.cooldownRemainingTicks ?? 0) > 0)
      .map((target) => ({
        commandType: "heist-district",
        targetId: target.districtId,
        remainingTicks: target.cooldownRemainingTicks ?? 0,
        reason: target.disabledReason
      }))
  ];
  const disabledReasons = [
    ...buildingActions
      .filter((action) => action.disabledReason)
      .map((action) => ({
        commandType: "run-building-action",
        targetId: `${action.buildingId}:${action.actionId}`,
        reason: action.disabledReason!
      })),
    ...district.spyTargets
      .filter((target) => target.disabledReason)
      .map((target) => ({
        commandType: "spy-district",
        targetId: target.districtId,
        reason: target.disabledReason!
      })),
    ...district.attackTargets
      .filter((target) => target.disabledReason)
      .map((target) => ({
        commandType: "attack-district",
        targetId: target.districtId,
        reason: target.disabledReason!
      })),
    ...district.occupyTargets
      .filter((target) => target.disabledReason)
      .map((target) => ({
        commandType: "occupy-district",
        targetId: target.districtId,
        reason: target.disabledReason!
      })),
    ...(district.robTargets ?? [])
      .filter((target) => target.disabledReason)
      .map((target) => ({
        commandType: "rob-district",
        targetId: target.districtId,
        reason: target.disabledReason!
      })),
    ...(district.heistTargets ?? [])
      .filter((target) => target.disabledReason)
      .map((target) => ({
        commandType: "heist-district",
        targetId: target.districtId,
        reason: target.disabledReason!
      })),
    ...(district.trap?.disabledReason
      ? [{
          commandType: "place-trap",
          targetId: district.districtId,
          reason: district.trap.disabledReason
        }]
      : [])
  ];

  return {
    selectedDistrictId: district.districtId,
    availableBuildingActionCount: buildingActions.filter((action) => action.enabled).length,
    availableSpyTargetCount: district.spyTargets.filter((target) => target.enabled).length,
    availableAttackTargetCount: district.attackTargets.filter((target) => target.enabled).length,
    availableOccupyTargetCount: district.occupyTargets.filter((target) => target.enabled).length,
    cooldowns,
    disabledReasons
  };
};

/**
 * Responsibility: Collects shared production policy names and placeholders.
 * Belongs here: production-specific rule references and local helpers.
 * Does not belong here: command transport or admin operations.
 */
export const productionRuleSet = "default-production";

export const resolveCraftProcessingDurationTicks = (
  durationTicks: number,
  cooldownMultiplier: number
): number => Math.max(1, Math.ceil(durationTicks * cooldownMultiplier));

export const applyDistrictStabilizationToProductionDuration = (
  durationTicks: number,
  state: CoreGameState,
  building: Building,
  context: GameCoreContext
): number => {
  return Math.max(1, Math.ceil(durationTicks / resolveDistrictStabilizationProductionSpeed(state, building, context)));
};

export const resolveDistrictStabilizationProductionSpeed = (state: CoreGameState, building: Building, context: GameCoreContext): number => {
  const district = state.districtsById[building.districtId];
  if (!district || typeof district.stabilizingUntilTick !== "number" || district.stabilizingUntilTick <= state.root.tick) return 1;
  const value = Number(context.config.balance.conflict?.captureStabilization?.productionSpeedMultiplier ?? .5);
  return Number.isFinite(value) ? Math.max(.01, value) : 1;
};
import type { Building } from "@empire/shared-types";
import type { CoreGameState } from "../../entities";
import type { GameCoreContext } from "../../engine/context";

import type { CoreGameState } from "../entities";
import type { GameCoreContext } from "../engine/context";
import { resolveRobCooldownTicks } from "../rules/districts/basicActionCooldowns";
import { applyFactionCooldownTicks, getFactionPassiveModifiers } from "../rules/factions/factionRules";
import { applyCarDealerCooldownReductionTicks } from "./carDealerBuildingActions";
import { resolveCityHallNightPatrolPressure } from "./cityHallBuildingActions";

/** Use the same effective duration for departure, reports and recovery cooldown. */
export const resolveRobberyDurationTicks = (
  state: CoreGameState,
  playerId: string,
  targetDistrictId: string,
  context: GameCoreContext
): number => {
  const pressure = resolveCityHallNightPatrolPressure({
    state, context, targetDistrict: state.districtsById[targetDistrictId], tick: state.root.tick
  });
  const logisticsTicks = applyCarDealerCooldownReductionTicks({
    baseTicks: resolveRobCooldownTicks(context.config.balance.conflict), state, playerId,
    config: context.config.balance.carDealer, garageConfig: context.config.balance.garage,
    category: "districtRobbery"
  });
  return Math.max(1, Math.ceil(applyFactionCooldownTicks(
    logisticsTicks, "robbery", getFactionPassiveModifiers(state, playerId, context)
  ) * pressure.cooldownMultiplier));
};

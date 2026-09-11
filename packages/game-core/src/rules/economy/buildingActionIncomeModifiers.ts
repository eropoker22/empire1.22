import type { CoreGameState } from "../../entities";
import type { FixedBuildingIncomeValues } from "./fixedBuildingIncomeValues";

// These bonuses have a building or player scope. Their district effect is a UI marker,
// not another multiplier on every business in the district (including persisted saves).
export const BUILDING_SCOPED_INCOME_ACTIONS = new Set([
  "vip_night", "night_machines", "vip_lounge", "private_party", "backroom_pressure",
  "restaurant_cover_meetings", "restaurant_local_network"
]);

export const applyRestaurantActionIncome = (input: {
  state: CoreGameState;
  building: CoreGameState["buildingsById"][string];
  income: FixedBuildingIncomeValues;
}): FixedBuildingIncomeValues => {
  if (input.building.buildingTypeId !== "restaurant") return input.income;
  const effects = Object.values(input.state.effectStatesById)
    .filter(state => state.ownerType === "district" && state.ownerId === input.building.districtId)
    .flatMap(state => state.effects)
    .filter(effect => effect.effectType === "building_action_effect" && effect.sourceId === input.building.id
      && (effect.expiresAtTick === null || effect.expiresAtTick > input.state.root.tick));
  const active = new Map<string, typeof effects[number]>();
  for (const effect of effects) {
    const actionId = String(effect.payload.actionId || "");
    if (actionId !== "restaurant_cover_meetings" && actionId !== "restaurant_local_network") continue;
    if (!active.has(actionId) || active.get(actionId)!.startedAtTick <= effect.startedAtTick) active.set(actionId, effect);
  }
  const income = { ...input.income };
  for (const effect of active.values()) {
    const modifiers = (effect.payload.effectModifiers ?? effect.payload) as Record<string, unknown>;
    income.cleanPerHour *= Math.max(0, Number(modifiers.cleanIncomeMultiplier ?? 1));
    income.dirtyPerHour *= Math.max(0, Number(modifiers.dirtyIncomeMultiplier ?? 1));
    income.influencePerDay *= Math.max(0, Number(modifiers.influenceMultiplier ?? 1));
    income.heatPerDay *= Math.max(0, Number(modifiers.heatMultiplier ?? 1));
  }
  return income;
};

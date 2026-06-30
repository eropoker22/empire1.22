export interface FixedBuildingIncomeValues {
  cleanPerHour: number;
  dirtyPerHour: number;
  heatPerDay: number;
  influencePerDay: number;
}

export const toIncomeModifierInput = (config: FixedBuildingIncomeValues) => ({
  cleanPerHour: config.cleanPerHour,
  dirtyPerHour: config.dirtyPerHour,
  heatPerDay: config.heatPerDay,
  influencePerDay: config.influencePerDay
});

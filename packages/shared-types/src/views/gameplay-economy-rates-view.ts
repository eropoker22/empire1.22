export interface GameplayPassivePopulationSourceView {
  sourceId: string;
  sourceKind: "district-resource-modifier" | "building-storage";
  districtId: string;
  buildingId: string | null;
  buildingTypeId: string | null;
  target: "player-balance" | "building-storage";
  amountPerTick: number;
  amountPerHour: number;
  playerBalanceAmountPerTick: number;
  storedAmount: number | null;
  capacity: number | null;
  isFull: boolean | null;
  status: "producing" | "initializing" | "capacity-full" | "paused";
}

export interface GameplaySelectedDistrictEconomyRatesView {
  districtId: string;
  cleanCashPerTick: number;
  dirtyCashPerTick: number;
  cleanCashPerHour: number;
  dirtyCashPerHour: number;
  heatPerTick: number;
  influencePerTick: number;
  heatPerHour: number;
  influencePerHour: number;
  passivePopulationSources: GameplayPassivePopulationSourceView[];
  passivePopulationSourceSummary: string;
}

export interface GameplayEconomyRatesView {
  basis: "next-authoritative-economy-tick";
  tickRateMs: number;
  fromTick: number;
  toTick: number;
  playerBalancePerTick: Record<string, number>;
  playerBalancePerHour: Record<string, number>;
  selectedDistrict: GameplaySelectedDistrictEconomyRatesView | null;
}

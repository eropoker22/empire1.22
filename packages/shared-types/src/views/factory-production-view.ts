export type FactoryProductionStatus = "ready" | "processing" | "waiting" | "full" | "over_capacity" | "completed";

export interface FactoryProducedSummaryView {
  resourceKey: "metal-parts" | "tech-core" | "combat-module";
  label: string;
  currentAmount: number;
  capacity: number;
  isFull: boolean;
  isOverCapacity: boolean;
}

export interface FactoryProductionLineView {
  recipeId: "metal-parts" | "tech-core" | "combat-module";
  resourceKey: string;
  label: string;
  producedAmount: number;
  producedCapacity: number;
  queuedAmount: number;
  queueCapacity: number;
  activeAmount: 0 | 1;
  waitingAmount: number;
  unitCleanCashCost: number;
  materialInputCosts: Record<string, number>;
  costDisplayRows: Array<{
    resourceKey: string;
    label: string;
    amount: number;
    availableAmount: number;
  }>;
  baseUnitDurationTicks: number;
  effectiveUnitDurationTicks: number;
  effectiveSpeedMultiplier: number;
  unitsPerHour: number;
  remainingTicks: number;
  remainingMs: number;
  status: FactoryProductionStatus;
  canStart: boolean;
  canCancelWaiting: boolean;
  canCollect: boolean;
  collectDisabledReason: string | null;
  maxStartQuantity: number;
  disabledReason: string | null;
}

export interface FactoryProductionBuildingView {
  buildingId: string;
  districtId: string;
  buildingTypeId: "factory";
  level: number;
  effectiveProductionSpeedMultiplier: number;
  collectableAmount: number;
  canCollect: boolean;
  collectDisabledReason: string | null;
  network: {
    activeFactoryCount: number;
    networkSpeedMultiplier: number;
    levelSpeedMultiplier: number;
    effectiveSpeedMultiplier: number;
  };
  producedSummary: FactoryProducedSummaryView[];
  productionLines: FactoryProductionLineView[];
}

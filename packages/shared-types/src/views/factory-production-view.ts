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
  queuedAmount: number;
  queueCapacity: number;
  activeAmount: 0 | 1;
  waitingAmount: number;
  unitCleanCashCost: number;
  materialInputCosts: Record<string, number>;
  costDisplayRows: Array<{ resourceKey: string; label: string; amount: number }>;
  baseUnitDurationTicks: number;
  effectiveUnitDurationTicks: number;
  remainingTicks: number;
  remainingMs: number;
  status: FactoryProductionStatus;
  canStart: boolean;
  canCancelWaiting: boolean;
  canCollect: boolean;
  maxStartQuantity: number;
  disabledReason: string | null;
}

export interface FactoryProductionBuildingView {
  buildingId: string;
  buildingTypeId: "factory";
  level: number;
  network: {
    activeFactoryCount: number;
    networkSpeedMultiplier: number;
    levelSpeedMultiplier: number;
    effectiveSpeedMultiplier: number;
  };
  producedSummary: FactoryProducedSummaryView[];
  productionLines: FactoryProductionLineView[];
}

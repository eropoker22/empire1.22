export type ArmoryProductionStatus = "ready" | "processing" | "waiting" | "full" | "over_capacity" | "completed";
export type ArmoryProductionCategory = "attack" | "defense";

export interface ArmoryMaterialInputView {
  resourceKey: string;
  label: string;
  requiredAmount: number;
  availableAmount: number;
  requiredPerUnit: number;
  playerStoredAmount: number;
  hasEnough: boolean;
  requiredForSelectedQuantity: number;
}

export interface ArmoryProductionLineView {
  recipeId: string;
  category: ArmoryProductionCategory;
  resourceKey: string;
  label: string;
  producedAmount: number;
  producedCapacity: number;
  playerStoredAmount: number;
  playerStoredCapacity: number;
  queuedAmount: number;
  queueCapacity: number;
  activeAmount: 0 | 1;
  waitingAmount: number;
  materialInputCosts: Record<string, number>;
  inputAvailability: ArmoryMaterialInputView[];
  baseUnitDurationTicks: number;
  effectiveUnitDurationTicks: number;
  remainingTicks: number;
  remainingMs: number;
  status: ArmoryProductionStatus;
  canStart: boolean;
  canCancelWaiting: boolean;
  canCollect: boolean;
  maxStartQuantity: number;
  disabledReason: string | null;
}

export interface ArmoryProductionBuildingView {
  buildingId: string;
  level: number;
  network: {
    activeArmoryCount: number;
    networkSpeedMultiplier: number;
    levelSpeedMultiplier: number;
    effectiveSpeedMultiplier: number;
  };
  categories: Array<{
    id: ArmoryProductionCategory;
    label: string;
    recipeIds: string[];
  }>;
  productionLines: ArmoryProductionLineView[];
}

export type PharmacyProductionStatus = "ready" | "processing" | "waiting" | "full" | "completed";

export interface PharmacyProductionLineView {
  recipeId: "chemicals" | "biomass" | "stim-pack";
  resourceKey: "chemicals" | "biomass" | "stim-pack";
  label: string;
  producedAmount: number;
  producedCapacity: number;
  queuedAmount: number;
  queueCapacity: number;
  activeAmount: 0 | 1;
  waitingAmount: number;
  unitCleanCashCost: number;
  baseUnitDurationTicks: number;
  effectiveUnitDurationTicks: number;
  remainingTicks: number;
  remainingMs: number;
  status: PharmacyProductionStatus;
  canStart: boolean;
  canCancelWaiting: boolean;
  canCollect: boolean;
  maxStartQuantity: number;
  disabledReason: string | null;
}

export interface PharmacyProductionBuildingView {
  buildingId: string;
  lines: PharmacyProductionLineView[];
}

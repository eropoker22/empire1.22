export type DrugLabProductionStatus = "ready" | "processing" | "waiting" | "full" | "completed";

export interface DrugLabMaterialInputView {
  resourceKey: string;
  label: string;
  requiredAmount: number;
  availableAmount: number;
}

export interface DrugLabProductionLineView {
  recipeId: "neon-dust" | "pulse-shot" | "velvet-smoke" | "ghost-serum" | "overdrive-x";
  resourceKey: string;
  label: string;
  description: string;
  itemRole: "trade-material" | "boost-component";
  producedAmount: number;
  producedCapacity: number;
  playerStoredAmount: number;
  playerStoredCapacity: number;
  queuedAmount: number;
  queueCapacity: number;
  activeAmount: 0 | 1;
  waitingAmount: number;
  unitCleanCashCost: number;
  materialInputCosts: Record<string, number>;
  inputAvailability: DrugLabMaterialInputView[];
  baseUnitDurationTicks: number;
  effectiveUnitDurationTicks: number;
  remainingTicks: number;
  remainingMs: number;
  status: DrugLabProductionStatus;
  canStart: boolean;
  canCancelWaiting: boolean;
  canCollect: boolean;
  maxStartQuantity: number;
  disabledReason: string | null;
}

export interface DrugLabProductionBuildingView {
  buildingId: string;
  lines: DrugLabProductionLineView[];
}

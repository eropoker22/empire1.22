export interface DistrictPanelBuildOptionViewModel {
  buildingTypeId: string;
  label: string;
  disabled: boolean;
  disabledReason: string | null;
}

export interface DistrictPanelSlotViewModel {
  slotIndex: number;
  buildingTypeId: string | null;
  title: string;
  statusLabel: string;
  canBuild: boolean;
  summaryLabel: string;
  production: DistrictPanelSlotProductionViewModel | null;
  processing: DistrictPanelSlotProcessingViewModel | null;
  craftOptions: DistrictPanelSlotCraftViewModel[];
  buildOptions: DistrictPanelBuildOptionViewModel[];
}

export interface DistrictPanelSlotProductionViewModel {
  buildingId: string;
  resourceLabel: string;
  storageLabel: string;
  storagePercent: number;
  playerStockLabel: string;
  rateLabel: string;
  canCollect: boolean;
  collectDisabledReason: string | null;
}

export interface DistrictPanelSlotProcessingViewModel {
  label: string;
  progressLabel: string;
  completionLabel: string;
  outputLabel: string;
}

export interface DistrictPanelSlotCraftViewModel {
  buildingId: string;
  recipeId: string;
  label: string;
  inputSummary: string;
  outputAmount: number;
  outputResourceLabel: string;
  playerStockLabel: string;
  canCraft: boolean;
  disabledReason: string | null;
}

export interface DistrictPanelBuildingActionViewModel {
  actionId: string;
  label: string;
  description: string;
  statusLabel: string;
  inputSummary: string;
  outputSummary: string;
  baseInputCost: Record<string, number>;
  effectiveInputCost: Record<string, number>;
  baseOutputGain: Record<string, number>;
  effectiveOutputGain: Record<string, number>;
  baseHeatGain: number;
  effectiveHeatGain: number;
  baseCooldownMs: number;
  effectiveCooldownMs: number;
  baseDurationMs: number;
  effectiveDurationMs: number;
  expectedEffectSummary: string[];
  riskSummary: string[];
  inputs: DistrictPanelBuildingActionInputViewModel[];
  cooldownLabel: string;
  cooldownRemainingMs: number;
  cooldownEndsAtMs: number | null;
  heatLabel: string;
  influenceLabel: string;
  disabled: boolean;
  disabledReason: string | null;
  phaseAvailability: "available" | "blocked" | "buffed" | "penalized" | "neutral";
  phaseBadgeLabel: string | null;
  phaseTooltip: string | null;
  blockedReason: string | null;
  preferredPhase: "day" | "night" | null;
  currentPhase: "day" | "night" | null;
  phaseEffectSummary: string[];
  phaseEffectLabel: string | null;
}

export interface DistrictPanelBuildingActionInputViewModel {
  id: string;
  type: "number" | "select" | "text";
  label: string;
  required: boolean;
  min?: number;
  max?: number;
  options: Array<{
    value: string;
    label: string;
  }>;
}

export interface DistrictPanelBuildingViewModel {
  buildingId: string;
  buildingTypeId: string;
  label: string;
  variantName: string | null;
  typeLabel: string;
  zoneLabel: string;
  roleLabel: string;
  info: string;
  statusLabel: string;
  summaryLabel: string;
  stats: DistrictPanelBuildingStatViewModel[];
  specialActions: DistrictPanelBuildingSpecialActionViewModel[];
  actions: DistrictPanelBuildingActionViewModel[];
  productionLines: DistrictPanelBuildingProductionLineViewModel[];
  phaseAvailability: "available" | "blocked" | "buffed" | "penalized" | "neutral";
  phaseBadgeLabel: string | null;
  phaseTooltip: string | null;
  passivePhaseBadgeLabel: string | null;
  passivePhaseEffectLabel: string | null;
  passivePhaseTooltip: string | null;
}

export interface DistrictPanelBuildingProductionLineViewModel {
  recipeId: string;
  label: string;
  statusLabel: string;
  inputSummary: string;
  durationLabel: string;
  canStart: boolean;
  disabledReason: string | null;
}

export interface DistrictPanelBuildingStatViewModel {
  label: string;
  value: string;
}

export interface DistrictPanelBuildingSpecialActionViewModel {
  actionId: string;
  label: string;
  description: string;
  effectSummary: string;
  durationLabel: string;
  cooldownLabel: string;
  cooldownRemainingMs: number;
  cooldownEndsAtMs: number | null;
  heatLabel: string;
  baseInputCost: Record<string, number>;
  effectiveInputCost: Record<string, number>;
  baseOutputGain: Record<string, number>;
  effectiveOutputGain: Record<string, number>;
  baseHeatGain: number;
  effectiveHeatGain: number;
  baseCooldownMs: number;
  effectiveCooldownMs: number;
  baseDurationMs: number;
  effectiveDurationMs: number;
  inputSummary: string;
  outputSummary: string;
  disabled: boolean;
  disabledReason: string | null;
  phaseAvailability: "available" | "blocked" | "buffed" | "penalized" | "neutral";
  phaseBadgeLabel: string | null;
  phaseTooltip: string | null;
  blockedReason: string | null;
  preferredPhase: "day" | "night" | null;
  currentPhase: "day" | "night" | null;
  phaseEffectSummary: string[];
  phaseEffectLabel: string | null;
}

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
  disabled: boolean;
  disabledReason: string | null;
}

export interface DistrictPanelAttackTargetViewModel {
  districtId: string;
  label: string;
  ownerLabel: string;
  statusLabel: string;
  disabled: boolean;
  disabledReason: string | null;
}

export interface DistrictPanelSpyTargetViewModel {
  districtId: string;
  label: string;
  ownerLabel: string;
  statusLabel: string;
  disabled: boolean;
  disabledReason: string | null;
}

export interface DistrictPanelOccupyTargetViewModel {
  districtId: string;
  label: string;
  statusLabel: string;
  disabled: boolean;
  disabledReason: string | null;
  disabledCode: string | null;
  influenceCostLabel: string;
  heatGainLabel: string;
  cooldownLabel: string | null;
}

export interface DistrictPanelTrapViewModel {
  actionLabel: string;
  activeLabel: string | null;
  disabled: boolean;
  disabledReason: string | null;
}

export interface DistrictPanelViewModel {
  districtId: string;
  selectedBuildingId: string | null;
  title: string;
  ownershipLabel: string;
  zoneLabel: string;
  statusLabel: string;
  heatLabel: string;
  influenceLabel: string;
  buildingSummary: string;
  attackSummary: string;
  hasPendingCommand: boolean;
  trap: DistrictPanelTrapViewModel | null;
  spyTargets: DistrictPanelSpyTargetViewModel[];
  occupyTargets: DistrictPanelOccupyTargetViewModel[];
  attackTargets: DistrictPanelAttackTargetViewModel[];
  buildings: DistrictPanelBuildingViewModel[];
  slots: DistrictPanelSlotViewModel[];
}

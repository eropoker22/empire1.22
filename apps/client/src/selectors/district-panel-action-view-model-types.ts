export interface DistrictPanelAttackTargetViewModel {
  districtId: string;
  label: string;
  ownerLabel: string;
  statusLabel: string;
  disabled: boolean;
  disabledReason: string | null;
  cooldownLabel: string | null;
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

export interface DistrictPanelRobTargetViewModel {
  districtId: string;
  label: string;
  statusLabel: string;
  disabled: boolean;
  disabledReason: string | null;
  cooldownLabel: string | null;
}

export interface DistrictPanelHeistTargetViewModel {
  districtId: string;
  label: string;
  ownerLabel: string;
  statusLabel: string;
  disabled: boolean;
  disabledReason: string | null;
  cooldownLabel: string | null;
}

export interface DistrictPanelDefenseActionViewModel {
  actionLabel: string;
  disabled: boolean;
  disabledReason: string | null;
}

export interface DistrictPanelTrapViewModel {
  actionLabel: string;
  activeLabel: string | null;
  disabled: boolean;
  disabledReason: string | null;
}

import type { BuildingActionBalanceConfig } from "../contracts";
export type CityHallDecreeMode = "night_patrols" | "suspended_checks" | "construction_closure";

interface CityHallRiskEvent {
  actionId: string;
  riskPct: number;
  expiresAtTick: number;
  tick: number;
}

export interface CityHallScandalEvent {
  type: string;
  tick: number;
  label: string;
  riskPct: number;
  rumorText?: string;
}

export interface CityHallMetadata {
  officialCoverByDistrictId: Record<string, { districtId: string; expiresAtTick: number; heatGainReductionPct: number; policeControlChanceReductionPct: number; rumorChanceReductionPct: number }>;
  emergencyDecree?: { modeId: CityHallDecreeMode; zone?: string; expiresAtTick: number };
  influencePenaltyUntilTick?: number;
  cityContractBlockedUntilTick?: number;
  lastScandalCheckTick?: number;
  riskEvents: CityHallRiskEvent[];
  scandalEvents: CityHallScandalEvent[];
}

export interface CityHallActionResolution {
  balances: Record<string, number>;
  buildingMetadata: Record<string, unknown>;
  heatGain: number;
  influenceChange: number;
  outputGain: Record<string, number>;
  inputCost: Record<string, number>;
  effectModifiers?: BuildingActionBalanceConfig["effectModifiers"];
  reportText: string;
  cityHallResult: Record<string, unknown>;
}

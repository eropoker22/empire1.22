import type { BuildingStatus } from "../entities/building";
import type { DistrictStatus } from "../entities/district";
import type {
  BuildingId,
  DistrictId,
  PlayerId
} from "../ids/entity-id";

/**
 * Responsibility: Server-fed district panel projection for fixed district buildings.
 * Belongs here: ownership, fixed buildings, actions, cooldowns, and district action targets.
 * Does not belong here: authoritative validation or hidden server state.
 */
export interface DistrictBuildOptionView {
  buildingTypeId: string;
  label: string;
  enabled: boolean;
  disabledReason: string | null;
}

export interface DistrictPanelSlotView {
  slotIndex: number;
  buildingId: BuildingId | null;
  buildingTypeId: string | null;
  status: BuildingStatus | "empty";
  canBuild: boolean;
  production: DistrictPanelSlotProductionView | null;
  processing: DistrictPanelSlotProcessingView | null;
  craftOptions: DistrictPanelSlotCraftView[];
  /**
   * @deprecated Main gameplay no longer presents build slots. Kept only so older
   * projection consumers can deserialize the shape while fixed-building flows migrate.
   */
  buildOptions: DistrictBuildOptionView[];
}

export interface DistrictPanelSlotProductionView {
  resourceKey: string;
  resourceLabel: string;
  storedAmount: number;
  storageCap: number;
  amountPerTick: number;
  canCollect: boolean;
  collectDisabledReason: string | null;
}

export interface DistrictPanelSlotProcessingView {
  recipeId: string;
  label: string;
  remainingTicks: number;
  totalTicks: number;
  outputResourceKey: string;
  outputResourceLabel: string;
  outputAmount: number;
}

export interface DistrictPanelSlotCraftView {
  recipeId: string;
  label: string;
  inputSummary: string;
  outputResourceKey: string;
  outputResourceLabel: string;
  outputAmount: number;
  canCraft: boolean;
  craftDisabledReason: string | null;
}

export interface DistrictPanelBuildingActionView {
  actionId: string;
  label: string;
  description: string;
  durationMs: number;
  cooldownMs: number;
  cooldownRemainingTicks: number;
  inputCost: Record<string, number>;
  outputGain: Record<string, number>;
  heatGain: number;
  influenceChange: number;
  reportText: string;
  enabled: boolean;
  disabledReason: string | null;
}

export interface DistrictPanelBuildingStatView {
  label: string;
  value: string;
}

export interface DistrictPanelBuildingSpecialActionView {
  actionId: string;
  label: string;
  description: string;
  effectSummary: string;
  durationMs: number;
  cooldownMs: number;
  cooldownRemainingTicks: number;
  heatGain: number;
  enabled: boolean;
  disabledReason: string | null;
}

export interface DistrictPanelBuildingView {
  buildingId: BuildingId;
  buildingTypeId: string;
  label: string;
  displayName: string;
  variantName: string | null;
  zone: string;
  role: string;
  info: string;
  stats: DistrictPanelBuildingStatView[];
  specialActions: DistrictPanelBuildingSpecialActionView[];
  level: number;
  status: BuildingStatus;
  actionCooldowns: Record<string, number>;
  actions: DistrictPanelBuildingActionView[];
}

export interface DistrictAttackTargetView {
  districtId: DistrictId;
  name: string;
  ownerPlayerId: PlayerId | null;
  status: DistrictStatus;
  enabled: boolean;
  disabledReason: string | null;
}

export interface DistrictSpyTargetView {
  districtId: DistrictId;
  name: string;
  ownerPlayerId: PlayerId | null;
  status: DistrictStatus;
  enabled: boolean;
  disabledReason: string | null;
}

export interface DistrictTrapView {
  enabled: boolean;
  disabledReason: string | null;
  activeTrap: {
    trapId: string;
    label: string;
    placedAtTick: number;
  } | null;
}

export interface DistrictPanelView {
  districtId: DistrictId;
  name: string;
  zone: string;
  status: DistrictStatus;
  ownerPlayerId: PlayerId | null;
  isOwnedByPlayer: boolean;
  heat: number;
  influence: number;
  slotCount: number;
  filledSlotCount: number;
  buildings: DistrictPanelBuildingView[];
  slots: DistrictPanelSlotView[];
  attackTargets: DistrictAttackTargetView[];
  spyTargets: DistrictSpyTargetView[];
  trap: DistrictTrapView | null;
}

import type { BuildingStatus } from "../entities/building";
import type { DistrictStatus } from "../entities/district";
import type {
  BuildingId,
  DistrictId,
  PlayerId
} from "../ids/entity-id";
import type { DistrictCapabilitiesView } from "./map-capabilities-view";
import type { WarehouseUpgradePreviewView } from "./warehouse-storage-view"; import type { PharmacyProductionBuildingView } from "./pharmacy-production-view";
import type { FactoryProductionBuildingView } from "./factory-production-view";
import type { DrugLabProductionBuildingView } from "./drug-lab-production-view";
import type { ArmoryProductionBuildingView } from "./armory-production-view";
/** Server-fed district panel projection for fixed district buildings. */
export interface DistrictBuildOptionView {
  buildingTypeId: string;
  label: string;
  enabled: boolean;
  disabledCode?: string | null;
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

export type BuildingActionStatus = "available" | "cooldown" | "missing_cost" | "blocked" | "planned";
export type BuildingActionPhaseAvailability = "available" | "blocked" | "buffed" | "penalized" | "neutral";

export interface BuildingActionInputOptionView {
  value: string;
  label: string;
}

export interface BuildingActionInputView {
  id: string;
  type: "number" | "select" | "text";
  label: string;
  required: boolean;
  min?: number;
  max?: number;
  options?: BuildingActionInputOptionView[];
}

export interface BuildingActionView {
  buildingId: BuildingId;
  buildingTypeId: string;
  actionId: string;
  label: string;
  description: string;
  status: BuildingActionStatus;
  disabledReason: string | null;
  cooldownRemainingTicks: number | null;
  cost: Record<string, number>;
  expectedEffectSummary: string[];
  riskSummary: string[];
  requiresInput: BuildingActionInputView[];
  durationMs: number;
  cooldownMs: number;
  inputCost: Record<string, number>;
  outputGain: Record<string, number>;
  heatGain: number;
  baseInputCost?: Record<string, number>;
  effectiveInputCost?: Record<string, number>;
  baseOutputGain?: Record<string, number>;
  effectiveOutputGain?: Record<string, number>;
  baseHeatGain?: number;
  effectiveHeatGain?: number;
  baseCooldownMs?: number;
  effectiveCooldownMs?: number;
  baseDurationMs?: number;
  effectiveDurationMs?: number;
  influenceChange: number;
  reportText: string;
  enabled: boolean;
  phaseAvailability?: BuildingActionPhaseAvailability;
  phaseBadgeLabel?: string | null;
  phaseTooltip?: string | null;
  phaseBlockedReason?: string | null;
  blockedReason?: string | null;
  preferredPhase?: "day" | "night" | null;
  currentPhase?: "day" | "night" | null;
  phaseEffectSummary?: string[];
}

export type DistrictPanelBuildingActionView = BuildingActionView;

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
  baseInputCost?: Record<string, number>;
  effectiveInputCost?: Record<string, number>;
  baseOutputGain?: Record<string, number>;
  effectiveOutputGain?: Record<string, number>;
  baseHeatGain?: number;
  effectiveHeatGain?: number;
  baseCooldownMs?: number;
  effectiveCooldownMs?: number;
  baseDurationMs?: number;
  effectiveDurationMs?: number;
  enabled: boolean;
  disabledCode?: string | null;
  disabledReason: string | null;
  phaseAvailability?: BuildingActionPhaseAvailability;
  phaseBadgeLabel?: string | null;
  phaseTooltip?: string | null;
  phaseBlockedReason?: string | null;
  blockedReason?: string | null;
  preferredPhase?: "day" | "night" | null;
  currentPhase?: "day" | "night" | null;
  phaseEffectSummary?: string[];
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
  warehouseUpgradePreview?: WarehouseUpgradePreviewView | null;
  pharmacy?: PharmacyProductionBuildingView | null; drugLab?: DrugLabProductionBuildingView | null;
  factory?: FactoryProductionBuildingView | null; armory?: ArmoryProductionBuildingView | null;
  phaseAvailability?: BuildingActionPhaseAvailability;
  phaseBadgeLabel?: string | null;
  phaseTooltip?: string | null;
  phaseBlockedReason?: string | null;
  passivePhaseBadgeLabel?: string | null;
  passivePhaseEffectLabel?: string | null;
  passivePhaseTooltip?: string | null;
}
export interface DistrictAttackTargetView {
  districtId: DistrictId;
  name: string;
  ownerPlayerId: PlayerId | null;
  status: DistrictStatus;
  enabled: boolean;
  disabledReason: string | null;
  cooldownRemainingTicks?: number;
  globalCooldownRemainingTicks?: number;
  sourceCooldownRemainingTicks?: number;
  targetProtectionRemainingTicks?: number;
  expectedSourceVersion?: number;
  expectedTargetVersion?: number;
  expectedConflictRevision: number;
  targetSecurityRevision?: number;
  spyAuthorizationValid?: boolean;
  selectedLoadout?: Record<string, number>;
  projectedPopulationCost?: number;
  catastrophePreview?: {
    baseChance: number;
    bazookaBonus: number;
    finalChance: number;
  };
  sourceStabilizingUntilTick?: number | null;
  majorOffenseCooldownEndsAtTick?: number | null;
  sourceConflictLockEndsAtTick?: number | null;
}
export interface DistrictSpyTargetView {
  districtId: DistrictId;
  name: string;
  ownerPlayerId: PlayerId | null;
  status: DistrictStatus;
  enabled: boolean;
  disabledReason: string | null;
  targetSecurityRevision?: number;
  authorizationTtlTicks?: number;
  slots?: Array<{
    slotId: "spy-1" | "spy-2";
    availableAtTick: number;
    available: boolean;
    lastMissionId: string | null;
  }>;
}

export interface DistrictOccupyTargetView {
  districtId: DistrictId;
  name: string;
  ownerPlayerId: PlayerId | null;
  status: DistrictStatus;
  enabled: boolean;
  disabledCode: string | null;
  disabledReason: string | null;
  cost: {
    influence: number;
    population: number;
  };
  heatGain: number;
  cooldownRemainingTicks: number;
  globalCooldownRemainingTicks?: number;
  sourceCooldownRemainingTicks?: number;
  expectedConflictRevision: number;
  majorOffenseCooldownEndsAtTick?: number | null;
  sourceConflictLockEndsAtTick?: number | null;
  stabilizingDurationTicks?: number;
}

export interface DistrictRobTargetView {
  districtId: DistrictId;
  name: string;
  ownerPlayerId: PlayerId | null;
  status: DistrictStatus;
  enabled: boolean;
  disabledCode: string | null;
  disabledReason: string | null;
  cooldownRemainingTicks?: number;
  expectedTargetVersion: number;
  expectedSourceVersion: number;
  expectedConflictRevision: number;
  expectedLootPoolRevision: number;
  lootPoolLevel?: "rich" | "partial" | "low" | "exhausted";
  exhausted?: boolean;
  heatRisk?: { minimum: number; maximum: number };
}

export interface DistrictHeistTargetView {
  districtId: DistrictId;
  name: string;
  ownerPlayerId: PlayerId | null;
  status: DistrictStatus;
  enabled: boolean;
  disabledCode: string | null;
  disabledReason: string | null;
  cooldownRemainingTicks?: number;
  expectedTargetVersion: number;
  expectedSourceVersion: number;
  expectedConflictRevision: number;
  styles: Array<{
    style: "stealth" | "balanced" | "all_in";
    label: string;
    defaultGangMembersSent: number;
    minMembers?: number;
    maxMembers?: number;
    successChance?: number;
    detectionChance?: number;
    lossRisk?: "low" | "medium" | "high" | "extreme";
    heatOnSuccess?: number;
    heatOnDetected?: number;
  }>;
  victimProtectionRemainingTicks?: number;
  majorOffenseCooldownEndsAtTick?: number | null;
  sourceConflictLockEndsAtTick?: number | null;
}

export interface DistrictDefenseActionView {
  enabled: boolean;
  disabledCode: string | null;
  disabledReason: string | null;
  expectedTargetVersion: number;
  usedCapacityPoints: number;
  maxCapacityPoints: number;
  ownerOwnedAmounts: Record<string, number>;
  alliedContributionAmounts: Record<string, number>;
  playerRemovableAmounts: Record<string, number>;
}

export interface DistrictTrapView {
  enabled: boolean;
  disabledReason: string | null;
  activeTrap: {
    trapId: string;
    label: string;
    placedAtTick: number;
  } | null;
  relocationCooldownRemainingTicks?: number;
  relocationSource?: {
    trapId: string;
    districtId: DistrictId;
    expectedSourceVersion: number;
    expectedTargetVersion: number;
    expectedTrapVersion: number;
    canRelocate: boolean;
    disabledReason: string | null;
  } | null;
  relocationTargets?: Array<{
    districtId: DistrictId;
    name: string;
    expectedVersion: number;
    canRelocate: boolean;
    disabledReason: string | null;
  }>;
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
  securityRevision?: number;
  conflictRevision: number;
  stabilizingUntilTick?: number | null;
  slotCount: number;
  filledSlotCount: number;
  buildings: DistrictPanelBuildingView[];
  slots: DistrictPanelSlotView[];
  attackTargets: DistrictAttackTargetView[];
  spyTargets: DistrictSpyTargetView[];
  occupyTargets: DistrictOccupyTargetView[];
  robTargets?: DistrictRobTargetView[];
  heistTargets?: DistrictHeistTargetView[];
  placeDefense?: DistrictDefenseActionView | null;
  removeDefense?: DistrictDefenseActionView | null;
  trap: DistrictTrapView | null;
  capabilities?: DistrictCapabilitiesView;
}

import type { DistrictStatus } from "../entities/district";
import type { DefenseWeaponId } from "../entities/weapon";
import type { DistrictId, PlayerId } from "../ids/entity-id";

export interface DistrictAttackTargetView {
  sourceDistrictId: DistrictId;
  districtId: DistrictId;
  name: string;
  ownerPlayerId: PlayerId | null;
  status: DistrictStatus;
  enabled: boolean;
  disabledCode?: string | null;
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
  sourceDistrictId: DistrictId;
  districtId: DistrictId;
  name: string;
  ownerPlayerId: PlayerId | null;
  status: DistrictStatus;
  enabled: boolean;
  disabledCode?: string | null;
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
  sourceDistrictId: DistrictId;
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
  sourceDistrictId: DistrictId;
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
  sourceDistrictId: DistrictId;
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
  recommendedStyle?: "stealth" | "balanced" | "all_in" | null;
  availablePopulation?: number;
  styles: Array<{
    style: "stealth" | "balanced" | "all_in";
    label: string;
    enabled?: boolean;
    defaultPopulationSent: number;
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
  preferredItemId: DefenseWeaponId | null;
  preferredAmount: number;
  usedCapacityPoints: number;
  maxCapacityPoints: number;
  availableInventoryAmounts: Record<string, number>;
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

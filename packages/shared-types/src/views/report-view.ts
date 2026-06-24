import type { DefenseWeaponId } from "../entities/weapon";
import type { AttackWeaponId } from "../entities/weapon";
import type {
  DistrictId,
  EventId,
  PlayerId
} from "../ids/entity-id";

/**
 * Responsibility: Server-fed historical report views safe to render on the client.
 * Belongs here: spy and battle report projection contracts.
 * Does not belong here: hidden write-model state or client-only UI state.
 */
export interface SpyReport {
  reportId: string;
  reportType: "spy";
  actionType: "spy-district";
  playerId: PlayerId;
  attackerPlayerId: PlayerId;
  sourceDistrictId: DistrictId;
  targetDistrictId: DistrictId;
  result: "success" | "partial" | "failed" | "critical_failed";
  detectedDefense: Partial<Record<DefenseWeaponId, number>>;
  trapDetected: boolean;
  occupyUnlocked: boolean;
  revealedType: boolean;
  revealedDefense: boolean;
  heatGained: number;
  blockedUntilTick: number | null;
  tick: number;
  createdAt: string;
  eventId: EventId | null;
}

export interface BattleReport {
  reportId: string;
  reportType: "battle";
  actionType: "attack-district";
  playerId: PlayerId;
  attackerPlayerId: PlayerId;
  defenderPlayerId: PlayerId | null;
  sourceDistrictId: DistrictId;
  targetDistrictId: DistrictId;
  result: "success" | "failure" | "blocked" | "catastrophe";
  outcomeTier: "clean_capture" | "costly_capture" | "failed_raid" | "disaster";
  districtCaptured: boolean;
  districtDestroyed: boolean;
  districtDamaged: boolean;
  trapTriggered: boolean;
  attackerLosses: Partial<Record<AttackWeaponId, number>>;
  defenderLosses: Partial<Record<DefenseWeaponId, number>>;
  detectedDefense: Partial<Record<DefenseWeaponId, number>>;
  heatGained: number;
  reportForAttacker: string;
  reportForDefender: string;
  attackDurationTicks: number;
  tick: number;
  createdAt: string;
  eventId: EventId | null;
}

export interface OccupyReport {
  reportId: string;
  reportType: "occupy";
  actionType: "occupy-district";
  playerId: PlayerId;
  sourceDistrictId: DistrictId;
  targetDistrictId: DistrictId;
  result: "success";
  previousOwnerPlayerId: PlayerId | null;
  heatGained: number;
  influenceCost: number;
  cooldownTicks: number;
  tick: number;
  createdAt: string;
  eventId: EventId | null;
}

export interface BuildingActionReport {
  reportId: string;
  reportType: "building-action";
  actionType: "run-building-action";
  playerId: PlayerId;
  districtId: DistrictId;
  buildingId: string;
  buildingTypeId: string;
  buildingType?: string;
  buildingActionId: string;
  actionId?: string;
  result: "success";
  success?: boolean;
  inputCost: Record<string, number>;
  outputGain: Record<string, number>;
  resourceDelta?: Record<string, number>;
  cashDelta?: number;
  dirtyCashDelta?: number;
  heatDelta?: number;
  influenceDelta?: number;
  producedItems?: Record<string, number>;
  consumedItems?: Record<string, number>;
  cooldownUntilTick?: number;
  message?: string;
  policeImpact?: Record<string, unknown>;
  defenseAdded?: Partial<Record<DefenseWeaponId, number>>;
  intelRevealedDistrictIds?: DistrictId[];
  intelDetectedDefense?: Record<DistrictId, Partial<Record<DefenseWeaponId, number>>>;
  messages?: string[];
  casinoResult?: Record<string, unknown>;
  exchangeResult?: Record<string, unknown>;
  arcadeResult?: Record<string, unknown>;
  apartmentResult?: Record<string, unknown>;
  clinicResult?: Record<string, unknown>;
  recyclingResult?: Record<string, unknown>;
  stripClubResult?: Record<string, unknown>;
  powerStationResult?: Record<string, unknown>;
  smugglingTunnelResult?: Record<string, unknown>;
  airportResult?: Record<string, unknown>;
  cityHallResult?: Record<string, unknown>;
  centralBankResult?: Record<string, unknown>;
  lobbyClubResult?: Record<string, unknown>;
  schoolResult?: Record<string, unknown>;
  streetDealerResult?: Record<string, unknown>;
  stockExchangeResult?: Record<string, unknown>;
  heatGain: number;
  influenceChange: number;
  tick: number;
  createdAt: string;
  eventId: EventId | null;
}

export type ConflictReportView = SpyReport | BattleReport | OccupyReport | BuildingActionReport;

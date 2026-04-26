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
  result: "success" | "failure";
  detectedDefense: Partial<Record<DefenseWeaponId, number>>;
  trapDetected: boolean;
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
  districtCaptured: boolean;
  districtDestroyed: boolean;
  trapTriggered: boolean;
  attackerLosses: Partial<Record<AttackWeaponId, number>>;
  detectedDefense: Partial<Record<DefenseWeaponId, number>>;
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
  buildingActionId: string;
  result: "success";
  inputCost: Record<string, number>;
  outputGain: Record<string, number>;
  defenseAdded?: Partial<Record<DefenseWeaponId, number>>;
  intelRevealedDistrictIds?: DistrictId[];
  intelDetectedDefense?: Record<DistrictId, Partial<Record<DefenseWeaponId, number>>>;
  messages?: string[];
  heatGain: number;
  influenceChange: number;
  tick: number;
  createdAt: string;
  eventId: EventId | null;
}

export type ConflictReportView = SpyReport | BattleReport | BuildingActionReport;

import type {
  AttackDistrictCommand,
  HeistDistrictCommand,
  RobDistrictCommand,
  SpyDistrictCommand
} from "../commands";
import type { DistrictId, PlayerId } from "../ids/entity-id";
import type { DistrictOperationType } from "./district";
import type { PlayerBoostId } from "./player-boost-state";
import type { AttackWeaponId } from "./weapon";

export type PendingDistrictActionCommand =
  | AttackDistrictCommand
  | HeistDistrictCommand
  | RobDistrictCommand
  | SpyDistrictCommand;

export interface PendingSpyBoostSnapshot {
  boostId: PlayerBoostId | null;
  spyDurationMultiplier: number;
  criticalFailureChanceMultiplier: number;
  extraIntelBlocksOnSuccess: number;
}

export interface PendingDistrictActionOperation {
  id: string;
  operationType: Exclude<DistrictOperationType, "occupy">;
  command: PendingDistrictActionCommand;
  playerId: PlayerId;
  sourceDistrictId: DistrictId;
  targetDistrictId: DistrictId;
  /** Owner observed when the order was accepted; null means the target was neutral. */
  targetOwnerPlayerId?: PlayerId | null;
  issuedAtTick: number;
  resolveAtTick: number;
  cooldownKeys: string[];
  reservedAttackLoadout?: Partial<Record<AttackWeaponId, number>>;
  reservedPopulation?: number;
  spySlotId?: string;
  spyBoostSnapshot?: PendingSpyBoostSnapshot;
  version: number;
}

import type {
  AttackDistrictCommand,
  HeistDistrictCommand,
  RobDistrictCommand,
  SpyDistrictCommand
} from "../commands";
import type { DistrictId, PlayerId } from "../ids/entity-id";
import type { DistrictOperationType } from "./district";

export type PendingDistrictActionCommand =
  | AttackDistrictCommand
  | HeistDistrictCommand
  | RobDistrictCommand
  | SpyDistrictCommand;

export interface PendingDistrictActionOperation {
  id: string;
  operationType: Exclude<DistrictOperationType, "occupy">;
  command: PendingDistrictActionCommand;
  playerId: PlayerId;
  sourceDistrictId: DistrictId;
  targetDistrictId: DistrictId;
  issuedAtTick: number;
  resolveAtTick: number;
  cooldownKeys: string[];
  spySlotId?: string;
  version: number;
}

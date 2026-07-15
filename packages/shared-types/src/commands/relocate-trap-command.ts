import type { DistrictId, TrapId } from "../ids/entity-id";
import type { ActionCommand } from "./action-command";

export interface RelocateTrapPayload {
  trapId: TrapId;
  sourceDistrictId: DistrictId;
  targetDistrictId: DistrictId;
  expectedSourceVersion: number;
  expectedTargetVersion: number;
  expectedTrapVersion: number;
}

export type RelocateTrapCommand = ActionCommand<"relocate-trap", RelocateTrapPayload>;

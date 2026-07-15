import type { PlayerId } from "../ids/entity-id";

export interface PlayerSpyOperationSlot {
  slotId: "spy-1" | "spy-2";
  availableAtTick: number;
  lastMissionId: string | null;
}

export interface PlayerSpyOperationState {
  playerId: PlayerId;
  version: number;
  slots: [PlayerSpyOperationSlot, PlayerSpyOperationSlot];
}

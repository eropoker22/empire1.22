import type { ActionCommand } from "./action-command";

export interface AcknowledgePendingRaidPayload {
  raidId: string;
}

export type AcknowledgePendingRaidCommand = ActionCommand<"acknowledge-pending-raid", AcknowledgePendingRaidPayload>;

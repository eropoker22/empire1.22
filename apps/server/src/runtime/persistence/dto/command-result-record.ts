import type { DomainError, GameCommand, ServerInstanceId } from "@empire/shared-types";

export type CommandResultStatus = "applied" | "rejected";

export interface CommandResultRecord {
  serverInstanceId: ServerInstanceId;
  commandId: string;
  commandType: string;
  playerId: string;
  status: CommandResultStatus;
  payloadHash: string;
  command: GameCommand;
  rootVersionBefore: number;
  rootVersionAfter: number | null;
  eventCount: number;
  eventIds: string[];
  snapshotId: string | null;
  snapshotVersion: number | null;
  responseErrors: DomainError[];
  createdAt: string;
  appliedAt: string | null;
  rejectedAt: string | null;
}


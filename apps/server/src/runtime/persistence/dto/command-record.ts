import type { GameCommand, ServerInstanceId } from "@empire/shared-types";

/**
 * Responsibility: Persistent audit record for one received authoritative command.
 * Belongs here: who sent the command, when it arrived, and routing metadata.
 * Does not belong here: derived UI notifications or diagnostic-only logger noise.
 */
export interface CommandRecord {
  id: string;
  instanceId: ServerInstanceId;
  command: GameCommand;
  receivedAt: string;
  actorId: string;
  correlationId: string | null;
  tickAtReceive: number;
}


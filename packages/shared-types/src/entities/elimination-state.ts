import type { PlayerId, ServerInstanceId } from "../ids/entity-id";

/**
 * Responsibility: Server-authoritative pacing state for scheduled player eliminations.
 * Belongs here: idempotency markers, eliminated players, and last public reason.
 * Does not belong here: score calculation or UI danger-zone formatting.
 */
export interface EliminationState {
  id: string;
  serverInstanceId: ServerInstanceId;
  lastEliminationTick: number | null;
  nextEliminationTick: number | null;
  eliminationCount: number;
  eliminatedPlayerIds: PlayerId[];
  lastEliminatedPlayerId: PlayerId | null;
  lastEliminationReason: string | null;
  version: number;
}

import type { ServerInstanceId } from "../ids/entity-id";

/**
 * Responsibility: Frozen per-server pacing derived when hosted registration closes.
 * Belongs here: registration window metadata and authoritative effective lifecycle thresholds.
 * Does not belong here: registration commands, lobby membership, or mode balance defaults.
 */
export interface ServerPacingState {
  id: string;
  serverInstanceId: ServerInstanceId;
  registrationOpensAt: string | null;
  registrationClosesAt: string | null;
  registrationClosedAt: string | null;
  registrationBaselinePlayers: number | null;
  eliminationEnabled: boolean;
  effectiveFinalLockdownTrigger: number | null;
  effectiveFirstEliminationTick: number | null;
  version: number;
}

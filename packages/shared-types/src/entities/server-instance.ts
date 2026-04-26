import type { ServerInstanceId } from "../ids/entity-id";
import type { GameModeId } from "../ids/game-mode-id";

/**
 * Responsibility: Metadata for one multiplayer game server instance.
 * Belongs here: mode, lifecycle, world seed, and tick reference fields.
 * Does not belong here: runtime queues, scheduler handles, or connection maps.
 */
export interface ServerInstance {
  id: ServerInstanceId;
  mode: GameModeId;
  configKey: string;
  status: ServerInstanceStatus;
  startedAt: string;
  endedAt: string | null;
  worldSeed: string;
  currentTick: number;
  gameStateId: string;
  version: number;
}

export type ServerInstanceStatus =
  | "pending"
  | "running"
  | "paused"
  | "ended"
  | "maintenance";


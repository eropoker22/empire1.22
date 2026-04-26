import type {
  AllianceId,
  DistrictId,
  EventId,
  NotificationId,
  PlayerId,
  ServerInstanceId,
  TrapId
} from "../ids/entity-id";
import type { GameLifecyclePhase } from "./game-lifecycle-phase";

/**
 * Responsibility: Root state summary for one authoritative game instance.
 * Belongs here: root references, tick, phase, and aggregate-level pointers.
 * Does not belong here: full normalized entity maps or runtime dirty tracking.
 */
export interface GameStateRoot {
  id: string;
  serverInstanceId: ServerInstanceId;
  tick: number;
  phase: GameLifecyclePhase;
  playerIds: PlayerId[];
  allianceIds: AllianceId[];
  districtIds: DistrictId[];
  eventIds: EventId[];
  trapIds: TrapId[];
  notificationIds: NotificationId[];
  victoryStateId: string | null;
  matchResultId: string | null;
  version: number;
}

import type {
  Alliance
} from "../entities/alliance";
import type { Building } from "../entities/building";
import type { District } from "../entities/district";
import type { EventState } from "../entities/event-state";
import type { Notification } from "../entities/notification";
import type { Player } from "../entities/player";
import type { ServerInstance } from "../entities/server-instance";
import type { VictoryState } from "../entities/victory-state";

/**
 * Responsibility: Aggregated read model returned to client or admin shells.
 * Belongs here: projection-safe views composed from authoritative state.
 * Does not belong here: server write-model internals or runtime caches.
 */
export interface GameSnapshotView {
  serverInstance: ServerInstance;
  player: Player;
  alliance: Alliance | null;
  visibleDistricts: District[];
  visibleBuildings: Building[];
  activeEvents: EventState[];
  notifications: Notification[];
  victoryState: VictoryState | null;
}

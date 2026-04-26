import type { Notification } from "../entities/notification";
import type { VictoryState } from "../entities/victory-state";
import type { PlayerFactionId } from "../entities/faction";
import type { PlayerColorHex } from "../entities/player-color";
import type { PlayerId, ServerInstanceId } from "../ids/entity-id";
import type { GameModeId } from "../ids/game-mode-id";

/**
 * Responsibility: Minimal player-facing projection rendered by the client.
 * Belongs here: view contracts returned by the server for UI rendering.
 * Does not belong here: UI component state or domain rule calculations.
 */
export interface PlayerView {
  playerId: PlayerId;
  instanceId: ServerInstanceId;
  mode: GameModeId;
  factionId: PlayerFactionId;
  color: PlayerColorHex;
  serverTime: string;
  resourceBalances: Record<string, number>;
  notifications: Notification[];
  victoryState: VictoryState | null;
}

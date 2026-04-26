import type { GameModeId } from "@empire/shared-types/ids/game-mode-id";

/**
 * Responsibility: Minimal identity for one authoritative running game instance.
 * Belongs here: stable instance metadata shared by runtime and core.
 * Does not belong here: live connection tracking or persistence internals.
 */
export interface GameInstance {
  id: string;
  mode: GameModeId;
  tick: number;
}

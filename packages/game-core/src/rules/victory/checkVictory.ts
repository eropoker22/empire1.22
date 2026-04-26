import type { CoreGameState } from "../../entities";
import type { GameCoreContext } from "../../engine/context";

/**
 * Responsibility: Checks victory conditions against authoritative state.
 * Belongs here: server-side victory evaluation hooks.
 * Does not belong here: scoreboard rendering or admin transport.
 */
export const checkVictory = (_state: CoreGameState, _context: GameCoreContext): boolean => false;

import type { CoreGameState } from "../../entities";

/**
 * Responsibility: Applies periodic income collection to the authoritative state.
 * Belongs here: server-side economy transitions driven by ticks or commands.
 * Does not belong here: UI timing or client cache updates.
 */
export const collectIncome = (state: CoreGameState): CoreGameState => state;


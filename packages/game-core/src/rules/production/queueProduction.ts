import type { CoreGameState } from "../../entities";

/**
 * Responsibility: Queues production in the authoritative state.
 * Belongs here: write-model transitions for future production systems.
 * Does not belong here: UI queue previews or persistence adapters.
 */
export const queueProduction = (state: CoreGameState): CoreGameState => state;


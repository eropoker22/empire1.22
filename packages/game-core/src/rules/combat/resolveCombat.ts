import type { CoreGameState } from "../../entities";

/**
 * Responsibility: Entry point for future combat resolution.
 * Belongs here: authoritative combat state transition orchestration.
 * Does not belong here: UI previews or transport-level validation.
 */
export const resolveCombat = (state: CoreGameState): CoreGameState => state;


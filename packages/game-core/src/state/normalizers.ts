import type { CoreGameState } from "../entities";

/**
 * Responsibility: Normalization helpers for authoritative write-model shape.
 * Belongs here: utilities that keep entity maps and root references consistent.
 * Does not belong here: client-side denormalization or persistence adapters.
 */
export const normalizeState = (state: CoreGameState): CoreGameState => state;


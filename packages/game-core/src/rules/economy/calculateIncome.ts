import type { CoreGameState } from "../../entities";

/**
 * Responsibility: Calculates income from authoritative state and resolved config.
 * Belongs here: pure economy math and server-side derivations.
 * Does not belong here: persistence writes or client formatting.
 */
export const calculateIncome = (_state: CoreGameState): number => 0;


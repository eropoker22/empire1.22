import type { CoreGameState } from "../../entities";

/**
 * Responsibility: Evaluates police pressure from authoritative state.
 * Belongs here: pure server-side police/heat evaluation.
 * Does not belong here: admin dashboard rendering or notification delivery.
 */
export const evaluatePolicePressure = (_state: CoreGameState): number => 0;


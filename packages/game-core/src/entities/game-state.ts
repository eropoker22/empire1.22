import type { NormalizedGameState } from "./normalized-game-state";

/**
 * Responsibility: Core-facing alias for the canonical game state contract.
 * Belongs here: core-local re-exports and future domain-specific enrichments.
 * Does not belong here: transport mapping or persistence adapters.
 */
export type CoreGameState = NormalizedGameState;

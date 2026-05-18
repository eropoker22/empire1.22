import type { ResolvedGameModeConfig } from "../contracts";

/**
 * Responsibility: Shared execution context passed through engine, handlers, and rules.
 * Belongs here: immutable resolved config and future request-scoped core metadata.
 * Does not belong here: transport/session details or mutable runtime state.
 */
export interface GameCoreContext {
  config: ResolvedGameModeConfig;
  clock?: {
    now(): Date;
    nowIso(): string;
  };
}

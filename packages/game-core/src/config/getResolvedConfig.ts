import type { GameModeConfig } from "../contracts";

/**
 * Responsibility: Thin config accessor hook for rule modules inside the core.
 * Belongs here: shared adapter point for resolved mode config access.
 * Does not belong here: mode lookup by string or environment loading.
 */
export const getResolvedConfig = <TConfig extends GameModeConfig>(config: TConfig): TConfig => config;


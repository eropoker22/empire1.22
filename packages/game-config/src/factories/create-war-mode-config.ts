import type { ResolvedGameModeConfig } from "../contracts/game-mode-config";
import { baseResolvedGameModeConfig } from "../base/base-resolved-game-mode-config";
import { warModeOverride } from "../modes/war/war-mode.override";
import { mergeModeConfig } from "../resolvers/merge-config";

/**
 * Responsibility: Produces the resolved immutable config for war mode instances.
 * Belongs here: composition of base defaults with the war-mode override.
 * Does not belong here: transport concerns or instance scheduling.
 */
export const createWarModeConfig = (): ResolvedGameModeConfig =>
  mergeModeConfig(baseResolvedGameModeConfig, warModeOverride);


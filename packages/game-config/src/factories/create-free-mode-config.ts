import type { ResolvedGameModeConfig } from "../contracts/game-mode-config";
import { baseResolvedGameModeConfig } from "../base/base-resolved-game-mode-config";
import { freeModeOverride } from "../modes/free/free-mode.override";
import { mergeModeConfig } from "../resolvers/merge-config";

/**
 * Responsibility: Produces the resolved immutable config for free mode instances.
 * Belongs here: composition of base defaults with the free-mode override.
 * Does not belong here: server runtime state or gameplay execution logic.
 */
export const createFreeModeConfig = (): ResolvedGameModeConfig =>
  mergeModeConfig(baseResolvedGameModeConfig, freeModeOverride);


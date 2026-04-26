import type { GameModeId } from "@empire/shared-types";
import type { ResolvedGameModeConfig } from "./contracts/game-mode-config";
import { createFreeModeConfig } from "./factories/create-free-mode-config";
import { createWarModeConfig } from "./factories/create-war-mode-config";
import { deepFreezeConfig } from "./utils/deep-freeze-config";
import { validateModeConfig } from "./validation/validate-mode-config";

/**
 * Responsibility: Canonical mode-to-config resolver used by server bootstrap and instance creation.
 * Belongs here: one central registry for all supported game modes.
 * Does not belong here: scattered `if (mode === ...)` checks across features.
 */
export const resolveModeConfig = (mode: GameModeId): ResolvedGameModeConfig => {
  const registry: Record<GameModeId, () => ResolvedGameModeConfig> = {
    free: createFreeModeConfig,
    war: createWarModeConfig
  };

  return deepFreezeConfig(validateModeConfig(registry[mode]()));
};

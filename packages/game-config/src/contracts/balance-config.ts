import type { GameModeConfig } from "@empire/game-core/contracts/game-mode-config";

export type * from "@empire/game-core/contracts/game-mode-config";

/**
 * Compatibility alias for config-package callers that import only balance knobs.
 * The source contract lives in game-core so runtime and config cannot drift.
 */
export type BalanceConfig = GameModeConfig["balance"];

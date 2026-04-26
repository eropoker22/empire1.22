import type { ResolvedGameModeConfig } from "../contracts/game-mode-config";
import { baseBalanceConfig } from "./base-balance-config";
import { basePublicModeConfig } from "./base-public-mode-config";
import { baseTechnicalConfig } from "./base-technical-config";

/**
 * Responsibility: Single neutral resolved config used as the merge baseline.
 * Belongs here: full config shape with safe defaults for all sections.
 * Does not belong here: per-mode overrides or environment-specific mutations.
 */
export const baseResolvedGameModeConfig: ResolvedGameModeConfig = {
  mode: "free",
  tickRateMs: 5000,
  balance: baseBalanceConfig,
  technical: baseTechnicalConfig,
  publicMeta: basePublicModeConfig
};


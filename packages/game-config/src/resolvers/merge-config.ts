import type { ResolvedGameModeConfig } from "../contracts/game-mode-config";

/**
 * Responsibility: Small merge helper for resolved mode config sections.
 * Belongs here: composition of base defaults and mode overrides.
 * Does not belong here: runtime side effects or environment lookups.
 */
export const mergeModeConfig = (
  base: ResolvedGameModeConfig,
  override: Partial<ResolvedGameModeConfig>
): ResolvedGameModeConfig => ({
  ...base,
  ...override,
  balance: {
    ...base.balance,
    ...override.balance,
    conflict: {
      ...base.balance.conflict!,
      ...(override.balance?.conflict ?? {})
    } as NonNullable<ResolvedGameModeConfig["balance"]["conflict"]>,
    police: {
      ...base.balance.police!,
      ...(override.balance?.police ?? {})
    } as NonNullable<ResolvedGameModeConfig["balance"]["police"]>,
    fixedBuildings: {
      ...(base.balance.fixedBuildings ?? {}),
      ...(override.balance?.fixedBuildings ?? {})
    },
    buildingActions: {
      ...(base.balance.buildingActions ?? {}),
      ...(override.balance?.buildingActions ?? {})
    }
  },
  technical: {
    ...base.technical,
    ...override.technical,
    debug: {
      ...base.technical.debug,
      ...override.technical?.debug
    }
  },
  publicMeta: {
    ...base.publicMeta,
    ...override.publicMeta
  }
});

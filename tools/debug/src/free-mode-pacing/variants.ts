import {
  DEFAULT_ELIMINATION_SCORE_WEIGHTS,
  type ResolvedGameModeConfig
} from "@empire/game-core";
import type {
  FreeModePacingVariant,
  PacingVariantName
} from "./types";

export const FREE_MODE_PACING_VARIANTS: FreeModePacingVariant[] = [
  {
    variantName: "baseline",
    catastropheChance: 0.06
  },
  {
    variantName: "lower-catastrophe",
    catastropheChance: 0.02
  },
  {
    variantName: "elimination-4h",
    catastropheChance: 0.02,
    elimination: createEliminationVariant(2_880)
  },
  {
    variantName: "elimination-8h-grace",
    catastropheChance: 0.02,
    elimination: createEliminationVariant(5_760)
  },
  {
    variantName: "elimination-plus-faster-attacks",
    catastropheChance: 0.02,
    attackCooldownTicks: 30,
    minAttackDurationTicks: 30,
    elimination: createEliminationVariant(5_760)
  }
];

export const resolveFreeModePacingVariant = (variantName: PacingVariantName | string): FreeModePacingVariant => {
  const variant = FREE_MODE_PACING_VARIANTS.find((entry) => entry.variantName === variantName);
  if (!variant) {
    throw new Error(`Unknown free-mode pacing variant "${variantName}".`);
  }
  return variant;
};

export const applyPacingVariantToConfig = (
  baseConfig: ResolvedGameModeConfig,
  variant: FreeModePacingVariant
): ResolvedGameModeConfig => {
  const config = cloneModeConfig(baseConfig);

  if (config.balance.conflict) {
    config.balance.conflict = {
      ...config.balance.conflict,
      catastropheChance: variant.catastropheChance ?? config.balance.conflict.catastropheChance,
      attackCooldownTicks: variant.attackCooldownTicks ?? config.balance.conflict.attackCooldownTicks,
      minAttackDurationTicks: variant.minAttackDurationTicks ?? config.balance.conflict.minAttackDurationTicks
    };
  }

  if (!variant.elimination) {
    delete config.balance.elimination;
    return config;
  }

  config.balance.elimination = {
    enabled: true,
    firstEliminationTick: variant.elimination.firstEliminationTick,
    intervalTicks: variant.elimination.eliminationIntervalTicks,
    minActivePlayers: variant.elimination.minActivePlayers,
    dangerZoneSize: variant.elimination.dangerZoneSize,
    eliminatedPlayerStatus: "defeated",
    defeatedDistrictPolicy: variant.elimination.defeatedDistrictPolicy,
    defeatedDistrictLockTicks: variant.elimination.eliminationIntervalTicks,
    scoreWeights: { ...DEFAULT_ELIMINATION_SCORE_WEIGHTS }
  };

  return config;
};

function createEliminationVariant(firstEliminationTick: number): FreeModePacingVariant["elimination"] {
  return {
  enabled: true,
  firstEliminationTick,
  eliminationIntervalTicks: 2_880,
  minActivePlayers: 5,
  dangerZoneSize: 3,
  defeatedDistrictPolicy: "neutralize"
  };
}

const cloneModeConfig = (config: ResolvedGameModeConfig): ResolvedGameModeConfig =>
  JSON.parse(JSON.stringify(config)) as ResolvedGameModeConfig;

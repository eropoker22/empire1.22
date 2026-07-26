import {
  DEFAULT_ELIMINATION_SCORE_WEIGHTS,
  type ResolvedGameModeConfig
} from "@empire/game-core";
import {
  ticksFromHours,
  ticksFromMinutes
} from "../../../../packages/game-config/src/modes/free/free-mode-timing";
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
    variantName: "elimination-8h-stop8",
    catastropheChance: 0.02,
    elimination: createEliminationVariant()
  },
  {
    variantName: "elimination-8h-stop8-lower-catastrophe",
    catastropheChance: 0.02,
    elimination: createEliminationVariant()
  },
  {
    variantName: "elimination-8h-stop8-lower-catastrophe-faster-attacks",
    catastropheChance: 0.02,
    attackCooldownTicks: ticksFromMinutes(2.5),
    minAttackDurationTicks: ticksFromMinutes(2.5),
    elimination: createEliminationVariant()
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
    quietHours: { ...variant.elimination.quietHours },
    eliminatedPlayerStatus: "defeated",
    defeatedDistrictPolicy: variant.elimination.defeatedDistrictPolicy,
    defeatedDistrictLockTicks: variant.elimination.eliminationIntervalTicks,
    scoreWeights: { ...DEFAULT_ELIMINATION_SCORE_WEIGHTS }
  };

  return config;
};

function createEliminationVariant(): FreeModePacingVariant["elimination"] {
  return {
  enabled: true,
  firstEliminationTick: ticksFromHours(8),
  eliminationIntervalTicks: ticksFromHours(4),
  minActivePlayers: 8,
  dangerZoneSize: 3,
  quietHours: {
    enabled: true,
    timeZone: "Europe/Bratislava",
    startHour: 0,
    endHour: 6,
    behavior: "defer_to_window_end"
  },
  defeatedDistrictPolicy: "neutralize"
  };
}

const cloneModeConfig = (config: ResolvedGameModeConfig): ResolvedGameModeConfig =>
  JSON.parse(JSON.stringify(config)) as ResolvedGameModeConfig;

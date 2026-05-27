import { FACTION_DEFINITIONS } from "@empire/game-config";
import { FREE_BR_BOT_STRATEGIES, FREE_BR_STRATEGY_IDS } from "./bot-strategies";
import type { SeededRng } from "./seeded-rng";
import type {
  FreeBrActivityProfile,
  FreeBrPlayer,
  FreeBrScenarioConfig,
  FreeBrStrategyId
} from "./types";

const playerNames = [
  "Viktor Neon",
  "Mara Byte",
  "Kiro Chrome",
  "Nika Static",
  "Rado Viper",
  "Tessa Flux",
  "Dante Volt",
  "Iris Knox",
  "Boris Ash",
  "Sima Vale",
  "Rex Harbor",
  "Lena Cipher",
  "Miro Blade",
  "Zara Coil",
  "Erik Signal",
  "Nora Pulse",
  "Ivan Drift",
  "Mila Forge",
  "Tibor Ghost",
  "Ada Crown"
];

export const createFreeBrPlayers = (
  rng: SeededRng,
  scenario: FreeBrScenarioConfig,
  startDistrictIds: number[]
): FreeBrPlayer[] => {
  const factionIds = FACTION_DEFINITIONS.map((definition) => definition.id);
  return Array.from({ length: 20 }, (_, index) => {
    const strategyId = rng.weightedPick<FreeBrStrategyId>(scenario.strategyWeights);
    const strategy = FREE_BR_BOT_STRATEGIES[strategyId];
    const activityProfile = resolveActivityProfile(rng, strategyId);
    const resources: Record<string, number> = {
      cash: 1500 + rng.int(0, 550),
      "dirty-cash": 300 + rng.int(0, 180),
      chemicals: 10,
      biomass: 6,
      "metal-parts": 8,
      "tech-core": 2,
      population: 100
    };

    return {
      id: `player:${index + 1}`,
      name: playerNames[index] ?? `Player ${index + 1}`,
      factionId: factionIds[index % factionIds.length] ?? "mafian",
      strategyId,
      activityProfile,
      status: "active",
      homeDistrictId: startDistrictIds[index] ?? index + 1,
      allianceId: null,
      riskTolerance: clamp01(strategy.risk + rng.float(-0.08, 0.08)),
      aggression: clamp01(strategy.aggression * scenario.aggressionMultiplier + rng.float(-0.08, 0.08)),
      downtownPreference: clamp01(strategy.downtown * scenario.downtownPreferenceMultiplier + rng.float(-0.08, 0.08)),
      economyPreference: clamp01(strategy.economy + rng.float(-0.08, 0.08)),
      defensePreference: clamp01(strategy.defense + rng.float(-0.08, 0.08)),
      alliancePreference: clamp01(strategy.alliance * scenario.allianceMultiplier + rng.float(-0.08, 0.08)),
      heatTolerance: clamp01((strategy.risk + strategy.crime) / 2 + rng.float(-0.08, 0.08)),
      resources,
      population: 100,
      heat: 0,
      lastActionTick: null,
      cooldowns: {},
      spyIntel: new Set<number>()
    };
  });
};

export const resolveActivityProbability = (
  player: FreeBrPlayer,
  options: {
    quietHours: boolean;
    dangerZone: boolean;
    leader: boolean;
    highHeat: boolean;
  }
): number => {
  const baseByProfile: Record<FreeBrActivityProfile, number> = {
    hardcore: 0.9,
    active: 0.62,
    casual: 0.32,
    low: 0.12
  };
  const strategyBias = FREE_BR_BOT_STRATEGIES[player.strategyId]?.activityBias ?? 0;
  let probability = baseByProfile[player.activityProfile] + strategyBias;
  if (options.quietHours) probability *= 0.25;
  if (options.dangerZone) probability += 0.22;
  if (options.leader) probability -= 0.08;
  if (options.highHeat) probability -= 0.12 * (1 - player.heatTolerance);
  return clamp01(probability);
};

export const strategyIds = FREE_BR_STRATEGY_IDS;

const resolveActivityProfile = (rng: SeededRng, strategyId: FreeBrStrategyId): FreeBrActivityProfile => {
  if (strategyId === "casual") {
    return rng.weightedPick<FreeBrActivityProfile>({ casual: 6, low: 3, active: 1 });
  }
  if (strategyId === "aggressive-expander" || strategyId === "downtown-rusher") {
    return rng.weightedPick<FreeBrActivityProfile>({ hardcore: 3, active: 5, casual: 2 });
  }
  if (strategyId === "defensive-turtle") {
    return rng.weightedPick<FreeBrActivityProfile>({ active: 4, casual: 4, low: 2 });
  }
  return rng.weightedPick<FreeBrActivityProfile>({ hardcore: 1, active: 5, casual: 3, low: 1 });
};

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

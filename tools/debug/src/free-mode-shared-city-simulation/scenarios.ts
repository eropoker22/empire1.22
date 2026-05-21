import { PLAYER_FACTION_IDS } from "@empire/shared-types";
import { SIMULATION_BOT_PROFILES } from "./bot-profiles";
import { runFreeModeSimulation } from "./runFreeModeSimulation";
import type {
  FreeModeSharedCityScenario,
  FreeModeSharedCityScenarioMatrixResult,
  FreeModeSharedCityScenarioName,
  FreeModeSharedCityScenarioResult
} from "./types";

export const FREE_MODE_SHARED_CITY_SCENARIOS: FreeModeSharedCityScenario[] = [
  {
    name: "solo-player-first-30-minutes",
    description: "Solo player first 30 minutes: production, crafting and expansion deadlock check.",
    options: { playerCount: 1, durationMinutes: 30, ticksPerRound: 12, botProfile: "economy", scenarioName: "solo-player-first-30-minutes" }
  },
  {
    name: "shared-city-5p",
    description: "Five-player shared city first hour with mixed bot profiles.",
    options: { playerCount: 5, durationMinutes: 60, ticksPerRound: 12, botProfileRotation: [...SIMULATION_BOT_PROFILES], scenarioName: "shared-city-5p" }
  },
  {
    name: "shared-city-20p",
    description: "Twenty-player shared city first hour with mixed bot profiles.",
    options: { playerCount: 20, durationMinutes: 60, ticksPerRound: 12, botProfileRotation: [...SIMULATION_BOT_PROFILES], scenarioName: "shared-city-20p" }
  },
  {
    name: "aggressive-conflict-player",
    description: "Aggressive conflict pressure in the first 45 minutes.",
    options: { playerCount: 8, durationMinutes: 45, ticksPerRound: 12, botProfile: "aggressor", scenarioName: "aggressive-conflict-player" }
  },
  {
    name: "passive-economy-player",
    description: "Passive economy pressure in the first 45 minutes.",
    options: { playerCount: 5, durationMinutes: 45, ticksPerRound: 12, botProfile: "economy", scenarioName: "passive-economy-player" }
  },
  {
    name: "baseline-20p-short",
    description: "Current 20-player short deterministic pacing baseline.",
    options: { playerCount: 20, rounds: 10, ticksPerRound: 3, botProfile: "scout", scenarioName: "baseline-20p-short" }
  },
  {
    name: "baseline-20p-longer",
    description: "Longer 20-player loop pressure sample.",
    options: { playerCount: 20, rounds: 25, ticksPerRound: 3, botProfile: "scout", scenarioName: "baseline-20p-longer" }
  },
  {
    name: "small-8p",
    description: "Smaller lobby on the same shared city slice.",
    options: { playerCount: 8, rounds: 15, ticksPerRound: 3, botProfile: "scout", scenarioName: "small-8p" }
  },
  {
    name: "high-tick-pressure",
    description: "Same player pressure with more server ticks between turns.",
    options: { playerCount: 20, rounds: 10, ticksPerRound: 8, botProfile: "scout", scenarioName: "high-tick-pressure" }
  },
  {
    name: "low-action-pressure",
    description: "Same player pressure with fewer ticks between turns.",
    options: { playerCount: 20, rounds: 10, ticksPerRound: 1, botProfile: "scout", scenarioName: "low-action-pressure" }
  },
  {
    name: "mixed-factions-20p",
    description: "20 players with deterministic canonical faction rotation.",
    options: { playerCount: 20, rounds: 10, ticksPerRound: 3, factionRotation: [...PLAYER_FACTION_IDS], botProfile: "scout", scenarioName: "mixed-factions-20p" }
  },
  {
    name: "mixed-profiles-20p",
    description: "20 players with deterministic bot behavior profile rotation.",
    options: { playerCount: 20, rounds: 10, ticksPerRound: 3, botProfileRotation: [...SIMULATION_BOT_PROFILES], scenarioName: "mixed-profiles-20p" }
  }
];

export const runFreeModeScenarioMatrix = async (
  scenarioNames?: FreeModeSharedCityScenarioName[]
): Promise<FreeModeSharedCityScenarioMatrixResult> => {
  const selectedScenarios = scenarioNames?.length
    ? FREE_MODE_SHARED_CITY_SCENARIOS.filter((scenario) => scenarioNames.includes(scenario.name))
    : FREE_MODE_SHARED_CITY_SCENARIOS;
  const scenarios: FreeModeSharedCityScenarioResult[] = [];

  for (const scenario of selectedScenarios) {
    const result = await runFreeModeSimulation({
      ...scenario.options,
      instanceId: `instance:free-shared-city:${scenario.name}`,
      scenarioName: scenario.name
    });
    scenarios.push({ ...result, scenario });
  }

  return { scenarios };
};

export const resolveScenario = (value: string | undefined): FreeModeSharedCityScenario | null =>
  FREE_MODE_SHARED_CITY_SCENARIOS.find((scenario) => scenario.name === value) ?? null;

export const resolveScenarioNames = (value: string | undefined): FreeModeSharedCityScenarioName[] | undefined => {
  if (!value) return undefined;
  const knownNames = new Set(FREE_MODE_SHARED_CITY_SCENARIOS.map((scenario) => scenario.name));
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry): entry is FreeModeSharedCityScenarioName => knownNames.has(entry as FreeModeSharedCityScenarioName));
};

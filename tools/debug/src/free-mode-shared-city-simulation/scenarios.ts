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
    name: "baseline-20p-short",
    description: "Current 20-player short deterministic pacing baseline.",
    options: { playerCount: 20, rounds: 10, ticksPerRound: 3, botProfile: "scout" }
  },
  {
    name: "baseline-20p-longer",
    description: "Longer 20-player loop pressure sample.",
    options: { playerCount: 20, rounds: 25, ticksPerRound: 3, botProfile: "scout" }
  },
  {
    name: "small-8p",
    description: "Smaller lobby on the same shared city slice.",
    options: { playerCount: 8, rounds: 15, ticksPerRound: 3, botProfile: "scout" }
  },
  {
    name: "high-tick-pressure",
    description: "Same player pressure with more server ticks between turns.",
    options: { playerCount: 20, rounds: 10, ticksPerRound: 8, botProfile: "scout" }
  },
  {
    name: "low-action-pressure",
    description: "Same player pressure with fewer ticks between turns.",
    options: { playerCount: 20, rounds: 10, ticksPerRound: 1, botProfile: "scout" }
  },
  {
    name: "mixed-factions-20p",
    description: "20 players with deterministic canonical faction rotation.",
    options: { playerCount: 20, rounds: 10, ticksPerRound: 3, factionRotation: [...PLAYER_FACTION_IDS], botProfile: "scout" }
  },
  {
    name: "mixed-profiles-20p",
    description: "20 players with deterministic bot behavior profile rotation.",
    options: { playerCount: 20, rounds: 10, ticksPerRound: 3, botProfileRotation: [...SIMULATION_BOT_PROFILES] }
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
      instanceId: `instance:free-shared-city:${scenario.name}`
    });
    scenarios.push({ ...result, scenario });
  }

  return { scenarios };
};

export const resolveScenarioNames = (value: string | undefined): FreeModeSharedCityScenarioName[] | undefined => {
  if (!value) return undefined;
  const knownNames = new Set(FREE_MODE_SHARED_CITY_SCENARIOS.map((scenario) => scenario.name));
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry): entry is FreeModeSharedCityScenarioName => knownNames.has(entry as FreeModeSharedCityScenarioName));
};

import type { FreeBrScenarioConfig, FreeBrScenarioName, FreeBrStrategyId } from "./types";

const baseWeights: Record<FreeBrStrategyId, number> = {
  "aggressive-expander": 3,
  "economy-builder": 3,
  "downtown-rusher": 2,
  "defensive-turtle": 2,
  diplomat: 2,
  opportunist: 3,
  casual: 3,
  "high-risk-criminal": 2
};

export const FREE_BR_SCENARIOS: Record<FreeBrScenarioName, FreeBrScenarioConfig> = {
  "canonical-20p": {
    name: "canonical-20p",
    description: "Canonical 20-player Free BR mix with all major strategy archetypes.",
    strategyWeights: baseWeights,
    allianceMultiplier: 1,
    aggressionMultiplier: 1,
    downtownPreferenceMultiplier: 1,
    crimeMultiplier: 1
  },
  "aggressive-heavy": {
    name: "aggressive-heavy",
    description: "More aggressive expanders and opportunists; stress-tests attack volume and heat.",
    strategyWeights: { ...baseWeights, "aggressive-expander": 7, opportunist: 5, casual: 1 },
    allianceMultiplier: 0.85,
    aggressionMultiplier: 1.3,
    downtownPreferenceMultiplier: 1,
    crimeMultiplier: 1.05
  },
  "casual-heavy": {
    name: "casual-heavy",
    description: "More low-activity public-server players; stress-tests onboarding fairness.",
    strategyWeights: { ...baseWeights, casual: 8, "defensive-turtle": 3, "aggressive-expander": 1 },
    allianceMultiplier: 0.9,
    aggressionMultiplier: 0.75,
    downtownPreferenceMultiplier: 0.8,
    crimeMultiplier: 0.75
  },
  "downtown-rush": {
    name: "downtown-rush",
    description: "More downtown rushers; stress-tests rare building snowball.",
    strategyWeights: { ...baseWeights, "downtown-rusher": 8, opportunist: 4, "economy-builder": 1 },
    allianceMultiplier: 1,
    aggressionMultiplier: 1.1,
    downtownPreferenceMultiplier: 1.55,
    crimeMultiplier: 1
  },
  "alliance-heavy": {
    name: "alliance-heavy",
    description: "More diplomats and alliance preference; stress-tests coalition dominance.",
    strategyWeights: { ...baseWeights, diplomat: 8, "economy-builder": 4, "high-risk-criminal": 1 },
    allianceMultiplier: 1.65,
    aggressionMultiplier: 0.9,
    downtownPreferenceMultiplier: 1,
    crimeMultiplier: 0.8
  },
  "no-alliance-control": {
    name: "no-alliance-control",
    description: "Alliance formation is strongly reduced; isolates solo control pacing.",
    strategyWeights: { ...baseWeights, diplomat: 1, opportunist: 5, "aggressive-expander": 4 },
    allianceMultiplier: 0.25,
    aggressionMultiplier: 1.1,
    downtownPreferenceMultiplier: 1,
    crimeMultiplier: 1
  },
  "high-risk-crime": {
    name: "high-risk-crime",
    description: "More dirty cash, smuggling, dealers and high-heat players.",
    strategyWeights: { ...baseWeights, "high-risk-criminal": 8, "economy-builder": 1, casual: 1 },
    allianceMultiplier: 0.75,
    aggressionMultiplier: 1.05,
    downtownPreferenceMultiplier: 1,
    crimeMultiplier: 1.65
  }
};

export const DEFAULT_MATRIX_SCENARIOS: FreeBrScenarioName[] = [
  "canonical-20p",
  "aggressive-heavy",
  "casual-heavy",
  "downtown-rush",
  "alliance-heavy",
  "no-alliance-control",
  "high-risk-crime"
];

export const resolveFreeBrScenario = (name: string | undefined): FreeBrScenarioConfig =>
  FREE_BR_SCENARIOS[(name as FreeBrScenarioName) || "canonical-20p"] ?? FREE_BR_SCENARIOS["canonical-20p"];

export const parseScenarioList = (value: string | undefined): FreeBrScenarioName[] =>
  (value
    ? value.split(",").map((entry) => entry.trim()).filter(Boolean)
    : DEFAULT_MATRIX_SCENARIOS
  ).filter((entry): entry is FreeBrScenarioName => entry in FREE_BR_SCENARIOS);

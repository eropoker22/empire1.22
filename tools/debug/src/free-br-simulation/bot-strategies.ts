import type { FreeBrBotStrategyProfile, FreeBrStrategyId } from "./types";

export const FREE_BR_BOT_STRATEGIES: Record<FreeBrStrategyId, FreeBrBotStrategyProfile> = {
  "aggressive-expander": {
    id: "aggressive-expander",
    label: "Aggressive Expander",
    aggression: 0.92,
    economy: 0.35,
    downtown: 0.45,
    defense: 0.35,
    alliance: 0.25,
    crime: 0.35,
    risk: 0.82,
    activityBias: 0.15
  },
  "economy-builder": {
    id: "economy-builder",
    label: "Economy Builder",
    aggression: 0.35,
    economy: 0.92,
    downtown: 0.45,
    defense: 0.55,
    alliance: 0.45,
    crime: 0.25,
    risk: 0.38,
    activityBias: 0.05
  },
  "downtown-rusher": {
    id: "downtown-rusher",
    label: "Downtown Rusher",
    aggression: 0.72,
    economy: 0.58,
    downtown: 0.98,
    defense: 0.42,
    alliance: 0.35,
    crime: 0.48,
    risk: 0.76,
    activityBias: 0.12
  },
  "defensive-turtle": {
    id: "defensive-turtle",
    label: "Defensive Turtle",
    aggression: 0.25,
    economy: 0.58,
    downtown: 0.28,
    defense: 0.95,
    alliance: 0.42,
    crime: 0.18,
    risk: 0.25,
    activityBias: -0.02
  },
  diplomat: {
    id: "diplomat",
    label: "Diplomat",
    aggression: 0.38,
    economy: 0.55,
    downtown: 0.38,
    defense: 0.48,
    alliance: 0.95,
    crime: 0.2,
    risk: 0.34,
    activityBias: 0.02
  },
  opportunist: {
    id: "opportunist",
    label: "Opportunist",
    aggression: 0.68,
    economy: 0.52,
    downtown: 0.55,
    defense: 0.4,
    alliance: 0.38,
    crime: 0.5,
    risk: 0.65,
    activityBias: 0.08
  },
  casual: {
    id: "casual",
    label: "Casual",
    aggression: 0.28,
    economy: 0.42,
    downtown: 0.25,
    defense: 0.35,
    alliance: 0.32,
    crime: 0.18,
    risk: 0.22,
    activityBias: -0.18
  },
  "high-risk-criminal": {
    id: "high-risk-criminal",
    label: "High-risk Criminal",
    aggression: 0.62,
    economy: 0.48,
    downtown: 0.52,
    defense: 0.3,
    alliance: 0.28,
    crime: 0.98,
    risk: 0.9,
    activityBias: 0.1
  }
};

export const FREE_BR_STRATEGY_IDS = Object.keys(FREE_BR_BOT_STRATEGIES) as FreeBrStrategyId[];

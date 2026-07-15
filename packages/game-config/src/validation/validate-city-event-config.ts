import {
  CITY_EVENT_REWARD_KEYS,
  type CityEventAgentId,
  type CityEventBalanceConfig,
  type CityEventDifficulty
} from "@empire/game-core/contracts/city-event-balance-config";
import type { ResolvedGameModeConfig } from "@empire/game-core/contracts/game-mode-config";
import { createReplacementValueResolver } from "@empire/game-core/rules/economy/replacementValue";

const agents = new Set<CityEventAgentId>(["victor", "leon", "nyra"]);
const rewardKeys = new Set<string>(CITY_EVENT_REWARD_KEYS);
const strategicKeys = new Set(["combat-module", "ghost-serum", "overdrive-x", "smg", "bazooka", "defense-tower"]);
const forbiddenCommonRewards = new Set(["bazooka", "defense-tower"]);

const assertClockTime = (hour: number, minute: number, field: string): void => {
  if (!Number.isInteger(hour) || hour < 0 || hour > 23 || !Number.isInteger(minute) || minute < 0 || minute > 59) {
    throw new Error(`City Event config requires a valid ${field} city time.`);
  }
};

export const validateCityEventConfig = (
  cityEvents: CityEventBalanceConfig,
  config: ResolvedGameModeConfig
): void => {
  if (!cityEvents.enabled) return;
  if (cityEvents.definitions.length !== 300) {
    throw new Error("Free mode requires exactly 300 canonical City Event definitions.");
  }
  for (const agent of Object.values(cityEvents.agents)) {
    if (!agents.has(agent.agentId) || agent.offerCount !== 3 || agent.requiredInfluence < 0) {
      throw new Error(`Invalid City Event agent '${agent.agentId}'.`);
    }
    for (const time of agent.refreshTimes) assertClockTime(time.hour, time.minute, `${agent.agentId} refresh`);
    if (agent.availability) {
      assertClockTime(agent.availability.opensAt.hour, agent.availability.opensAt.minute, `${agent.agentId} opening`);
      assertClockTime(agent.availability.closesAt.hour, agent.availability.closesAt.minute, `${agent.agentId} closing`);
    }
  }

  const ids = new Set<string>();
  const counts = new Map<CityEventAgentId, number>();
  const replacementValues = createReplacementValueResolver(config);
  for (const definition of cityEvents.definitions) {
    if (!definition.id.trim() || ids.has(definition.id)) throw new Error(`Duplicate City Event ID '${definition.id}'.`);
    ids.add(definition.id);
    if (!agents.has(definition.agentId)) throw new Error(`Unknown City Event agent '${definition.agentId}'.`);
    counts.set(definition.agentId, (counts.get(definition.agentId) ?? 0) + 1);
    if (!definition.title.trim() || !definition.description.trim()) {
      throw new Error(`City Event '${definition.id}' requires player-facing title and description.`);
    }
    const budget = cityEvents.difficultyBudgets[definition.difficulty as CityEventDifficulty];
    if (!budget) throw new Error(`City Event '${definition.id}' has invalid difficulty.`);
    if (definition.successRate < budget.successRateMin || definition.successRate > budget.successRateMax) {
      throw new Error(`City Event '${definition.id}' success rate is outside its difficulty profile.`);
    }
    if (definition.durationMinutes < budget.durationMinutesMin || definition.durationMinutes > budget.durationMinutesMax) {
      throw new Error(`City Event '${definition.id}' durationMinutes is outside its difficulty profile.`);
    }
    if (definition.risk.successHeat < 0 || definition.risk.failureHeat < definition.risk.successHeat || definition.risk.failureDirtyCashLoss < 0) {
      throw new Error(`City Event '${definition.id}' has invalid risk values.`);
    }

    let rewardValue = 0;
    let strategicCount = 0;
    for (const [resourceKey, rawAmount] of Object.entries(definition.reward)) {
      const amount = Number(rawAmount || 0);
      if (!rewardKeys.has(resourceKey)) throw new Error(`City Event '${definition.id}' uses unknown reward '${resourceKey}'.`);
      if (!Number.isInteger(amount) || amount <= 0) throw new Error(`City Event '${definition.id}' has invalid reward amount.`);
      if (resourceKey === "cash" || resourceKey === "dirty-cash") rewardValue += amount;
      else if (resourceKey !== "influence") {
        const replacementValue = replacementValues.resolve(resourceKey);
        if (replacementValue === null) throw new Error(`City Event '${definition.id}' reward '${resourceKey}' has no canonical value.`);
        rewardValue += replacementValue * amount;
      }
      if (strategicKeys.has(resourceKey)) {
        strategicCount += 1;
        if (amount > 1) throw new Error(`City Event '${definition.id}' grants more than one Strategic item.`);
      }
      if (forbiddenCommonRewards.has(resourceKey)) {
        throw new Error(`City Event '${definition.id}' cannot grant '${resourceKey}'.`);
      }
    }
    if (strategicCount > 1 || (strategicCount > 0 && definition.difficulty !== "rare")) {
      throw new Error(`City Event '${definition.id}' violates Strategic reward rules.`);
    }
    if (rewardValue > budget.maxReplacementValue) {
      throw new Error(`City Event '${definition.id}' exceeds the ${definition.difficulty} replacement-value budget.`);
    }
  }
  for (const agentId of agents) {
    if (counts.get(agentId) !== 100) throw new Error(`City Event agent '${agentId}' requires exactly 100 definitions.`);
  }
};

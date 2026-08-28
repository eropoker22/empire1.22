import {
  createPlayerCityEventsView,
  getAttackWeaponInventory,
  hasValidAttackAuthorization,
  resolveDistrictRelation,
  synchronizePlayerCityEvents
} from "@empire/game-core";
import type { ServerApp } from "../../../../apps/server/src/app/server-app";
import type { SeededRng } from "../free-br-simulation/seeded-rng";
import type { CommandExecutor } from "./executor";
import type { MutableSimulationClock } from "./mutable-clock";
import type { SimulationBot } from "./types";
import { createCandidates } from "./action-candidates";
import {
  attackWeapons,
  conflictPayload,
  pickOptional,
  previewCandidate,
  requiredRuntime,
  type Candidate
} from "./action-candidate-utils";

export {
  establishAlliances,
  exerciseIdempotence,
  exerciseMarketConcurrency
} from "./action-scenario-probes";

export const runBotDecision = async (input: {
  executor: CommandExecutor;
  server: ServerApp;
  clock: MutableSimulationClock;
  instanceId: string;
  bot: SimulationBot;
  rng: SeededRng;
}): Promise<void> => {
  const { executor, server, clock, instanceId, bot, rng } = input;
  const runtime = requiredRuntime(server, instanceId);
  const state = runtime.state;
  const player = state.playersById[bot.playerId];
  if (!player || player.status !== "active" || !player.homeDistrictId) return;
  const observedCityView = createPlayerCityEventsView(
    synchronizePlayerCityEvents(structuredClone(state), bot.playerId, {
      config: runtime.config,
      clock
    }),
    bot.playerId,
    { config: runtime.config, clock }
  );
  for (const reward of observedCityView?.pendingRewards ?? []) {
    executor.recordCityEventRewardObservation(reward.pendingRewardId, reward.canClaim);
  }
  const candidates = createCandidates(state, runtime.config, bot, clock, rng);
  while (candidates.length > 0) {
    const claimIndex = candidates.findIndex((entry) => entry.type === "claim-city-event-reward");
    const freeCapacityIndex = candidates.findIndex((entry) =>
      entry.decisionContext.purpose === "free-capacity-for-city-event-reward"
    );
    const playerMarketBuyIndex = candidates.findIndex((entry) =>
      entry.type === "buy-player-market-listing"
    );
    const playerMarketCreateIndex = ["market-trader", "economist", "opportunist", "balanced"]
      .includes(bot.archetype)
      ? candidates.findIndex((entry) => entry.type === "create-player-market-listing")
      : -1;
    const playerMarketIndex = playerMarketBuyIndex >= 0
      ? playerMarketBuyIndex
      : playerMarketCreateIndex;
    const priorityIndex = claimIndex >= 0
      ? claimIndex
      : freeCapacityIndex >= 0 ? freeCapacityIndex : playerMarketIndex;
    const selected = priorityIndex >= 0
      ? String(priorityIndex)
      : rng.weightedPick(Object.fromEntries(candidates.map((entry, index) => [
          String(index),
          entry.weight
        ])));
    const selectedIndex = Number(selected);
    const selectedCandidate = candidates[selectedIndex] ?? candidates[0]!;
    const preview = previewCandidate(state, runtime.config, bot, selectedCandidate, clock);
    if (!preview.accepted) {
      executor.recordDecisionSkip(bot, selectedCandidate.type, preview.reasonCode);
      candidates.splice(Number.isInteger(selectedIndex) && selectedIndex >= 0 ? selectedIndex : 0, 1);
      continue;
    }
    await executor.submit(bot, selectedCandidate.type, selectedCandidate.payload, {
      decisionContext: selectedCandidate.decisionContext
    });
    return;
  }
};

export const runAuthorizedAttack = async (input: {
  executor: CommandExecutor;
  server: ServerApp;
  instanceId: string;
  bot: SimulationBot;
  rng: SeededRng;
}): Promise<void> => {
  const { executor, server, instanceId, bot, rng } = input;
  const state = requiredRuntime(server, instanceId).state;
  const player = state.playersById[bot.playerId];
  if (!player || player.status !== "active") return;
  const targets = Object.values(state.districtsById).flatMap((source) => {
    if (source.ownerPlayerId !== bot.playerId || source.status === "destroyed") return [];
    return source.adjacentDistrictIds.flatMap((targetId) => {
      const target = state.districtsById[targetId];
      if (
        !target?.ownerPlayerId
        || target.ownerPlayerId === bot.playerId
        || target.status === "destroyed"
        || resolveDistrictRelation(state, player, target) !== "enemy"
        || !hasValidAttackAuthorization(state, bot.playerId, target.id)
      ) return [];
      return [{ source, target }];
    });
  });
  const activeBountyTargetPlayerIds = new Set(Object.values(state.bountiesById ?? {})
    .filter((bounty) =>
      bounty.status === "active"
      && bounty.createdByPlayerId !== bot.playerId
      && bounty.objectiveType === "attack-player"
    )
    .map((bounty) => bounty.targetPlayerId));
  const bountyTargets = targets.filter(({ target }) =>
    target.ownerPlayerId && activeBountyTargetPlayerIds.has(target.ownerPlayerId)
  );
  const selected = pickOptional(rng, bountyTargets.length > 0 ? bountyTargets : targets);
  if (!selected) return;
  const attackCandidate: Candidate = {
    type: "attack-district",
    payload: conflictPayload(selected.source, selected.target, {
      districtId: selected.target.id,
      sourceDistrictId: selected.source.id,
      weapons: attackWeapons(player.attackLoadout, getAttackWeaponInventory(state, player))
    }),
    weight: 1,
    decisionContext: {
      source: selected.source.id,
      target: selected.target.id,
      authorized: true,
      bountyTarget: bountyTargets.includes(selected)
    }
  };
  const preview = previewCandidate(
    state,
    requiredRuntime(server, instanceId).config,
    bot,
    attackCandidate
  );
  if (!preview.accepted) {
    executor.recordDecisionSkip(bot, attackCandidate.type, preview.reasonCode);
    return;
  }
  await executor.submit(bot, attackCandidate.type, attackCandidate.payload, {
    decisionContext: attackCandidate.decisionContext
  });
};

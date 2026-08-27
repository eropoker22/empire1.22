import {
  applyCommand,
  canPlayerReceiveResource,
  createPlayerCityEventsView,
  getMarketViewModel,
  getAttackWeaponInventory,
  hasValidAttackAuthorization,
  hasEnoughResourcesForUpgrade,
  resolveBuildingUpgradeCost,
  resolveDistrictRelation,
  synchronizePlayerCityEvents,
  validateOccupyEmptyDistrictAuthorization,
  type CoreGameState
} from "@empire/game-core";
import {
  BOUNTY_DURATION_OPTIONS_HOURS,
  BOUNTY_MIN_REWARD_CLEAN_CASH,
  type GameCommand
} from "@empire/shared-types";
import type { ServerApp } from "../../../../apps/server/src/app/server-app";
import type { SeededRng } from "../free-br-simulation/seeded-rng";
import type { CommandExecutor } from "./executor";
import type { MutableSimulationClock } from "./mutable-clock";
import type { FullGameScenario, RejectionExpectation, SimulationBot } from "./types";

type Candidate = {
  type: GameCommand["type"];
  payload: Record<string, unknown>;
  weight: number;
  decisionContext: Record<string, unknown>;
};

const PLAYER_MARKET_SELLER_RESERVE = 16;
const PLAYER_MARKET_BUYER_RESERVE = 12;

const EXPECTED_GAMEPLAY = (codes: readonly string[], rationale: string): RejectionExpectation => ({
  category: "EXPECTED_GAMEPLAY_REJECTION",
  codes,
  rationale
});
const EXPECTED_CONCURRENCY = (codes: readonly string[], rationale: string): RejectionExpectation => ({
  category: "EXPECTED_CONCURRENCY_REJECTION",
  codes,
  rationale
});

export const establishAlliances = async (
  executor: CommandExecutor,
  server: ServerApp,
  clock: MutableSimulationClock,
  instanceId: string,
  bots: SimulationBot[],
  scenario: FullGameScenario
): Promise<void> => {
  const groupCount = scenario === "alliance-war" ? 4 : 3;
  for (let group = 0; group < groupCount; group += 1) {
    const members = bots.slice(group * 4, group * 4 + 4);
    const leader = members[0];
    if (!leader) continue;
    const created = await executor.submit(leader, "create-alliance", {
      name: `Matrix ${group + 1}`,
      tag: `M${group + 1}`,
      emblemColor: ["#ef4444", "#3b82f6", "#22c55e", "#eab308"][group]
    });
    if (!created.accepted) continue;
    advanceOneTick(server, clock, instanceId);
    const allianceId = `alliance:${created.commandId}`;
    for (const member of members.slice(1)) {
      const invite = await executor.submit(leader, "invite-alliance-member", {
        allianceId,
        targetPlayerId: member.playerId
      });
      if (!invite.accepted) continue;
      advanceOneTick(server, clock, instanceId);
      const runtime = requiredRuntime(server, instanceId);
      const pending = Object.values(runtime.state.allianceInvitesById ?? {}).find((entry) =>
        entry.allianceId === allianceId && entry.targetPlayerId === member.playerId && entry.status === "pending"
      );
      if (pending) {
        await executor.submit(member, "respond-alliance-invite", { inviteId: pending.id, response: "accept" });
        advanceOneTick(server, clock, instanceId);
      }
    }
    clock.advance(requiredRuntime(server, instanceId).config.tickRateMs);
    server.instanceManager.tickInstance(instanceId);
    await executor.submit(leader, "invite-alliance-member", {
      allianceId,
      targetPlayerId: bots[(groupCount * 4 + group) % bots.length]!.playerId
    }, {
      rejectionExpectation: EXPECTED_GAMEPLAY(
        ["ALLIANCE_FULL", "TARGET_ALREADY_IN_ALLIANCE"],
        "Deliberate alliance-capacity probe after canonical membership setup."
      ),
      decisionContext: { probe: "alliance-capacity" }
    });
    advanceOneTick(server, clock, instanceId);
  }
};

export const exerciseMarketConcurrency = async (
  executor: CommandExecutor,
  server: ServerApp,
  instanceId: string,
  bots: SimulationBot[]
): Promise<boolean> => {
  const seller = bots.find((bot) => bot.archetype === "market-trader") ?? bots[0]!;
  const buyers = bots.filter((bot) => bot.playerId !== seller.playerId).slice(0, 2);
  const warehouseConfig = requiredRuntime(server, instanceId).config.balance.warehouse;
  if (!warehouseConfig) return false;
  const capacityDiagnostics: Array<Record<string, unknown>> = [];
  for (const buyer of buyers) {
    const capacity = canPlayerReceiveResource(
      requiredRuntime(server, instanceId).state,
      buyer.playerId,
      "chemicals",
      1,
      warehouseConfig
    );
    capacityDiagnostics.push({ buyerId: buyer.playerId, ...capacity });
    if (!capacity.allowed) {
      const amountToEscrow = Math.max(1, capacity.currentAmount - Number(capacity.maxAmount ?? capacity.currentAmount) + 1);
      const escrowed = await executor.submit(buyer, "create-player-market-listing", {
        resourceId: "chemicals", amount: amountToEscrow, unitPrice: 25, paymentType: "cleanCash"
      });
      if (!escrowed.accepted) {
        console.log(`[full-game market-concurrency] ${JSON.stringify({ capacityDiagnostics, escrowFailure: escrowed.reason })}`);
        return false;
      }
    }
  }
  const created = await executor.submit(seller, "create-player-market-listing", {
    resourceId: "chemicals", amount: 1, unitPrice: 25, paymentType: "cleanCash"
  });
  if (!created.accepted) {
    console.log(`[full-game market-concurrency] ${JSON.stringify({ capacityDiagnostics, sellerFailure: created.reason })}`);
    return false;
  }
  const runtime = requiredRuntime(server, instanceId);
  const listings = (runtime.state.market as { playerListings?: Array<{ id: string; sellerPlayerId: string; status: string }> } | undefined)?.playerListings ?? [];
  const listing = listings.find((entry) => entry.sellerPlayerId === seller.playerId && entry.status === "active");
  if (!listing) {
    console.log(`[full-game market-concurrency] ${JSON.stringify({ capacityDiagnostics, listingMissing: true })}`);
    return false;
  }
  const expectedVersion = runtime.state.root.version;
  const results = await Promise.all(buyers.map((buyer) => executor.submit(buyer, "buy-player-market-listing", {
    listingId: listing.id
  }, {
    expectedStateVersion: expectedVersion,
    rejectionExpectation: EXPECTED_CONCURRENCY(
      ["market_listing_not_found", "market_listing_not_active", "STATE_VERSION_MISMATCH", "server.state_version_conflict"],
      "Two buyers intentionally submit against the same active listing and state version."
    ),
    decisionContext: { probe: "single-listing-two-buyer-race", listingId: listing.id }
  })));
  const accepted = results.filter((entry) => entry.accepted).length;
  console.log(`[full-game market-concurrency] ${JSON.stringify({
    capacityDiagnostics,
    listingId: listing.id,
    accepted,
    results: results.map((entry) => ({ accepted: entry.accepted, reason: entry.reason }))
  })}`);
  return accepted === 1;
};

export const exerciseIdempotence = async (
  executor: CommandExecutor,
  server: ServerApp,
  instanceId: string,
  bot: SimulationBot
): Promise<boolean> => {
  const commandId = `full-game:idempotence:${bot.playerId}`;
  const payload = { body: "Matrix idempotence probe" };
  const before = Object.keys(requiredRuntime(server, instanceId).state.cityChatMessagesById ?? {}).length;
  const first = await executor.submit(bot, "send-city-chat-message", payload, { commandId });
  const second = await executor.submit(bot, "send-city-chat-message", payload, { commandId });
  const after = Object.keys(requiredRuntime(server, instanceId).state.cityChatMessagesById ?? {}).length;
  return first.accepted && second.accepted && after === before + 1;
};

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
    synchronizePlayerCityEvents(structuredClone(state), bot.playerId, { config: runtime.config, clock }),
    bot.playerId,
    { config: runtime.config, clock }
  );
  for (const reward of observedCityView?.pendingRewards ?? []) {
    executor.recordCityEventRewardObservation(reward.pendingRewardId, reward.canClaim);
  }
  const candidates = createCandidates(state, runtime.config, bot, clock, rng);
  while (candidates.length > 0) {
    const claimIndex = candidates.findIndex((candidate) => candidate.type === "claim-city-event-reward");
    const freeCapacityIndex = candidates.findIndex((candidate) => candidate.decisionContext.purpose === "free-capacity-for-city-event-reward");
    const playerMarketBuyIndex = candidates.findIndex((candidate) => candidate.type === "buy-player-market-listing");
    const playerMarketCreateIndex = ["market-trader", "economist", "opportunist", "balanced"].includes(bot.archetype)
      ? candidates.findIndex((candidate) => candidate.type === "create-player-market-listing")
      : -1;
    const playerMarketIndex = playerMarketBuyIndex >= 0 ? playerMarketBuyIndex : playerMarketCreateIndex;
    const priorityIndex = claimIndex >= 0 ? claimIndex : freeCapacityIndex >= 0 ? freeCapacityIndex : playerMarketIndex;
    const selected = priorityIndex >= 0
      ? String(priorityIndex)
      : rng.weightedPick(Object.fromEntries(candidates.map((candidate, index) => [String(index), candidate.weight])));
    const selectedIndex = Number(selected);
    const candidate = candidates[selectedIndex] ?? candidates[0]!;
    const preview = previewCandidate(state, runtime.config, bot, candidate, clock);
    if (!preview.accepted) {
      executor.recordDecisionSkip(bot, candidate.type, preview.reasonCode);
      candidates.splice(Number.isInteger(selectedIndex) && selectedIndex >= 0 ? selectedIndex : 0, 1);
      continue;
    }
    await executor.submit(bot, candidate.type, candidate.payload, {
      decisionContext: candidate.decisionContext
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
  const candidate: Candidate = {
    type: "attack-district",
    payload: conflictPayload(selected.source, selected.target, {
    districtId: selected.target.id,
    sourceDistrictId: selected.source.id,
    weapons: attackWeapons(player.attackLoadout, getAttackWeaponInventory(state, player))
    }),
    weight: 1,
    decisionContext: { source: selected.source.id, target: selected.target.id, authorized: true, bountyTarget: bountyTargets.includes(selected) }
  };
  const preview = previewCandidate(state, requiredRuntime(server, instanceId).config, bot, candidate);
  if (!preview.accepted) {
    executor.recordDecisionSkip(bot, candidate.type, preview.reasonCode);
    return;
  }
  await executor.submit(bot, candidate.type, candidate.payload, { decisionContext: candidate.decisionContext });
};

const createCandidates = (
  state: CoreGameState,
  config: ReturnType<typeof requiredRuntime>["config"],
  bot: SimulationBot,
  clock: MutableSimulationClock,
  rng: SeededRng
): Candidate[] => {
  const player = state.playersById[bot.playerId]!;
  const owned = Object.values(state.districtsById).filter((district) => district.ownerPlayerId === bot.playerId && district.status !== "destroyed");
  const sources = owned.filter((district) => district.adjacentDistrictIds.length > 0);
  const source = pickOptional(rng, sources.length ? sources : owned);
  if (!source) return [];
  const adjacent = source.adjacentDistrictIds.map((id) => state.districtsById[id]).filter(Boolean);
  const neutral = adjacent.filter((district) => !district.ownerPlayerId && district.status !== "destroyed" && district.status !== "locked");
  const enemy = adjacent.filter((district) =>
    district.ownerPlayerId
    && district.ownerPlayerId !== bot.playerId
    && district.status !== "destroyed"
    && resolveDistrictRelation(state, player, district) === "enemy"
  );
  const resource = state.resourceStatesById[player.resourceStateId];
  const buildings = owned.flatMap((district) => district.buildingIds.map((id) => state.buildingsById[id]).filter(Boolean))
    .filter((building) => building.status === "active");
  const weight = weights(bot.archetype);
  const candidates: Candidate[] = [];

  const spyTarget = pickOptional(rng, [...neutral, ...enemy]);
  if (spyTarget) candidates.push(candidate("spy-district", { districtId: spyTarget.id, sourceDistrictId: source.id }, weight.spy, {
    source: source.id, target: spyTarget.id, relation: resolveDistrictRelation(state, player, spyTarget)
  }));
  const robberyTarget = pickOptional(rng, neutral.filter((district) => district.neutralLootPool));
  if (robberyTarget) candidates.push(candidate("rob-district", conflictPayload(source, robberyTarget, {
    targetDistrictId: robberyTarget.id,
    expectedLootPoolRevision: robberyTarget.neutralLootPool?.version
  }), weight.crime, { source: source.id, target: robberyTarget.id, lootPoolVersion: robberyTarget.neutralLootPool?.version ?? null }));
  const enemyTarget = pickOptional(rng, enemy);
  if (enemyTarget) {
    const style = rng.pick(["stealth", "balanced", "all_in"] as const);
    candidates.push(candidate("heist-district", conflictPayload(source, enemyTarget, {
      targetDistrictId: enemyTarget.id,
      sourceDistrictId: source.id,
      style,
      gangMembersSent: style === "all_in" ? 25 : style === "balanced" ? 10 : 5
    }), weight.crime, { source: source.id, target: enemyTarget.id, style }));
  }
  const authorizedEnemyTarget = pickOptional(rng, enemy.filter((district) =>
    hasValidAttackAuthorization(state, bot.playerId, district.id)
  ));
  if (authorizedEnemyTarget) {
    candidates.push(candidate("attack-district", conflictPayload(source, authorizedEnemyTarget, {
      districtId: authorizedEnemyTarget.id,
      sourceDistrictId: source.id,
      weapons: attackWeapons(player.attackLoadout, getAttackWeaponInventory(state, player))
    }), weight.attack, { source: source.id, target: authorizedEnemyTarget.id, authorized: true }));
  }
  const occupyTarget = pickOptional(rng, neutral.filter((district) =>
    validateOccupyEmptyDistrictAuthorization(state, bot.playerId, district.id) === true
  ));
  if (occupyTarget) candidates.push(candidate("occupy-district", conflictPayload(source, occupyTarget, {
    districtId: occupyTarget.id,
    sourceDistrictId: source.id
  }), weight.expand, { source: source.id, target: occupyTarget.id, authorization: "current-intel" }));

  const upgradeable = buildings.filter((building) => {
    const upgrade = resolveBuildingUpgradeCost(building, { config, clock });
    return upgrade && resource && hasEnoughResourcesForUpgrade(resource, upgrade.costs);
  });
  const upgradeBuilding = pickOptional(rng, upgradeable);
  if (upgradeBuilding) {
    candidates.push(candidate("upgrade-building", {
      districtId: upgradeBuilding.districtId,
      buildingId: upgradeBuilding.id
    }, weight.economy, { buildingId: upgradeBuilding.id, currentLevel: upgradeBuilding.level, prerequisites: "canonical-upgrade-cost-satisfied" }));
  }

  const productionBuilding = pickOptional(rng, buildings.filter((building) => firstRecipeId(config, building.buildingTypeId)));
  if (productionBuilding) {
    const district = state.districtsById[productionBuilding.districtId]!;
    const recipeId = firstRecipeId(config, productionBuilding.buildingTypeId)!;
    candidates.push(candidate("craft-item", {
      districtId: district.id,
      buildingId: productionBuilding.id,
      recipeId,
      quantity: 1
    }, weight.production, { buildingId: productionBuilding.id, recipeId, buildingStatus: productionBuilding.status }));
  }
  const collectible = buildings.flatMap((building) => {
    const recipeId = firstRecipeId(config, building.buildingTypeId);
    if (!recipeId) return [];
    const payload = { districtId: building.districtId, buildingId: building.id, resourceKey: recipeId };
    return [candidate("collect-production", payload, weight.production * 2, {
      buildingId: building.id,
      recipeId,
      readiness: "must-pass-canonical-command-preview"
    })];
  });
  const collectCandidate = pickOptional(rng, collectible);
  if (collectCandidate) candidates.push(collectCandidate);

  const buildingActions = buildings.flatMap((building) => Object.values(config.balance.buildingActions ?? {})
    .filter((action) => action.buildingType === building.buildingTypeId)
    .map((action) => candidate("run-building-action", {
      districtId: building.districtId,
      buildingId: building.id,
      actionId: action.actionId
    }, weight.economy, { buildingId: building.id, actionId: action.actionId, buildingStatus: building.status })));
  const buildingAction = pickOptional(rng, buildingActions);
  if (buildingAction) candidates.push(buildingAction);

  const defense = rng.pick(["vest", "barricades", "cameras", "alarm", "defense-tower"] as const);
  if (Number(resource?.balances[defense] ?? 0) > 0) candidates.push(candidate("place-defense", {
    targetDistrictId: source.id,
    defenseItemId: defense,
    amount: 1,
    expectedTargetVersion: source.version
  }, weight.defense, { target: source.id, defense, inventory: Number(resource?.balances[defense] ?? 0) }));

  const marketView = getMarketViewModel(structuredClone(state), player, clock.now().getTime(), { config }) as {
    resources?: Array<{ id: string; normalMarket?: { canBuy?: boolean; price?: number } }>;
    playerMarket?: { listings?: Array<{ id: string; sellerPlayerId: string; resourceId: string; amount: number; unitPrice: number; paymentType: string; canBuy?: boolean }> };
  };
  const resourceNeed = resolveResourceNeed(state, config, bot.playerId, buildings);
  const normalOffer = marketView.resources?.filter((entry) => entry.normalMarket?.canBuy)
    .filter((entry) => (resourceNeed.get(entry.id) ?? 0) > 0)
    .sort((left, right) => (resourceNeed.get(right.id) ?? 0) - (resourceNeed.get(left.id) ?? 0))[0];
  if (normalOffer && config.balance.warehouse
    && canPlayerReceiveResource(state, bot.playerId, normalOffer.id, 1, config.balance.warehouse).allowed) {
    candidates.push(candidate("buy-market-resource", {
      resourceId: normalOffer.id,
      amount: 1,
      marketType: "normal",
      paymentType: "cleanCash"
    }, weight.market, {
      resourceId: normalOffer.id,
      offerAvailable: true,
      affordable: true,
      capacityAvailable: true,
      requiredAmount: resourceNeed.get(normalOffer.id) ?? 0
    }));
  }

  const activeListing = marketView.playerMarket?.listings?.filter((listing) => listing.canBuy)
    .filter((listing) => config.balance.warehouse
      && canPlayerReceiveResource(state, bot.playerId, listing.resourceId, listing.amount, config.balance.warehouse).allowed)
    .filter((listing) => (resourceNeed.get(listing.resourceId) ?? 0) > 0
      || Number(resource?.balances[listing.resourceId] ?? 0) < PLAYER_MARKET_BUYER_RESERVE)
    .sort((left, right) => (resourceNeed.get(right.resourceId) ?? 0) - (resourceNeed.get(left.resourceId) ?? 0)
      || left.unitPrice - right.unitPrice)[0];
  if (activeListing) candidates.push(candidate("buy-player-market-listing", {
    listingId: activeListing.id
  }, weight.market * (bot.archetype === "market-trader" ? 2 : 1), {
    listingId: activeListing.id,
    sellerPlayerId: activeListing.sellerPlayerId,
    resourceId: activeListing.resourceId,
    amount: activeListing.amount,
    affordable: true,
    capacityAvailable: true
  }));

  const ownActiveListings = ((state.market as { playerListings?: Array<{ sellerPlayerId: string; status: string; expiresAt: number }> } | undefined)?.playerListings ?? [])
    .filter((listing) => listing.sellerPlayerId === bot.playerId && listing.status === "active" && listing.expiresAt > clock.now().getTime()).length;
  if (ownActiveListings === 0 && resource) {
    const aggregateDemand = resolveAggregateMarketDemand(state, config, bot.playerId);
    const ownNeed = resolveResourceNeed(state, config, bot.playerId, buildings);
    const surplus = (marketView.resources ?? [])
      .map((resourceId) => ({
        resourceId: resourceId.id,
        amount: Math.max(0, Math.floor(Number(resource.balances[resourceId.id] ?? 0))
          - Math.max(PLAYER_MARKET_SELLER_RESERVE, ownNeed.get(resourceId.id) ?? 0)),
        demand: aggregateDemand.get(resourceId.id) ?? 0
      }))
      .filter((entry) => entry.amount >= 2 && entry.demand > 0)
      .sort((left, right) => right.demand - left.demand || right.amount - left.amount)[0];
    if (surplus) {
      const referencePrice = marketView.resources?.find((entry) => entry.id === surplus.resourceId)?.normalMarket?.price ?? 25;
      candidates.push(candidate("create-player-market-listing", {
        resourceId: surplus.resourceId,
        amount: Math.min(2, surplus.amount),
        unitPrice: Math.max(1, Math.floor(referencePrice * 0.8)),
        paymentType: "cleanCash"
      }, weight.market, {
        resourceId: surplus.resourceId,
        surplus: surplus.amount,
        aggregateDemand: surplus.demand,
        activeListings: 0,
        pricing: "80pct-normal-market"
      }));
    }
  }

  const activeCreatedBounties = Object.values(state.bountiesById ?? {}).filter((bounty) =>
    bounty.createdByPlayerId === bot.playerId && bounty.status === "active"
  );
  const bountyTarget = activeCreatedBounties.length === 0 ? pickOptional(rng, findReachableBountyTargets(state, bot.playerId)) : null;
  if (bountyTarget && Number(resource?.balances.cleanCash ?? resource?.balances.cash ?? 0) >= BOUNTY_MIN_REWARD_CLEAN_CASH) {
    candidates.push(candidate("create-bounty", {
      targetPlayerId: bountyTarget.id,
      objectiveType: "attack-player",
      rewardCleanCash: BOUNTY_MIN_REWARD_CLEAN_CASH,
      durationHours: BOUNTY_DURATION_OPTIONS_HOURS[1]
    }, weight.bounty, { targetPlayerId: bountyTarget.id, activeCreatedBounties: 0, reachableByAnotherPlayer: true }));
  }

  const cityPreview = synchronizePlayerCityEvents(structuredClone(state), bot.playerId, { config, clock });
  const cityView = createPlayerCityEventsView(cityPreview, bot.playerId, { config, clock });
  const offer = cityView?.agents.flatMap((agent) => agent.offers).find((entry) => entry.canStart);
  if (offer) candidates.push(candidate("start-city-event", { offerId: offer.offerId }, 0.7, {
    offerId: offer.offerId, canStart: true, activeRun: false
  }));
  const pendingReward = cityView?.pendingRewards.find((entry) => entry.canClaim);
  if (pendingReward) candidates.push(candidate("claim-city-event-reward", {
    pendingRewardId: pendingReward.pendingRewardId
  }, 4, { pendingRewardId: pendingReward.pendingRewardId, resourceKey: pendingReward.resourceKey, canClaim: true }));
  const blockedReward = cityView?.pendingRewards.find((entry) => !entry.canClaim);
  if (blockedReward && ownActiveListings === 0 && resource && marketView.resources?.some((entry) => entry.id === blockedReward.resourceKey)) {
    const availableAmount = Math.floor(Number(resource.balances[blockedReward.resourceKey] ?? 0));
    if (availableAmount > 0) {
      const referencePrice = marketView.resources.find((entry) => entry.id === blockedReward.resourceKey)?.normalMarket?.price ?? 25;
      candidates.push(candidate("create-player-market-listing", {
        resourceId: blockedReward.resourceKey,
        amount: Math.max(1, Math.min(availableAmount, blockedReward.amount)),
        unitPrice: Math.max(1, Math.floor(referencePrice * 0.7)),
        paymentType: "cleanCash"
      }, 5, {
        resourceId: blockedReward.resourceKey,
        purpose: "free-capacity-for-city-event-reward",
        pendingRewardId: blockedReward.pendingRewardId
      }));
    }
  }

  return candidates.filter((entry) => entry.weight > 0);
};

const conflictPayload = (source: CoreGameState["districtsById"][string], target: CoreGameState["districtsById"][string], payload: Record<string, unknown>) => ({
  ...payload,
  expectedConflictRevision: target.conflictRevision,
  expectedSourceVersion: source.version,
  expectedTargetVersion: target.version
});

const candidate = (
  type: GameCommand["type"],
  payload: Record<string, unknown>,
  weight: number,
  decisionContext: Record<string, unknown>
): Candidate => ({ type, payload, weight, decisionContext });

const previewCommand = (
  bot: SimulationBot,
  type: GameCommand["type"],
  payload: Record<string, unknown>,
  issuedAt: string,
  serverInstanceId: string
): GameCommand => ({
  id: `full-game-preview:${bot.playerId}:${type}`,
  type,
  mode: "free",
  playerId: bot.playerId,
  serverInstanceId,
  issuedAt,
  clientRequestId: `full-game-preview:${bot.playerId}:${type}`,
  payload
} as GameCommand);

const previewCandidate = (
  state: CoreGameState,
  config: ReturnType<typeof requiredRuntime>["config"],
  bot: SimulationBot,
  entry: Candidate,
  clock?: MutableSimulationClock
): { accepted: boolean; reasonCode: string } => {
  const command = previewCommand(
    bot,
    entry.type,
    entry.payload,
    clock?.nowIso() ?? new Date(0).toISOString(),
    state.serverInstance.id
  );
  const result = applyCommand(structuredClone(state), command, clock ? { config, clock } : { config });
  return {
    accepted: result.errors.length === 0,
    reasonCode: result.errors[0]?.code ?? "PREVIEW_ACCEPTED"
  };
};

const findReachableBountyTargets = (
  state: CoreGameState,
  creatorPlayerId: string
): CoreGameState["playersById"][string][] => Object.values(state.playersById).filter((target) => {
  if (target.id === creatorPlayerId || target.status !== "active") return false;
  const targetDistrictIds = Object.values(state.districtsById)
    .filter((district) => district.ownerPlayerId === target.id && district.status !== "destroyed")
    .map((district) => district.id);
  return Object.values(state.playersById).some((hunter) => {
    if (hunter.id === creatorPlayerId || hunter.id === target.id || hunter.status !== "active") return false;
    return Object.values(state.districtsById).some((source) =>
      source.ownerPlayerId === hunter.id
      && source.status !== "destroyed"
      && source.adjacentDistrictIds.some((targetDistrictId) => targetDistrictIds.includes(targetDistrictId))
    );
  });
});

const resolveResourceNeed = (
  state: CoreGameState,
  config: ReturnType<typeof requiredRuntime>["config"],
  playerId: string,
  buildings: CoreGameState["buildingsById"][string][]
): Map<string, number> => {
  const player = state.playersById[playerId];
  const balances = player ? state.resourceStatesById[player.resourceStateId]?.balances ?? {} : {};
  const needs = new Map<string, number>();
  const addCosts = (costs: Record<string, number> | undefined): void => {
    for (const [resourceId, amount] of Object.entries(costs ?? {})) {
      const missing = Math.max(0, Math.ceil(Number(amount) - Number(balances[resourceId] ?? 0)));
      if (missing > 0) needs.set(resourceId, Math.max(needs.get(resourceId) ?? 0, missing));
    }
  };
  for (const building of buildings) addCosts(resolveBuildingUpgradeCost(building, { config })?.costs);
  for (const action of Object.values(config.balance.buildingActions ?? {})) {
    if (buildings.some((building) => building.buildingTypeId === action.buildingType)) addCosts(action.inputCost);
  }
  return needs;
};

const resolveAggregateMarketDemand = (
  state: CoreGameState,
  config: ReturnType<typeof requiredRuntime>["config"],
  sellerPlayerId: string
): Map<string, number> => {
  const demand = new Map<string, number>();
  for (const player of Object.values(state.playersById)) {
    if (player.id === sellerPlayerId || player.status !== "active") continue;
    const buildings = Object.values(state.buildingsById).filter((building) =>
      building.ownerPlayerId === player.id && building.status === "active"
    );
    for (const [resourceId, amount] of resolveResourceNeed(state, config, player.id, buildings)) {
      demand.set(resourceId, (demand.get(resourceId) ?? 0) + amount);
    }
    const balances = state.resourceStatesById[player.resourceStateId]?.balances ?? {};
    for (const resourceId of ["chemicals", "biomass", "metal-parts", "stim-pack"]) {
      const reserveNeed = Math.max(0, PLAYER_MARKET_BUYER_RESERVE - Math.floor(Number(balances[resourceId] ?? 0)));
      if (reserveNeed > 0) demand.set(resourceId, (demand.get(resourceId) ?? 0) + reserveNeed);
    }
  }
  return demand;
};

const advanceOneTick = (
  server: ServerApp,
  clock: MutableSimulationClock,
  instanceId: string
): void => {
  const runtime = requiredRuntime(server, instanceId);
  clock.advance(runtime.config.tickRateMs);
  server.instanceManager.tickInstance(instanceId);
};

const pickOptional = <T>(rng: SeededRng, values: readonly T[]): T | null =>
  values.length > 0 ? rng.pick(values) : null;

const attackWeapons = (
  loadout: Record<string, number> | undefined,
  inventory: Record<string, number> = {}
): Record<string, number> => {
  const available = Object.keys(inventory).length > 0 ? inventory : loadout ?? {};
  const selected = Object.fromEntries(Object.entries(available)
    .filter(([, amount]) => Number(amount) > 0)
    .slice(0, 3)
    .map(([weaponId, amount]) => [weaponId, Math.min(5, Math.floor(Number(amount)))]));
  return Object.keys(selected).length ? selected : { pistol: 1 };
};

const firstRecipeId = (config: ReturnType<typeof requiredRuntime>["config"], buildingType: string): string | null => {
  const key = buildingType === "drug_lab" ? "drugLab" : buildingType;
  const recipes = (config.balance as unknown as Record<string, { recipes?: Record<string, unknown> }>)[key]?.recipes;
  return recipes ? Object.keys(recipes)[0] ?? null : null;
};

const weights = (archetype: SimulationBot["archetype"]) => {
  const base = { attack: 1, defense: 1, economy: 1, production: 1, market: 1, spy: 1, crime: 1, expand: 1, bounty: 0.5 };
  const boosts: Record<SimulationBot["archetype"], Partial<typeof base>> = {
    aggressor: { attack: 5, expand: 3, bounty: 2 }, turtle: { defense: 6, economy: 2 }, economist: { economy: 5, production: 5, market: 3 },
    expander: { expand: 6, spy: 2, attack: 2 }, spymaster: { spy: 7, attack: 2 }, "high-heat-criminal": { crime: 7, attack: 3 },
    stealth: { spy: 4, crime: 1, attack: 0.5 }, "market-trader": { market: 8, economy: 3 }, "bounty-hunter": { bounty: 7, attack: 4 },
    "alliance-diplomat": { economy: 2, defense: 2 }, opportunist: { attack: 3, expand: 4, market: 2 }, balanced: {}
  };
  return { ...base, ...boosts[archetype] };
};

const requiredRuntime = (server: ServerApp, instanceId: string) => {
  const runtime = server.instanceManager.getInstanceById(instanceId);
  if (!runtime) throw new Error(`Runtime ${instanceId} is missing.`);
  return runtime;
};

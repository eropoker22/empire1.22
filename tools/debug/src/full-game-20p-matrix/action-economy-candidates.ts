import {
  canPlayerReceiveResource,
  createPlayerCityEventsView,
  getMarketViewModel,
  synchronizePlayerCityEvents,
  type CoreGameState
} from "@empire/game-core";
import {
  BOUNTY_DURATION_OPTIONS_HOURS,
  BOUNTY_MIN_REWARD_CLEAN_CASH
} from "@empire/shared-types";
import type { SeededRng } from "../free-br-simulation/seeded-rng";
import type { MutableSimulationClock } from "./mutable-clock";
import type { SimulationBot } from "./types";
import {
  PLAYER_MARKET_BUYER_RESERVE,
  PLAYER_MARKET_SELLER_RESERVE,
  candidate,
  findReachableBountyTargets,
  pickOptional,
  requiredRuntime,
  resolveAggregateMarketDemand,
  resolveResourceNeed,
  type Candidate,
  weights
} from "./action-candidate-utils";

interface EconomyCandidateInput {
  state: CoreGameState;
  config: ReturnType<typeof requiredRuntime>["config"];
  bot: SimulationBot;
  clock: MutableSimulationClock;
  rng: SeededRng;
  buildings: CoreGameState["buildingsById"][string][];
  resource: CoreGameState["resourceStatesById"][string] | undefined;
  candidates: Candidate[];
  weight: ReturnType<typeof weights>;
}

export const appendEconomyCandidates = (input: EconomyCandidateInput): void => {
  const { state, config, bot, clock, rng, buildings, resource, candidates, weight } = input;
  const player = state.playersById[bot.playerId]!;
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

  const ownActiveListings = ((state.market as {
    playerListings?: Array<{ sellerPlayerId: string; status: string; expiresAt: number }>;
  } | undefined)?.playerListings ?? []).filter((listing) =>
    listing.sellerPlayerId === bot.playerId
    && listing.status === "active"
    && listing.expiresAt > clock.now().getTime()
  ).length;
  if (ownActiveListings === 0 && resource) {
    const aggregateDemand = resolveAggregateMarketDemand(state, config, bot.playerId);
    const ownNeed = resolveResourceNeed(state, config, bot.playerId, buildings);
    const surplus = (marketView.resources ?? []).map((resourceEntry) => ({
      resourceId: resourceEntry.id,
      amount: Math.max(0, Math.floor(Number(resource.balances[resourceEntry.id] ?? 0))
        - Math.max(PLAYER_MARKET_SELLER_RESERVE, ownNeed.get(resourceEntry.id) ?? 0)),
      demand: aggregateDemand.get(resourceEntry.id) ?? 0
    })).filter((entry) => entry.amount >= 2 && entry.demand > 0)
      .sort((left, right) => right.demand - left.demand || right.amount - left.amount)[0];
    if (surplus) {
      const referencePrice = marketView.resources?.find((entry) =>
        entry.id === surplus.resourceId
      )?.normalMarket?.price ?? 25;
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
  const bountyTarget = activeCreatedBounties.length === 0
    ? pickOptional(rng, findReachableBountyTargets(state, bot.playerId))
    : null;
  if (bountyTarget && Number(resource?.balances.cleanCash ?? resource?.balances.cash ?? 0) >= BOUNTY_MIN_REWARD_CLEAN_CASH) {
    candidates.push(candidate("create-bounty", {
      targetPlayerId: bountyTarget.id,
      objectiveType: "attack-player",
      rewardCleanCash: BOUNTY_MIN_REWARD_CLEAN_CASH,
      durationHours: BOUNTY_DURATION_OPTIONS_HOURS[1]
    }, weight.bounty, {
      targetPlayerId: bountyTarget.id,
      activeCreatedBounties: 0,
      reachableByAnotherPlayer: true
    }));
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
  }, 4, {
    pendingRewardId: pendingReward.pendingRewardId,
    resourceKey: pendingReward.resourceKey,
    canClaim: true
  }));
  const blockedReward = cityView?.pendingRewards.find((entry) => !entry.canClaim);
  if (blockedReward && ownActiveListings === 0 && resource
    && marketView.resources?.some((entry) => entry.id === blockedReward.resourceKey)) {
    const availableAmount = Math.floor(Number(resource.balances[blockedReward.resourceKey] ?? 0));
    if (availableAmount > 0) {
      const referencePrice = marketView.resources.find((entry) =>
        entry.id === blockedReward.resourceKey
      )?.normalMarket?.price ?? 25;
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
};

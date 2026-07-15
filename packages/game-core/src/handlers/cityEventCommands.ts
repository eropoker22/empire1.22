import type { CityEventCommand, PlayerCityEventOffer } from "@empire/shared-types";
import type { CoreGameState } from "../entities";
import type { GameCoreContext } from "../engine/context";
import type { CoreError } from "../errors";
import type { CoreEvent } from "../events";
import { CORE_EVENT_TYPES, createEvent, createNotification } from "../events";
import { calculateReceivableResourceAmount } from "./storageCapacityCredit";
import { composeEntityId } from "../utils";
import {
  completeDuePlayerCityEvents,
  getPlayerCityEventState,
  synchronizePlayerCityEvents
} from "../rules/city-events/cityEventLifecycle";

type Result = { nextState: CoreGameState; events: CoreEvent[]; errors: CoreError[] };

const rejected = (state: CoreGameState, code: string, message: string): Result => ({
  nextState: state,
  events: [],
  errors: [{ code, message }]
});

const findOffer = (state: CoreGameState, playerId: string, offerId: string): PlayerCityEventOffer | null =>
  Object.values(getPlayerCityEventState(state, playerId).offersByAgent)
    .flat()
    .find((offer) => offer.offerId === offerId) ?? null;

export const handleCityEventCommand = (
  state: CoreGameState,
  command: CityEventCommand,
  context: GameCoreContext
): Result => {
  const config = context.config.balance.cityEvents;
  const player = state.playersById[command.playerId];
  if (!config?.enabled || !player) return rejected(state, "city_event_unavailable", "Pouliční zakázky nejsou dostupné.");
  const caughtUp = completeDuePlayerCityEvents(synchronizePlayerCityEvents(state, player.id, context), context).nextState;
  return command.type === "start-city-event"
    ? startCityEvent(caughtUp, command, context)
    : claimCityEventReward(caughtUp, command, context);
};

const startCityEvent = (
  state: CoreGameState,
  command: Extract<CityEventCommand, { type: "start-city-event" }>,
  context: GameCoreContext
): Result => {
  const player = state.playersById[command.playerId];
  const cityState = getPlayerCityEventState(state, player.id);
  if (cityState.activeRun) return rejected(state, "city_event_already_active", "Nejdřív dokonči aktivní zakázku.");
  const offer = findOffer(state, player.id, command.payload.offerId);
  if (!offer) return rejected(state, "city_event_offer_not_found", "Tato nabídka už není dostupná.");
  if (offer.expiresAtTick <= state.root.tick || offer.status !== "available" || cityState.attemptedOfferIds.includes(offer.offerId)) {
    return rejected(state, "city_event_offer_attempted", "Tuto nabídku už nelze spustit.");
  }
  const schedule = context.config.balance.cityEvents!.agents[offer.agentId];
  const influence = Object.values(state.districtsById)
    .filter((district) => district.ownerPlayerId === player.id && district.status !== "destroyed")
    .reduce((total, district) => total + Math.max(0, Number(district.influence || 0)), 0);
  if (influence < schedule.requiredInfluence) return rejected(state, "city_event_locked", "Pro tuto postavu nemáš dost vlivu.");
  const resources = state.resourceStatesById[player.resourceStateId];
  if (!resources) return rejected(state, "city_event_unavailable", "Hráčský účet nemá dostupné zdroje.");
  for (const [key, amount] of Object.entries(offer.riskSnapshot.startCost ?? {})) {
    if (Math.floor(Number(resources.balances[key] || 0)) < Number(amount || 0)) {
      return rejected(state, "city_event_start_cost_missing", "Nemáš zdroje potřebné ke spuštění zakázky.");
    }
  }

  const balances = { ...resources.balances };
  for (const [key, amount] of Object.entries(offer.riskSnapshot.startCost ?? {})) {
    balances[key] = Math.max(0, Number(balances[key] || 0) - Number(amount || 0));
  }
  const runId = composeEntityId("city-event-run", `${player.id}:${offer.offerId}`);
  const offersByAgent = { ...cityState.offersByAgent };
  offersByAgent[offer.agentId] = offersByAgent[offer.agentId].map((candidate) => candidate.offerId === offer.offerId
    ? { ...candidate, attemptedAtTick: state.root.tick, status: "running" as const }
    : candidate);
  const nextCityState = {
    ...cityState,
    offersByAgent,
    attemptedOfferIds: [...cityState.attemptedOfferIds, offer.offerId],
    activeRun: {
      runId,
      offerId: offer.offerId,
      playerId: player.id,
      startedAtTick: state.root.tick,
      completesAtTick: state.root.tick + offer.durationTicksSnapshot,
      deterministicOutcomeSeed: `${state.serverInstance.worldSeed}:${player.id}:${offer.offerId}:${runId}`,
      status: "running" as const
    },
    version: cityState.version + 1
  };
  const notificationId = composeEntityId("notification", `city-event:${runId}:started`);
  const notification = createNotification({
    id: notificationId,
    recipientType: "player",
    recipientId: player.id,
    category: "city.event",
    title: "Zakázka byla spuštěna.",
    bodyKey: "city.event.started",
    payload: { offerId: offer.offerId, runId, completesAtTick: nextCityState.activeRun.completesAtTick },
    createdAt: context.clock?.nowIso() ?? new Date(0).toISOString(),
    readAt: null
  });
  return {
    nextState: {
      ...state,
      playersById: {
        ...state.playersById,
        [player.id]: { ...player, lastActionAt: command.issuedAt, version: player.version + 1 }
      },
      resourceStatesById: {
        ...state.resourceStatesById,
        [resources.id]: { ...resources, balances, lastUpdatedTick: state.root.tick, version: resources.version + 1 }
      },
      playerCityEventStatesByPlayerId: {
        ...(state.playerCityEventStatesByPlayerId ?? {}),
        [player.id]: nextCityState
      },
      notificationsById: { ...state.notificationsById, [notification.id]: notification },
      root: { ...state.root, notificationIds: [...state.root.notificationIds, notification.id], version: state.root.version + 1 }
    },
    events: [
      createEvent(CORE_EVENT_TYPES.cityEventStarted, {
        playerId: player.id,
        offerId: offer.offerId,
        runId,
        completesAtTick: nextCityState.activeRun.completesAtTick
      }),
      createEvent(CORE_EVENT_TYPES.notificationCreated, {
        notificationId: notification.id,
        recipientId: player.id,
        category: notification.category
      })
    ],
    errors: []
  };
};

const claimCityEventReward = (
  state: CoreGameState,
  command: Extract<CityEventCommand, { type: "claim-city-event-reward" }>,
  context: GameCoreContext
): Result => {
  const player = state.playersById[command.playerId];
  const cityState = getPlayerCityEventState(state, player.id);
  const pending = cityState.pendingRewards.find((reward) => reward.pendingRewardId === command.payload.pendingRewardId);
  if (!pending) return rejected(state, "city_event_reward_not_found", "Tato odměna už není dostupná.");
  if (pending.resourceKey === "influence") {
    const district = Object.values(state.districtsById)
      .filter((candidate) => candidate.ownerPlayerId === player.id && candidate.status !== "destroyed")
      .sort((left, right) => Number(left.id === player.homeDistrictId ? -1 : 0) - Number(right.id === player.homeDistrictId ? -1 : 0)
        || left.id.localeCompare(right.id))[0];
    if (!district) return rejected(state, "city_event_reward_blocked", "Nejdřív potřebuješ aktivní vlastní district.");
    return claimed(state, player.id, cityState, pending.pendingRewardId, {
      ...state,
      districtsById: {
        ...state.districtsById,
        [district.id]: { ...district, influence: district.influence + pending.amount, version: district.version + 1 }
      }
    }, pending.amount);
  }
  const resources = state.resourceStatesById[player.resourceStateId];
  if (!resources || !context.config.balance.warehouse) {
    return rejected(state, "city_event_reward_blocked", "Ve SKLADU není místo pro odměnu.");
  }
  const receivable = calculateReceivableResourceAmount(
    state,
    player.id,
    pending.resourceKey,
    pending.amount,
    context.config.balance.warehouse
  );
  if (receivable <= 0) return rejected(state, "storage_capacity_full", "Ve SKLADU není místo pro odměnu.");
  const remaining = pending.amount - receivable;
  const nextCityState = {
    ...cityState,
    pendingRewards: remaining > 0
      ? cityState.pendingRewards.map((reward) => reward.pendingRewardId === pending.pendingRewardId ? { ...reward, amount: remaining } : reward)
      : cityState.pendingRewards.filter((reward) => reward.pendingRewardId !== pending.pendingRewardId),
    version: cityState.version + 1
  };
  const nextState: CoreGameState = {
    ...state,
    resourceStatesById: {
      ...state.resourceStatesById,
      [resources.id]: {
        ...resources,
        balances: {
          ...resources.balances,
          [pending.resourceKey]: Math.max(0, Number(resources.balances[pending.resourceKey] || 0)) + receivable
        },
        lastUpdatedTick: state.root.tick,
        version: resources.version + 1
      }
    },
    playerCityEventStatesByPlayerId: {
      ...(state.playerCityEventStatesByPlayerId ?? {}),
      [player.id]: nextCityState
    }
  };
  return {
    nextState,
    events: [createEvent(CORE_EVENT_TYPES.cityEventRewardClaimed, {
      playerId: player.id,
      pendingRewardId: pending.pendingRewardId,
      resourceKey: pending.resourceKey,
      amount: receivable,
      remaining
    })],
    errors: []
  };
};

const claimed = (
  originalState: CoreGameState,
  playerId: string,
  cityState: ReturnType<typeof getPlayerCityEventState>,
  pendingRewardId: string,
  mutatedState: CoreGameState,
  amount: number
): Result => ({
  nextState: {
    ...mutatedState,
    playerCityEventStatesByPlayerId: {
      ...(mutatedState.playerCityEventStatesByPlayerId ?? {}),
      [playerId]: {
        ...cityState,
        pendingRewards: cityState.pendingRewards.filter((reward) => reward.pendingRewardId !== pendingRewardId),
        version: cityState.version + 1
      }
    }
  },
  events: [createEvent(CORE_EVENT_TYPES.cityEventRewardClaimed, { playerId, pendingRewardId, amount })],
  errors: []
});

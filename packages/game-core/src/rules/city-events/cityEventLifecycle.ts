import type {
  PendingPlayerCityEventReward,
  PlayerCityEventAgentId,
  PlayerCityEventOffer,
  PlayerCityEventState
} from "@empire/shared-types";
import type { CityEventAgentScheduleConfig, CityEventDefinitionConfig } from "../../contracts";
import type { CoreGameState } from "../../entities";
import type { GameCoreContext } from "../../engine/context";
import type { CoreEvent } from "../../events";
import { CORE_EVENT_TYPES, createEvent, createNotification } from "../../events";
import { calculateReceivableResourceAmount } from "../../handlers/storageCapacityCredit";
import { increasePlayerPoliceHeat } from "../../handlers/playerPoliceState";
import { normalizeStorageResourceKey } from "../../handlers/storageCapacityTypes";
import { composeEntityId } from "../../utils";
import {
  createCityScheduleWindowId,
  resolveCityDayIndex,
  resolveCityMinuteOfDay,
  resolveNextCityTimeBoundaryTick,
  resolvePreviousCityTimeBoundaryTick
} from "../day-night/cityClock";

const AGENT_IDS: readonly PlayerCityEventAgentId[] = ["victor", "leon", "nyra"];

export const createEmptyPlayerCityEventState = (): PlayerCityEventState => ({
  version: 1,
  offersByAgent: { victor: [], leon: [], nyra: [] },
  activeRun: null,
  attemptedOfferIds: [],
  pendingRewards: [],
  lastProcessedScheduleWindowByAgent: {}
});

export const getPlayerCityEventState = (
  state: CoreGameState,
  playerId: string
): PlayerCityEventState => state.playerCityEventStatesByPlayerId?.[playerId] ?? createEmptyPlayerCityEventState();

const hash = (value: string): number => {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 16777619);
  }
  return result >>> 0;
};

const isAvailable = (schedule: CityEventAgentScheduleConfig, minuteOfDay: number): boolean => {
  if (!schedule.availability) return true;
  const opens = schedule.availability.opensAt.hour * 60 + schedule.availability.opensAt.minute;
  const closes = schedule.availability.closesAt.hour * 60 + schedule.availability.closesAt.minute;
  return opens < closes
    ? minuteOfDay >= opens && minuteOfDay < closes
    : minuteOfDay >= opens || minuteOfDay < closes;
};

interface ScheduleWindow {
  boundaryTick: number;
  boundaryHour: number;
  windowId: string;
  expiresAtTick: number;
}

const resolveScheduleWindow = (
  state: CoreGameState,
  context: GameCoreContext,
  schedule: CityEventAgentScheduleConfig
): ScheduleWindow => {
  const boundaries = schedule.refreshTimes.map((time) => ({
    time,
    tick: resolvePreviousCityTimeBoundaryTick(state, context, time.hour, time.minute)
  })).sort((left, right) => right.tick - left.tick);
  const current = boundaries[0];
  const nextRefresh = Math.min(...schedule.refreshTimes.map((time) =>
    resolveNextCityTimeBoundaryTick(state, context, time.hour, time.minute)));
  const closesAt = schedule.availability
    ? resolveNextCityTimeBoundaryTick(
        state,
        context,
        schedule.availability.closesAt.hour,
        schedule.availability.closesAt.minute,
        current.tick
      )
    : Number.POSITIVE_INFINITY;
  return {
    boundaryTick: current.tick,
    boundaryHour: current.time.hour,
    windowId: createCityScheduleWindowId(state, context, schedule.agentId, current.time),
    expiresAtTick: Math.min(nextRefresh, closesAt)
  };
};

const calculatePlayerInfluence = (state: CoreGameState, playerId: string): number =>
  Object.values(state.districtsById)
    .filter((district) => district.ownerPlayerId === playerId && district.status !== "destroyed")
    .reduce((total, district) => total + Math.max(0, Math.floor(Number(district.influence || 0))), 0);

const strategicAgentForDay = (state: CoreGameState, playerId: string, dayIndex: number): PlayerCityEventAgentId =>
  AGENT_IDS[hash(`${state.serverInstance.worldSeed}:${playerId}:city-event-strategic:${dayIndex}`) % AGENT_IDS.length];

const definitionDurationTicks = (definition: CityEventDefinitionConfig, context: GameCoreContext): number =>
  Math.max(1, Math.ceil(definition.durationMinutes * 60_000 / Math.max(1, context.config.tickRateMs)));

const generateOffers = (
  state: CoreGameState,
  context: GameCoreContext,
  playerId: string,
  agentId: PlayerCityEventAgentId,
  scheduleWindow: ScheduleWindow
): PlayerCityEventOffer[] => {
  const config = context.config.balance.cityEvents!;
  const dayIndex = resolveCityDayIndex(state, context, scheduleWindow.boundaryTick);
  const strategicOwner = strategicAgentForDay(state, playerId, dayIndex);
  const seed = `${state.serverInstance.worldSeed}:${playerId}:${agentId}:${scheduleWindow.windowId}`;
  const standard = config.definitions
    .filter((definition) => definition.agentId === agentId && definition.difficulty !== "rare")
    .sort((left, right) => hash(`${seed}:${left.id}`) - hash(`${seed}:${right.id}`) || left.id.localeCompare(right.id));
  const rare = config.definitions
    .filter((definition) => definition.agentId === agentId && definition.difficulty === "rare")
    .sort((left, right) => hash(`${seed}:rare:${left.id}`) - hash(`${seed}:rare:${right.id}`) || left.id.localeCompare(right.id));
  const selected = standard.slice(0, 3);
  if (scheduleWindow.boundaryHour === 22 && strategicOwner === agentId && rare[0]) selected[2] = rare[0];
  return selected.map((definition) => ({
    offerId: `${definition.id}:${scheduleWindow.windowId}`,
    definitionId: definition.id,
    agentId,
    scheduleWindowId: scheduleWindow.windowId,
    generatedAtTick: scheduleWindow.boundaryTick,
    expiresAtTick: scheduleWindow.expiresAtTick,
    attemptedAtTick: null,
    successRateSnapshot: definition.successRate,
    durationTicksSnapshot: definitionDurationTicks(definition, context),
    rewardSnapshot: { ...definition.reward } as Record<string, number>,
    riskSnapshot: { ...definition.risk },
    status: "available"
  }));
};

export const synchronizePlayerCityEvents = (
  state: CoreGameState,
  playerId: string,
  context: GameCoreContext
): CoreGameState => {
  const config = context.config.balance.cityEvents;
  if (!config?.enabled || !state.playersById[playerId]) return state;
  const current = getPlayerCityEventState(state, playerId);
  const minute = resolveCityMinuteOfDay(state, context);
  let changed = false;
  const offersByAgent = { ...current.offersByAgent };
  const windows = { ...current.lastProcessedScheduleWindowByAgent };
  for (const agentId of AGENT_IDS) {
    const schedule = config.agents[agentId];
    const available = isAvailable(schedule, minute);
    const scheduleWindow = resolveScheduleWindow(state, context, schedule);
    if (!available) {
      const expired = (offersByAgent[agentId] ?? []).map((offer) =>
        offer.status === "available" ? { ...offer, status: "expired" as const } : offer);
      if (expired.some((offer, index) => offer !== offersByAgent[agentId]?.[index])) {
        offersByAgent[agentId] = expired;
        changed = true;
      }
      continue;
    }
    if (windows[agentId] !== scheduleWindow.windowId) {
      offersByAgent[agentId] = generateOffers(state, context, playerId, agentId, scheduleWindow);
      windows[agentId] = scheduleWindow.windowId;
      changed = true;
    }
  }
  if (!changed) return state;
  return {
    ...state,
    playerCityEventStatesByPlayerId: {
      ...(state.playerCityEventStatesByPlayerId ?? {}),
      [playerId]: {
        ...current,
        offersByAgent,
        lastProcessedScheduleWindowByAgent: windows,
        version: current.version + 1
      }
    }
  };
};

const addPendingReward = (
  pending: PendingPlayerCityEventReward[],
  offerId: string,
  resourceKey: string,
  amount: number,
  tick: number,
  reason: PendingPlayerCityEventReward["reason"]
): PendingPlayerCityEventReward[] => amount <= 0 ? pending : [
  ...pending,
  {
    pendingRewardId: composeEntityId("city-event-reward", `${offerId}:${resourceKey}`),
    sourceOfferId: offerId,
    resourceKey,
    amount,
    reason,
    createdAtTick: tick
  }
];

const appendNotification = (
  state: CoreGameState,
  playerId: string,
  idSuffix: string,
  title: string,
  bodyKey: string,
  payload: Record<string, unknown>,
  context: GameCoreContext
): CoreGameState => {
  const id = composeEntityId("notification", `city-event:${playerId}:${idSuffix}`);
  if (state.notificationsById[id]) return state;
  const notification = createNotification({
    id,
    recipientType: "player",
    recipientId: playerId,
    category: "city.event",
    title,
    bodyKey,
    payload,
    createdAt: context.clock?.nowIso() ?? new Date(0).toISOString(),
    readAt: null
  });
  return {
    ...state,
    notificationsById: { ...state.notificationsById, [id]: notification },
    root: { ...state.root, notificationIds: [...state.root.notificationIds, id], version: state.root.version + 1 }
  };
};

const resolveReward = (
  state: CoreGameState,
  playerId: string,
  offer: PlayerCityEventOffer,
  context: GameCoreContext
): { state: CoreGameState; pending: PendingPlayerCityEventReward[] } => {
  const player = state.playersById[playerId];
  const resources = state.resourceStatesById[player.resourceStateId];
  if (!resources) return { state, pending: [] };
  let nextState = state;
  let balances = { ...resources.balances };
  let pending: PendingPlayerCityEventReward[] = [];
  for (const [rawKey, rawAmount] of Object.entries(offer.rewardSnapshot)) {
    const amount = Math.max(0, Math.floor(Number(rawAmount || 0)));
    if (!amount) continue;
    if (rawKey === "influence") {
      const district = Object.values(nextState.districtsById)
        .filter((candidate) => candidate.ownerPlayerId === playerId && candidate.status !== "destroyed")
        .sort((left, right) => Number(left.id === player.homeDistrictId ? -1 : 0) - Number(right.id === player.homeDistrictId ? -1 : 0)
          || left.id.localeCompare(right.id))[0];
      if (!district) pending = addPendingReward(pending, offer.offerId, rawKey, amount, nextState.root.tick, "missing-owned-district");
      else nextState = {
        ...nextState,
        districtsById: {
          ...nextState.districtsById,
          [district.id]: { ...district, influence: district.influence + amount, version: district.version + 1 }
        }
      };
      continue;
    }
    const key = rawKey === "cash" || rawKey === "dirty-cash" ? rawKey : normalizeStorageResourceKey(rawKey);
    const receivable = key === "cash" || key === "dirty-cash"
      ? amount
      : context.config.balance.warehouse
        ? calculateReceivableResourceAmount(nextState, playerId, key, amount, context.config.balance.warehouse)
        : 0;
    balances[key] = Math.max(0, Number(balances[key] || 0)) + receivable;
    pending = addPendingReward(pending, offer.offerId, key, amount - receivable, nextState.root.tick, "storage-capacity");
  }
  nextState = {
    ...nextState,
    resourceStatesById: {
      ...nextState.resourceStatesById,
      [resources.id]: { ...resources, balances, lastUpdatedTick: nextState.root.tick, version: resources.version + 1 }
    }
  };
  return { state: nextState, pending };
};

export const completeDuePlayerCityEvents = (
  state: CoreGameState,
  context: GameCoreContext
): { nextState: CoreGameState; events: CoreEvent[] } => {
  if (!context.config.balance.cityEvents?.enabled) return { nextState: state, events: [] };
  let nextState = state;
  const events: CoreEvent[] = [];
  for (const playerId of state.root.playerIds) {
    nextState = synchronizePlayerCityEvents(nextState, playerId, context);
    const playerEventState = getPlayerCityEventState(nextState, playerId);
    const run = playerEventState.activeRun;
    if (!run || run.completesAtTick > nextState.root.tick) continue;
    const offer = Object.values(playerEventState.offersByAgent).flat().find((candidate) => candidate.offerId === run.offerId);
    if (!offer) continue;
    const succeeded = hash(run.deterministicOutcomeSeed) % 100 < offer.successRateSnapshot;
    const player = nextState.playersById[playerId];
    let pending = [...playerEventState.pendingRewards];
    if (succeeded) {
      const rewardResult = resolveReward(nextState, playerId, offer, context);
      nextState = rewardResult.state;
      pending = [...pending, ...rewardResult.pending];
    } else {
      const resources = nextState.resourceStatesById[player.resourceStateId];
      if (resources) {
        nextState = {
          ...nextState,
          resourceStatesById: {
            ...nextState.resourceStatesById,
            [resources.id]: {
              ...resources,
              balances: {
                ...resources.balances,
                "dirty-cash": Math.max(0, Number(resources.balances["dirty-cash"] || 0) - offer.riskSnapshot.failureDirtyCashLoss)
              },
              lastUpdatedTick: nextState.root.tick,
              version: resources.version + 1
            }
          }
        };
      }
    }
    const heat = succeeded ? offer.riskSnapshot.successHeat : offer.riskSnapshot.failureHeat;
    const policeState = increasePlayerPoliceHeat(nextState, player, heat, nextState.root.tick);
    const offersByAgent = { ...playerEventState.offersByAgent };
    offersByAgent[offer.agentId] = offersByAgent[offer.agentId].map((candidate) => candidate.offerId === offer.offerId
      ? { ...candidate, status: succeeded ? "succeeded" as const : "failed" as const }
      : candidate);
    nextState = {
      ...nextState,
      policeStatesById: { ...nextState.policeStatesById, [policeState.id]: policeState },
      playerCityEventStatesByPlayerId: {
        ...(nextState.playerCityEventStatesByPlayerId ?? {}),
        [playerId]: { ...playerEventState, offersByAgent, activeRun: null, pendingRewards: pending, version: playerEventState.version + 1 }
      }
    };
    const definition = context.config.balance.cityEvents.definitions.find((candidate) => candidate.id === offer.definitionId);
    nextState = appendNotification(
      nextState,
      playerId,
      `${run.runId}:completed`,
      succeeded ? `${definition?.title ?? "Zakázka"} byla dokončena.` : `${definition?.title ?? "Zakázka"} selhala.`,
      succeeded ? "city.event.succeeded" : "city.event.failed",
      { offerId: offer.offerId, heat, pendingRewardCount: pending.length },
      context
    );
    events.push(createEvent(succeeded ? CORE_EVENT_TYPES.cityEventSucceeded : CORE_EVENT_TYPES.cityEventFailed, {
      playerId,
      offerId: offer.offerId,
      runId: run.runId,
      heat,
      pendingRewardCount: pending.length
    }));
  }
  return { nextState, events };
};

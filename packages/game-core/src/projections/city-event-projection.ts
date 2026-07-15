import type { PlayerCityEventsView } from "@empire/shared-types";
import type { CoreGameState } from "../entities";
import type { GameCoreContext } from "../engine/context";
import { calculateReceivableResourceAmount } from "../handlers/storageCapacityCredit";
import { getPlayerCityEventState } from "../rules/city-events/cityEventLifecycle";
import {
  resolveCityDayIndex,
  resolveCityMinuteOfDay,
  resolveNextCityTimeBoundaryTick
} from "../rules/day-night/cityClock";

const isAvailable = (opensAt: number, closesAt: number, minute: number): boolean =>
  opensAt < closesAt ? minute >= opensAt && minute < closesAt : minute >= opensAt || minute < closesAt;

const formatClock = (minuteOfDay: number): string => {
  const hour = Math.floor(minuteOfDay / 60) % 24;
  const minute = minuteOfDay % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
};
export const createPlayerCityEventsView = (
  state: CoreGameState,
  playerId: string,
  context: GameCoreContext
): PlayerCityEventsView | null => {
  const config = context.config.balance.cityEvents;
  const player = state.playersById[playerId];
  if (!config?.enabled || !player) return null;
  const playerState = getPlayerCityEventState(state, playerId);
  const minuteOfDay = resolveCityMinuteOfDay(state, context);
  const currentInfluence = Object.values(state.districtsById)
    .filter((district) => district.ownerPlayerId === playerId && district.status !== "destroyed")
    .reduce((total, district) => total + Math.max(0, Number(district.influence || 0)), 0);
  const definitionById = new Map(config.definitions.map((definition) => [definition.id, definition]));
  const activeOffer = playerState.activeRun
    ? Object.values(playerState.offersByAgent).flat().find((offer) => offer.offerId === playerState.activeRun?.offerId)
    : null;
  const activeDefinition = activeOffer ? definitionById.get(activeOffer.definitionId) : null;

  return {
    cityClock: {
      minuteOfDay,
      hour: Math.floor(minuteOfDay / 60),
      minute: minuteOfDay % 60,
      dayIndex: resolveCityDayIndex(state, context),
      label: formatClock(minuteOfDay)
    },
    activeRun: playerState.activeRun && activeOffer ? {
      runId: playerState.activeRun.runId,
      offerId: activeOffer.offerId,
      title: activeDefinition?.title ?? activeOffer.definitionId,
      agentName: config.agents[activeOffer.agentId].name,
      startedAtTick: playerState.activeRun.startedAtTick,
      completesAtTick: playerState.activeRun.completesAtTick,
      remainingTicks: Math.max(0, playerState.activeRun.completesAtTick - state.root.tick),
      possibleReward: { ...activeOffer.rewardSnapshot },
      risk: {
        successHeat: activeOffer.riskSnapshot.successHeat,
        failureHeat: activeOffer.riskSnapshot.failureHeat,
        failureDirtyCashLoss: activeOffer.riskSnapshot.failureDirtyCashLoss
      }
    } : null,
    pendingRewards: playerState.pendingRewards.map((reward) => ({
      pendingRewardId: reward.pendingRewardId,
      resourceKey: reward.resourceKey,
      amount: reward.amount,
      reason: reward.reason,
      canClaim: reward.resourceKey === "influence"
        ? Object.values(state.districtsById).some((district) => district.ownerPlayerId === playerId && district.status !== "destroyed")
        : Boolean(context.config.balance.warehouse) && calculateReceivableResourceAmount(
            state,
            playerId,
            reward.resourceKey,
            reward.amount,
            context.config.balance.warehouse!
          ) > 0
    })),
    agents: (["victor", "leon", "nyra"] as const).map((agentId) => {
      const schedule = config.agents[agentId];
      const availableNow = schedule.availability
        ? isAvailable(
            schedule.availability.opensAt.hour * 60 + schedule.availability.opensAt.minute,
            schedule.availability.closesAt.hour * 60 + schedule.availability.closesAt.minute,
            minuteOfDay
          )
        : true;
      const unlocked = currentInfluence >= schedule.requiredInfluence;
      const nextRefreshAtTick = Math.min(...schedule.refreshTimes.map((time) =>
        resolveNextCityTimeBoundaryTick(state, context, time.hour, time.minute)));
      const nextOpenAtTick = !availableNow && schedule.availability
        ? resolveNextCityTimeBoundaryTick(state, context, schedule.availability.opensAt.hour, schedule.availability.opensAt.minute)
        : null;
      return {
        agentId,
        name: schedule.name,
        type: schedule.typeLabel,
        requiredInfluence: schedule.requiredInfluence,
        currentInfluence,
        unlocked,
        availableNow,
        nextOpenAtTick,
        nextRefreshAtTick,
        scheduleLabel: agentId === "victor"
          ? "18:00–04:00 · nové nabídky 18:00 / 22:00 / 02:00"
          : agentId === "leon"
            ? "Nové nabídky 10:00 / 22:00"
            : "Intel pulse 06:00 / 14:00 / 22:00",
        offers: (playerState.offersByAgent[agentId] ?? []).map((offer) => {
          const definition = definitionById.get(offer.definitionId);
          const canStart = availableNow && unlocked && !playerState.activeRun
            && offer.status === "available" && offer.expiresAtTick > state.root.tick;
          const disabledReason = !availableNow
            ? "Kontakt je teď zavřený."
            : !unlocked
              ? `Vyžaduje ${schedule.requiredInfluence} influence.`
              : playerState.activeRun
                ? "Nejdřív dokonči aktivní zakázku."
                : offer.status !== "available"
                  ? "Tato nabídka už byla použita."
                  : offer.expiresAtTick <= state.root.tick
                    ? "Tato nabídka vypršela."
                    : null;
          return {
            offerId: offer.offerId,
            definitionId: offer.definitionId,
            title: definition?.title ?? offer.definitionId,
            description: definition?.description ?? "",
            difficulty: definition?.difficulty ?? "medium",
            successRate: offer.successRateSnapshot,
            durationMinutes: definition?.durationMinutes ?? Math.ceil(offer.durationTicksSnapshot * context.config.tickRateMs / 60_000),
            durationTicks: offer.durationTicksSnapshot,
            rewards: { ...offer.rewardSnapshot },
            successHeat: offer.riskSnapshot.successHeat,
            failureHeat: offer.riskSnapshot.failureHeat,
            failureDirtyCashLoss: offer.riskSnapshot.failureDirtyCashLoss,
            expiresAtTick: offer.expiresAtTick,
            status: offer.status,
            attempted: offer.attemptedAtTick !== null,
            canStart,
            disabledReason
          };
        })
      };
    })
  };
};

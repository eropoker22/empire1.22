import type { Player } from "@empire/shared-types";
import type { CoreGameState } from "../../entities";
import type { GameCoreContext } from "../../engine/context";
import { calculatePlayerPolicePressure } from "./policePressure";
import { resolvePoliceConfig } from "./policeConfig";
import { getOpenPendingRaids, isRaidCooldownActive } from "./raidTriggerHelpers";
import {
  resolveScheduledRaidBoundary,
  type ScheduledRaidBoundary
} from "./raidSchedule";

export const resolveScheduledRaidCandidates = (
  state: CoreGameState,
  context: GameCoreContext | undefined,
  currentTick: number
): {
  activePlayers: Player[];
  scheduledBoundary: ScheduledRaidBoundary | null;
  scheduledTargetId: string | null;
} => {
  const activePlayers = Object.values(state.playersById)
    .filter((player) => player.status === "active");
  const scheduledBoundary = resolveScheduledRaidBoundary(state, context, currentTick);
  if (!scheduledBoundary || activePlayers.length === 0) {
    return { activePlayers, scheduledBoundary, scheduledTargetId: null };
  }

  const config = resolvePoliceConfig(context);
  const playersWithDistricts = activePlayers.filter((player) => Object.values(state.districtsById)
    .some((district) => district.ownerPlayerId === player.id));
  const candidatePlayers = playersWithDistricts.length > 0 ? playersWithDistricts : activePlayers;
  const availableCandidates = candidatePlayers
    .map((player) => ({
      player,
      policeState: state.policeStatesById[player.policeStateId],
      pressure: calculatePlayerPolicePressure(state, player.id, context)
    }))
    .filter(({ policeState }) => !policeState || getOpenPendingRaids(policeState).length === 0);
  const cooldownEligibleCandidates = availableCandidates.filter(({ policeState }) => (
    !policeState || !isRaidCooldownActive(policeState, currentTick, config.raidCooldownTicks)
  ));
  const scheduledTargetId = (cooldownEligibleCandidates.length > 0
    ? cooldownEligibleCandidates
    : availableCandidates)
    .sort((left, right) => (
      left.pressure.aggregatePressure - right.pressure.aggregatePressure
      || left.pressure.hottestDistrictHeat - right.pressure.hottestDistrictHeat
      || left.player.id.localeCompare(right.player.id)
    ))[0]?.player.id ?? null;
  const orderedActivePlayers = scheduledTargetId
    ? [
        ...activePlayers.filter((player) => player.id !== scheduledTargetId),
        activePlayers.find((player) => player.id === scheduledTargetId)!
      ]
    : activePlayers;

  return {
    activePlayers: orderedActivePlayers,
    scheduledBoundary,
    scheduledTargetId
  };
};

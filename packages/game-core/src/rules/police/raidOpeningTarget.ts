import type { Player } from "@empire/shared-types";
import type { CoreGameState } from "../../entities";
import type { GameCoreContext } from "../../engine/context";
import { calculatePlayerPolicePressure } from "./policePressure";
import { resolvePoliceConfig } from "./policeConfig";
import { getOpenPendingRaids, isRaidCooldownActive } from "./raidTriggerHelpers";
import {
  resolveScheduledRaidWindow,
  type ScheduledRaidWindow
} from "./raidSchedule";

export const resolveScheduledRaidCandidates = (
  state: CoreGameState,
  context: GameCoreContext | undefined,
  currentTick: number
): {
  activePlayers: Player[];
  scheduledWindow: ScheduledRaidWindow | null;
  scheduledTargetId: string | null;
} => {
  const activePlayers = Object.values(state.playersById)
    .filter((player) => player.status === "active");
  const scheduledWindow = resolveScheduledRaidWindow(state, context, currentTick);
  if (!scheduledWindow || activePlayers.length === 0) {
    return { activePlayers, scheduledWindow, scheduledTargetId: null };
  }

  const config = resolvePoliceConfig(context);
  const playersWithDistricts = activePlayers.filter((player) => Object.values(state.districtsById)
    .some((district) => district.ownerPlayerId === player.id && district.status !== "destroyed"));
  const candidatePlayers = playersWithDistricts;
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
  // Routine checks rotate among eligible residents; they never bypass a
  // player's raid cooldown merely to fill a scheduled police slot.
  const scheduledTargetId = cooldownEligibleCandidates
    .filter(({ pressure }) => pressure.riskTier === "low" || pressure.riskTier === "medium")
    .sort((left, right) => (
      Number(left.policeState?.lastRaidCreatedAtTick ?? -1) - Number(right.policeState?.lastRaidCreatedAtTick ?? -1)
      || left.pressure.aggregatePressure - right.pressure.aggregatePressure
      || left.pressure.hottestDistrictHeat - right.pressure.hottestDistrictHeat
      || left.player.id.localeCompare(right.player.id)
    ))[0]?.player.id ?? null;
  const pressureByPlayerId = new Map(activePlayers.map((player) => [
    player.id,
    calculatePlayerPolicePressure(state, player.id, context)
  ]));
  const orderedActivePlayers = [...activePlayers].sort((left, right) => {
    if (left.id === scheduledTargetId) return 1;
    if (right.id === scheduledTargetId) return -1;
    const leftPressure = pressureByPlayerId.get(left.id)!;
    const rightPressure = pressureByPlayerId.get(right.id)!;
    return rightPressure.aggregatePressure - leftPressure.aggregatePressure
      || rightPressure.hottestDistrictHeat - leftPressure.hottestDistrictHeat
      || left.id.localeCompare(right.id);
  });

  return {
    activePlayers: orderedActivePlayers,
    scheduledWindow,
    scheduledTargetId
  };
};

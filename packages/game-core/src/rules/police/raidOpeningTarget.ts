import type { Player } from "@empire/shared-types";
import type { CoreGameState } from "../../entities";
import type { GameCoreContext } from "../../engine/context";
import { calculatePlayerPolicePressure } from "./policePressure";
import { isMiddayRaidBoundary } from "./raidSchedule";

export const resolveRaidOpeningCandidates = (
  state: CoreGameState,
  context: GameCoreContext | undefined,
  currentTick: number
): { activePlayers: Player[]; openingMiddayTargetId: string | null } => {
  const activePlayers = Object.values(state.playersById)
    .filter((player) => player.status === "active");
  const firstRaidHasNotStarted = Object.values(state.policeStatesById).every((policeState) => (
    policeState.lastRaidCreatedAtTick === undefined
    && policeState.lastRaidResolvedAtTick === undefined
    && (policeState.pendingRaids ?? []).length === 0
  ));
  if (!firstRaidHasNotStarted || !isMiddayRaidBoundary(state, context, currentTick)) {
    return { activePlayers, openingMiddayTargetId: null };
  }
  const openingMiddayTargetId = activePlayers
    .filter((player) => Object.values(state.districtsById)
      .some((district) => district.ownerPlayerId === player.id))
    .map((player) => calculatePlayerPolicePressure(state, player.id, context))
    .sort((left, right) => (
      right.aggregatePressure - left.aggregatePressure
      || right.hottestDistrictHeat - left.hottestDistrictHeat
      || left.playerId.localeCompare(right.playerId)
    ))[0]?.playerId ?? null;
  return { activePlayers, openingMiddayTargetId };
};

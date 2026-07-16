import type { PlayerOperationalLivenessView } from "@empire/shared-types";
import type { GameCoreContext } from "../../engine/context";
import type { CoreGameState } from "../../entities";
import { calculatePlayerFrontier, resolveAllianceCorridorRoutes } from "../map/frontier";
import { hasValidAttackAuthorization, validateOccupyEmptyDistrictAuthorization } from "../../validation/spyIntel";
import { getPlayerSpyOperationState } from "../../validation/validateSpy";
import {
  isFutureTick,
  resolveUsableConflictOriginDistricts,
  type UsableConflictOrigins
} from "./playerConflictOrigins";
export { resolveUsableConflictOriginDistricts } from "./playerConflictOrigins";

export const resolvePlayerOperationalLiveness = (
  state: CoreGameState,
  playerId: string,
  context?: GameCoreContext
): PlayerOperationalLivenessView => {
  const player = state.playersById[playerId];
  if (!player) return emptyView("invalid_softlock", true);
  const origins = resolveUsableConflictOriginDistricts(state, playerId, "spy");
  if (player.status === "defeated") {
    return { ...emptyView("defeated", false), ...originCounts(origins) };
  }
  if (origins.activeOwnedDistrictIds.length === 0) {
    return {
      ...emptyView("no_territory", true),
      ...originCounts(origins),
      blockingReasons: ["PLAYER_HAS_NO_ACTIVE_TERRITORY"],
      recommendedActions: []
    };
  }

  const frontier = calculatePlayerFrontier(state, playerId);
  const spyAvailable = getPlayerSpyOperationState(state, playerId).slots.some((slot) => slot.availableAtTick <= state.root.tick);
  const population = Math.max(0, Number(player.population ?? state.resourceStatesById[player.resourceStateId]?.balances.population ?? 0));
  const directTargets = [...frontier.emptyDistrictIds, ...frontier.enemyDistrictIds];
  const corridorRoutes = resolveAllianceCorridorRoutes(state, playerId);
  const recommendedActions: string[] = [];
  let conflictNow = false;
  if (spyAvailable && (directTargets.length > 0 || corridorRoutes.length > 0) && origins.usableOriginDistrictIds.length > 0) {
    conflictNow = true;
    recommendedActions.push("spy");
  }
  if (population >= 1 && frontier.emptyDistrictIds.length > 0 && origins.usableOriginDistrictIds.length > 0) {
    conflictNow = true;
    recommendedActions.push("rob");
  }
  if (frontier.enemyDistrictIds.some((targetId) => hasValidAttackAuthorization(state, playerId, targetId))) {
    recommendedActions.push("attack");
  }
  if (frontier.emptyDistrictIds.some((targetId) => validateOccupyEmptyDistrictAuthorization(state, playerId, targetId) === true)) {
    recommendedActions.push("occupy");
  }

  const economyActions = resolveEconomyProgressActions(state, playerId);
  recommendedActions.push(...economyActions);
  const canProgressNow = conflictNow || economyActions.length > 0;
  const deadline = resolveNextProgressDeadline(state, playerId);
  const canProgressLater = deadline !== null;
  const finalLockdown = state.root.phase === "final_lockdown" || state.finalLockdownState?.status === "active";
  const emergencyRecovery = resolveEmergencyRecoveryEligibility(state, playerId, {
    canProgressNow,
    nextProgressAtTick: deadline?.tick ?? null,
    finalLockdown,
    config: context?.config.balance.playerLiveness?.emergencyRecovery
  });
  const lastStandUntilTick = Number(player.lastStandProtectedUntilTick ?? 0);
  const lastStandActive = origins.activeOwnedDistrictIds.length === 1 && lastStandUntilTick > state.root.tick;
  const stateName = lastStandActive
    ? "last_stand"
    : canProgressNow
      ? frontier.state === "open" ? "open_frontier" : frontier.state === "no_frontier" ? "playable" : frontier.state
      : canProgressLater
        ? "temporarily_sealed"
        : emergencyRecovery.canClaim || economyActions.length > 0
          ? "economy_recovery"
          : "invalid_softlock";
  const invalidInvariant = stateName === "invalid_softlock";
  return {
    state: stateName,
    canProgressNow,
    canProgressLater,
    nextProgressAtTick: deadline?.tick ?? null,
    nextProgressReason: deadline?.reason ?? null,
    remainingTicks: deadline ? deadline.tick - state.root.tick : null,
    ...originCounts(origins),
    frontierState: frontier.state,
    directTargets,
    corridorTargets: [...new Set(corridorRoutes.map((route) => route.targetDistrictId))],
    blockingReasons: invalidInvariant ? ["ACTIVE_PLAYER_SOFTLOCKED"] : [],
    recommendedActions: [...new Set(recommendedActions)],
    corridorAvailable: corridorRoutes.length > 0,
    lastStand: {
      active: lastStandActive,
      districtId: lastStandActive ? origins.activeOwnedDistrictIds[0] : null,
      protectedUntilTick: lastStandActive ? lastStandUntilTick : null,
      remainingTicks: lastStandActive ? lastStandUntilTick - state.root.tick : 0
    },
    emergencyRecovery,
    invalidInvariant
  };
};

const resolveEconomyProgressActions = (state: CoreGameState, playerId: string): string[] => {
  const player = state.playersById[playerId];
  if (!player) return [];
  const actions: string[] = [];
  const cityEvents = state.playerCityEventStatesByPlayerId?.[playerId];
  if (cityEvents?.pendingRewards.some((reward) => reward.amount > 0)) actions.push("claim-city-event-reward");
  if (!cityEvents?.activeRun && Object.values(cityEvents?.offersByAgent ?? {}).flat()
    .some((offer) => offer.status === "available" && offer.expiresAtTick > state.root.tick)) actions.push("start-city-event");
  const ownedBuildingIds = new Set(Object.values(state.districtsById)
    .filter((district) => district.ownerPlayerId === playerId)
    .flatMap((district) => district.buildingIds));
  const canCollect = [...ownedBuildingIds].some((buildingId) => {
    const building = state.buildingsById[buildingId];
    if (!building || building.status !== "active") return false;
    if (Object.values(building.productionLines ?? {}).some((line) => Number(line.legacyOutputAmount ?? 0) > 0)) return true;
    return Object.values(state.resourceStatesById).some((resource) =>
      resource.ownerType === "building" && resource.ownerId === buildingId
      && Object.values(resource.balances).some((amount) => Number(amount) > 0));
  });
  if (canCollect) actions.push("collect-production");
  const balances = state.resourceStatesById[player.resourceStateId]?.balances ?? {};
  if (Object.entries(balances).some(([key, amount]) => !["cash", "dirty-cash", "population"].includes(key) && Number(amount) > 0)) {
    actions.push("market-sell");
  }
  return actions;
};

const resolveNextProgressDeadline = (
  state: CoreGameState,
  playerId: string
): { tick: number; reason: string } | null => {
  const player = state.playersById[playerId];
  if (!player) return null;
  const candidates: Array<{ tick: number; reason: string }> = [];
  for (const district of Object.values(state.districtsById).filter((entry) => entry.ownerPlayerId === playerId)) {
    pushDeadline(candidates, district.stabilizingUntilTick, state.root.tick, "stabilization");
    pushDeadline(candidates, district.lockdownUntilTick, state.root.tick, "police-lockdown");
  }
  for (const tick of Object.values(state.cooldownStatesById[player.cooldownStateId]?.cooldowns ?? {})) {
    pushDeadline(candidates, tick, state.root.tick, "cooldown");
  }
  for (const slot of getPlayerSpyOperationState(state, playerId).slots) {
    pushDeadline(candidates, slot.availableAtTick, state.root.tick, "spy-slot");
  }
  for (const building of Object.values(state.buildingsById).filter((entry) => entry.ownerPlayerId === playerId)) {
    pushDeadline(candidates, building.processing?.completesAtTick, state.root.tick, "production");
    for (const line of Object.values(building.productionLines ?? {})) {
      pushDeadline(candidates, line.activeCompletesAtTick, state.root.tick, "production");
    }
  }
  pushDeadline(candidates, state.playerCityEventStatesByPlayerId?.[playerId]?.activeRun?.completesAtTick, state.root.tick, "city-event");
  return candidates.sort((left, right) => left.tick - right.tick || left.reason.localeCompare(right.reason))[0] ?? null;
};

const resolveEmergencyRecoveryEligibility = (
  state: CoreGameState,
  playerId: string,
  input: {
    canProgressNow: boolean;
    nextProgressAtTick: number | null;
    finalLockdown: boolean;
    config: NonNullable<GameCoreContext["config"]["balance"]["playerLiveness"]>["emergencyRecovery"] | undefined;
  }
): PlayerOperationalLivenessView["emergencyRecovery"] => {
  const player = state.playersById[playerId];
  const config = input.config;
  const activeDistricts = Object.values(state.districtsById).filter((district) =>
    district.ownerPlayerId === playerId && district.status !== "destroyed" && district.status !== "locked");
  const balances = state.resourceStatesById[player?.resourceStateId ?? ""]?.balances ?? {};
  const used = player?.emergencyRecoveryUsedAtTick != null;
  const futureWithinGrace = input.nextProgressAtTick !== null && config
    ? input.nextProgressAtTick - state.root.tick <= config.futureUnlockGraceTicks
    : false;
  const disabledByFinalLockdown = Boolean(config?.disabledDuringFinalLockdown && input.finalLockdown);
  const canClaim = Boolean(config?.enabled && config.maxUsesPerPlayer > 0
    && player && player.status === "active" && activeDistricts.length === 1
    && !disabledByFinalLockdown && !used && !input.canProgressNow && !futureWithinGrace
    && Number(player.population ?? balances.population ?? 0) < config.population
    && Number(balances.cash ?? 0) < config.cleanCash);
  return {
    canClaim,
    used,
    cleanCash: config?.cleanCash ?? 0,
    population: config?.population ?? 0,
    disabledReason: canClaim ? null
      : !config?.enabled ? "UNAVAILABLE"
        : disabledByFinalLockdown ? "FINAL_LOCKDOWN"
          : used ? "ALREADY_USED" : "PROGRESSION_ROUTE_AVAILABLE"
  };
};

const originCounts = (origins: UsableConflictOrigins) => ({
  ownedDistrictCount: origins.ownedDistrictIds.length,
  activeDistrictCount: origins.activeOwnedDistrictIds.length,
  ...origins
});

const emptyView = (state: PlayerOperationalLivenessView["state"], invalidInvariant: boolean): PlayerOperationalLivenessView => ({
  state, canProgressNow: false, canProgressLater: false, nextProgressAtTick: null, nextProgressReason: null,
  remainingTicks: null, ownedDistrictCount: 0, activeDistrictCount: 0, ownedDistrictIds: [], activeOwnedDistrictIds: [],
  usableOriginDistrictIds: [], temporarilyBlockedOriginDistrictIds: [], permanentlyInvalidOriginDistrictIds: [],
  frontierState: "no_frontier", directTargets: [], corridorTargets: [], blockingReasons: [], recommendedActions: [],
  corridorAvailable: false, lastStand: { active: false, districtId: null, protectedUntilTick: null, remainingTicks: 0 },
  emergencyRecovery: { canClaim: false, used: false, cleanCash: 0, population: 0, disabledReason: "UNAVAILABLE" }, invalidInvariant
});

const pushDeadline = (entries: Array<{ tick: number; reason: string }>, value: unknown, currentTick: number, reason: string): void => {
  if (isFutureTick(value, currentTick)) entries.push({ tick: Number(value), reason });
};

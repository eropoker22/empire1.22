import type { Alliance, AllianceMembership, Player } from "@empire/shared-types";
import type { GameCoreContext } from "../../engine/context";
import type { CoreGameState } from "../../entities";
import type { CoreEvent } from "../../events";
import { CORE_EVENT_TYPES, createEvent, createNotification } from "../../events";
import { cleanupAllianceDefense } from "../alliances/allianceDefenseCleanup";
import { bumpDistrictConflictRevision } from "../../state";
export interface TerritoryLifecycleResult {
  nextState: CoreGameState;
  events: CoreEvent[];
}
export type PlayerDefeatReason =
  | "last_district_lost"
  | "scheduled_weakest_player"
  | "final_lockdown"
  | "administrative";
export const countActiveOwnedDistricts = (state: CoreGameState, playerId: string): number =>
  Object.values(state.districtsById).filter((district) =>
    district.ownerPlayerId === playerId && district.status !== "destroyed" && district.status !== "locked").length;

export const resolveCurrentHeadquartersDistrict = (
  state: CoreGameState,
  playerId: string
): CoreGameState["districtsById"][string] | null => {
  const owned = Object.values(state.districtsById).filter((district) =>
    district.ownerPlayerId === playerId && district.status !== "destroyed" && district.status !== "locked");
  return owned.sort((left, right) => {
    const leftStable = Number(left.stabilizingUntilTick ?? 0) <= state.root.tick ? 1 : 0;
    const rightStable = Number(right.stabilizingUntilTick ?? 0) <= state.root.tick ? 1 : 0;
    if (leftStable !== rightStable) return rightStable - leftStable;
    const leftValue = left.buildingIds.length * 1_000 + Math.max(0, Number(left.influence || 0));
    const rightValue = right.buildingIds.length * 1_000 + Math.max(0, Number(right.influence || 0));
    if (leftValue !== rightValue) return rightValue - leftValue;
    const leftOwnedAt = Number(left.ownershipStartedAtTick ?? Number.MAX_SAFE_INTEGER);
    const rightOwnedAt = Number(right.ownershipStartedAtTick ?? Number.MAX_SAFE_INTEGER);
    return leftOwnedAt - rightOwnedAt || left.id.localeCompare(right.id);
  })[0] ?? null;
};

export const reconcilePlayerTerritoryLifecycle = (
  state: CoreGameState,
  input: {
    playerId: string;
    previousActiveDistrictCount: number;
    sourceEventId: string;
    issuedAt: string;
  },
  context: GameCoreContext
): TerritoryLifecycleResult => {
  const player = state.playersById[input.playerId];
  if (!player || player.status !== "active") return { nextState: state, events: [] };
  const currentActiveDistrictCount = countActiveOwnedDistricts(state, player.id);
  if (currentActiveDistrictCount === 0) {
    return applyPlayerDefeatLifecycle(state, {
      ...input,
      playerId: player.id,
      reason: "last_district_lost"
    });
  }

  const headquarters = resolveCurrentHeadquartersDistrict(state, player.id);
  let nextPlayer: Player = {
    ...player,
    originalHomeDistrictId: player.originalHomeDistrictId ?? player.homeDistrictId,
    currentHeadquartersDistrictId: headquarters?.id ?? null
  };
  let nextDistrictsById = state.districtsById;
  const finalLockdownActive = state.finalLockdownState?.status === "active" || state.root.phase === "final_lockdown";
  const lastStand = context.config.balance.playerLiveness?.lastStand;
  const canActivateLastStand = Boolean(lastStand?.enabled
    && lastStand.maxUsesPerPlayer > 0
    && input.previousActiveDistrictCount >= 2
    && currentActiveDistrictCount === 1
    && player.lastStandUsedAtTick == null
    && !(lastStand.disabledDuringFinalLockdown && finalLockdownActive)
    && headquarters);
  if (canActivateLastStand && headquarters && lastStand) {
    const protectedUntilTick = state.root.tick + Math.max(0, lastStand.protectionTicks);
    nextPlayer = {
      ...nextPlayer,
      lastStandUsedAtTick: state.root.tick,
      lastStandDistrictId: headquarters.id,
      lastStandProtectedUntilTick: protectedUntilTick
    };
    nextDistrictsById = {
      ...state.districtsById,
      [headquarters.id]: bumpDistrictConflictRevision({
        ...headquarters,
        attackProtectedUntilTick: Math.max(Number(headquarters.attackProtectedUntilTick ?? 0), protectedUntilTick),
        version: headquarters.version + 1
      })
    };
  }
  const changed = nextPlayer.currentHeadquartersDistrictId !== player.currentHeadquartersDistrictId
    || nextPlayer.originalHomeDistrictId !== player.originalHomeDistrictId
    || nextPlayer.lastStandUsedAtTick !== player.lastStandUsedAtTick;
  if (!changed) return { nextState: state, events: [] };
  return {
    nextState: {
      ...state,
      districtsById: nextDistrictsById,
      playersById: {
        ...state.playersById,
        [player.id]: { ...nextPlayer, version: player.version + 1 }
      }
    },
    events: canActivateLastStand && headquarters
      ? [createEvent("player-last-stand-activated", {
          playerId: player.id,
          districtId: headquarters.id,
          protectedUntilTick: nextPlayer.lastStandProtectedUntilTick
        })]
      : []
  };
};

export const applyPlayerDefeatLifecycle = (
  state: CoreGameState,
  input: {
    playerId: string;
    reason: PlayerDefeatReason;
    sourceEventId: string;
    issuedAt: string;
    finalPlacement?: number | null;
    scoreAtElimination?: number | null;
    scoreBreakdownAtElimination?: Record<string, number> | null;
    rankFromBottomAtElimination?: number | null;
  }
): TerritoryLifecycleResult => {
  const player = state.playersById[input.playerId];
  if (!player || player.status !== "active") return { nextState: state, events: [] };
  const cleaned = cleanupDefeatedAllianceState(state, player, input);
  const scheduled = input.reason === "scheduled_weakest_player";
  const notification = createNotification({
    id: `notification:defeat:${input.sourceEventId}:${player.id}`,
    recipientType: "player",
    recipientId: player.id,
    category: "elimination.defeated",
    title: scheduled ? "Byl jsi vyřazen ze serveru" : "Tvoje impérium padlo.",
    bodyKey: "elimination.defeated",
    payload: {
      playerId: player.id,
      defeatedAtTick: state.root.tick,
      reason: input.reason,
      ...(scheduled ? { body: "Po pravidelném vyhodnocení jsi byl nejslabší aktivní hráč. Tvůj gang ztratil kontrolu nad ulicemi." } : {}),
      ...(input.finalPlacement != null ? { finalPlacement: input.finalPlacement } : {})
    },
    createdAt: input.issuedAt,
    readAt: null
  });
  const cleanedPlayer = cleaned.playersById[player.id] ?? player;
  const nextState: CoreGameState = {
    ...cleaned,
    playersById: {
      ...cleaned.playersById,
      [player.id]: {
        ...cleanedPlayer,
        status: "defeated",
        allianceId: null,
        originalHomeDistrictId: player.originalHomeDistrictId ?? player.homeDistrictId,
        currentHeadquartersDistrictId: null,
        metadata: {
          ...(cleanedPlayer.metadata ?? {}),
          eliminatedAtTick: state.root.tick,
          eliminationReason: input.reason,
          defeatLifecycleSourceEventId: input.sourceEventId,
          ...(input.finalPlacement != null ? { finalPlacement: input.finalPlacement } : {}),
          ...(input.scoreAtElimination != null ? { scoreAtElimination: input.scoreAtElimination } : {}),
          ...(input.scoreBreakdownAtElimination ? { scoreBreakdownAtElimination: input.scoreBreakdownAtElimination } : {}),
          ...(input.rankFromBottomAtElimination != null ? { rankFromBottomAtElimination: input.rankFromBottomAtElimination } : {})
        },
        version: cleanedPlayer.version + 1
      }
    },
    notificationsById: { ...cleaned.notificationsById, [notification.id]: notification },
    root: {
      ...cleaned.root,
      notificationIds: cleaned.root.notificationIds.includes(notification.id)
        ? cleaned.root.notificationIds
        : [...cleaned.root.notificationIds, notification.id],
      version: cleaned.root.version + 1
    }
  };
  return {
    nextState,
    events: [
      createEvent(CORE_EVENT_TYPES.playerEliminated, {
        playerId: player.id,
        reason: input.reason,
        eliminatedAtTick: state.root.tick,
        ...(input.finalPlacement != null ? { finalPlacement: input.finalPlacement } : {})
      }),
      createEvent(CORE_EVENT_TYPES.notificationCreated, {
        notificationId: notification.id,
        recipientId: player.id,
        category: notification.category
      })
    ]
  };
};

const cleanupDefeatedAllianceState = (
  state: CoreGameState,
  player: Player,
  input: { sourceEventId: string; issuedAt: string }
): CoreGameState => {
  if (!player.allianceId) return state;
  const alliance = state.alliancesById[player.allianceId];
  const cleanedDefense = cleanupAllianceDefense(state, {
    allianceId: player.allianceId,
    playerId: player.id,
    sourceEventId: `${input.sourceEventId}:defeat-alliance-cleanup`,
    nowIso: input.issuedAt
  });
  if (!alliance) return cleanedDefense;
  const remainingIds = alliance.memberIds.filter((id) => id !== player.id);
  const nextOwnerPlayerId = alliance.ownerPlayerId === player.id
    ? [...remainingIds].sort()[0] ?? player.id
    : alliance.ownerPlayerId;
  const memberships = { ...(alliance.membershipByPlayerId ?? {}) };
  if (memberships[player.id]) {
    memberships[player.id] = {
      ...memberships[player.id],
      status: "removed",
      removedAt: input.issuedAt,
      removedReason: "administrative_removal",
      version: memberships[player.id].version + 1
    };
  }
  if (remainingIds.length > 0 && memberships[nextOwnerPlayerId]) {
    memberships[nextOwnerPlayerId] = {
      ...memberships[nextOwnerPlayerId],
      role: "leader",
      version: memberships[nextOwnerPlayerId].version + 1
    } as AllianceMembership;
  }
  const nextAlliance: Alliance = {
    ...alliance,
    memberIds: remainingIds,
    ownerPlayerId: nextOwnerPlayerId,
    membershipByPlayerId: memberships,
    status: remainingIds.length === 0 ? "disbanded" : alliance.status,
    version: alliance.version + 1
  };
  return {
    ...cleanedDefense,
    alliancesById: { ...cleanedDefense.alliancesById, [alliance.id]: nextAlliance }
  };
};

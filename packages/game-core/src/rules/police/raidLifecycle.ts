import type { PendingRaid, PoliceEvent } from "@empire/shared-types";
import type { CoreGameState } from "../../entities";
import type { CoreEvent } from "../../events";
import { CORE_EVENT_TYPES, createEvent } from "../../events";
import type { GameCoreContext } from "../../engine/context";
import { applyRaidConsequences } from "./raidConsequences";
import { resolvePoliceConfig } from "./policeConfig";

export const acknowledgePendingRaid = (
  state: CoreGameState,
  playerId: string,
  raidId: string
): { nextState: CoreGameState; events: CoreEvent[] } => {
  const player = state.playersById[playerId] ?? null;
  const policeState = player?.policeStateId ? state.policeStatesById[player.policeStateId] ?? null : null;

  if (!policeState) {
    return { nextState: state, events: [] };
  }

  let acknowledgedRaid: PendingRaid | null = null;
  const pendingRaids = (policeState.pendingRaids ?? []).map((raid) => {
    if (raid.raidId !== raidId || raid.status !== "pending") {
      return raid;
    }
    acknowledgedRaid = {
      ...raid,
      status: "acknowledged",
      acknowledgedAtTick: state.root.tick
    };
    return acknowledgedRaid;
  });

  if (!acknowledgedRaid) {
    return { nextState: state, events: [] };
  }

  return {
    nextState: {
      ...state,
      policeStatesById: {
        ...state.policeStatesById,
        [policeState.id]: {
          ...policeState,
          pendingRaids,
          version: policeState.version + 1
        }
      }
    },
    events: [
      createEvent(CORE_EVENT_TYPES.policeRaidAcknowledged, {
        playerId,
        policeStateId: policeState.id,
        raidId,
        tick: state.root.tick
      })
    ]
  };
};

export const resolvePendingRaid = (
  state: CoreGameState,
  playerId: string,
  raidId: string,
  context?: GameCoreContext
): { nextState: CoreGameState; events: CoreEvent[]; result: ReturnType<typeof applyRaidConsequences>["result"] | null } => {
  const player = state.playersById[playerId] ?? null;
  const policeState = player?.policeStateId ? state.policeStatesById[player.policeStateId] ?? null : null;
  const raid = (policeState?.pendingRaids ?? []).find(
    (entry) => entry.raidId === raidId && (entry.status === "pending" || entry.status === "acknowledged")
  ) ?? null;

  if (!raid) {
    return {
      nextState: state,
      events: [],
      result: null
    };
  }

  const applyResult = applyRaidConsequences(state, raid, context);

  return {
    nextState: applyResult.nextState,
    events: [
      createEvent(CORE_EVENT_TYPES.policeRaidResolved, {
        policeStateId: policeState?.id,
        ...applyResult.result,
        playerId
      })
    ],
    result: applyResult.result
  };
};

export const expirePendingRaids = (
  state: CoreGameState,
  context?: GameCoreContext
): { nextState: CoreGameState; events: CoreEvent[] } => {
  const config = resolvePoliceConfig(context);
  let nextState = state;
  const events: CoreEvent[] = [];
  const currentTick = state.root.tick;

  for (const policeState of Object.values(state.policeStatesById)) {
    const expiredRaids = (policeState.pendingRaids ?? []).filter(
      (raid) =>
        (raid.status === "pending" || raid.status === "acknowledged")
        && raid.expiresAtTick <= currentTick
    );

    for (const raid of expiredRaids) {
      if (config.autoResolveExpiredPendingRaids !== false) {
        const resolved = resolvePendingRaid(nextState, policeState.ownerPlayerId, raid.raidId, context);
        nextState = resolved.nextState;
        events.push(...resolved.events);
        continue;
      }

      const expired = markRaidExpired(nextState, policeState.ownerPlayerId, raid);
      nextState = expired.nextState;
      events.push(...expired.events);
    }
  }

  return { nextState, events };
};

const markRaidExpired = (
  state: CoreGameState,
  playerId: string,
  raid: PendingRaid
): { nextState: CoreGameState; events: CoreEvent[] } => {
  const player = state.playersById[playerId] ?? null;
  const policeState = player?.policeStateId ? state.policeStatesById[player.policeStateId] ?? null : null;
  if (!policeState) {
    return { nextState: state, events: [] };
  }

  const policeEvent: PoliceEvent = {
    id: `police:event:${raid.raidId}:expired`,
    type: "police-raid-expired",
    playerId,
    districtId: raid.targetDistrictId,
    severity: raid.severity,
    message: "Policejní varování vypršelo bez zásahu.",
    createdAtTick: state.root.tick,
    payload: {
      raidId: raid.raidId,
      sourcePressure: raid.sourcePressure
    }
  };
  const pendingRaids = (policeState.pendingRaids ?? []).map((entry) =>
    entry.raidId === raid.raidId
      ? {
          ...entry,
          status: "expired" as const
        }
      : entry
  );
  const hasOpenRaid = pendingRaids.some((entry) => entry.status === "pending" || entry.status === "acknowledged");

  return {
    nextState: {
      ...state,
      policeStatesById: {
        ...state.policeStatesById,
        [policeState.id]: {
          ...policeState,
          activeFlags: hasOpenRaid
            ? ensureFlag(policeState.activeFlags, "raid:pending")
            : policeState.activeFlags.filter((flag) => flag !== "raid:pending"),
          pendingRaids,
          policeEvents: [policeEvent, ...(policeState.policeEvents ?? [])].slice(0, 12),
          version: policeState.version + 1
        }
      }
    },
    events: [
      createEvent(CORE_EVENT_TYPES.policeRaidExpired, {
        playerId,
        policeStateId: policeState.id,
        raidId: raid.raidId
      })
    ]
  };
};

const ensureFlag = (flags: string[], flag: string): string[] =>
  flags.includes(flag) ? flags : [...flags, flag];

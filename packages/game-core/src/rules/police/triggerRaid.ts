import type { CoreGameState } from "../../entities";
import type { CoreEvent } from "../../events";
import { CORE_EVENT_TYPES, createEvent } from "../../events";
import type { GameCoreContext } from "../../engine/context";

const RAID_PRESSURE_THRESHOLD = 100;
const RAID_PENDING_FLAG = "raid:pending";

interface PendingRaidResult {
  cashSeized: Record<string, number>;
  resourcesSeized: Record<string, number>;
  gangMembersLost: number;
  districtLockdownMinutes: number;
  heatReduced: number;
}

/**
 * Responsibility: Flags player police states that cross the raid pressure threshold.
 * Belongs here: police-driven state transitions in the core.
 * Does not belong here: transport or UI effects.
 */
export const triggerRaid = (
  state: CoreGameState,
  context?: GameCoreContext
): { nextState: CoreGameState; events: CoreEvent[] } => {
  let changed = false;
  let nextPoliceStatesById = state.policeStatesById;
  const events: CoreEvent[] = [];
  const raidIntensityMultiplier = Math.max(0, Number(context?.config.balance.raidIntensityMultiplier ?? 1));
  const threshold = Math.max(1, Math.floor(RAID_PRESSURE_THRESHOLD / Math.max(0.01, raidIntensityMultiplier)));

  for (const policeState of Object.values(state.policeStatesById)) {
    if (policeState.heat < threshold || policeState.activeFlags.includes(RAID_PENDING_FLAG)) {
      continue;
    }

    const raidResult = createPendingRaidResult(state, policeState);

    nextPoliceStatesById = {
      ...nextPoliceStatesById,
      [policeState.id]: {
        ...policeState,
        wantedLevel: Math.max(policeState.wantedLevel, 5),
        activeFlags: [...policeState.activeFlags, RAID_PENDING_FLAG],
        version: policeState.version + 1
      }
    };
    changed = true;
    events.push(
      createEvent(CORE_EVENT_TYPES.policeRaidTriggered, {
        playerId: policeState.ownerPlayerId,
        policeStateId: policeState.id,
        heat: policeState.heat,
        threshold,
        raidResult,
        cashSeized: raidResult.cashSeized,
        resourcesSeized: raidResult.resourcesSeized,
        gangMembersLost: raidResult.gangMembersLost,
        districtLockdownMinutes: raidResult.districtLockdownMinutes,
        heatReduced: raidResult.heatReduced
      })
    );
  }

  return {
    nextState: changed
      ? {
          ...state,
          policeStatesById: nextPoliceStatesById
        }
      : state,
    events
  };
};

const createPendingRaidResult = (
  state: CoreGameState,
  policeState: CoreGameState["policeStatesById"][string]
): PendingRaidResult => {
  const player = state.playersById[policeState.ownerPlayerId];
  const balances = player
    ? state.resourceStatesById[player.resourceStateId]?.balances ?? {}
    : {};
  const cashSeized = {
    cash: Math.floor(Math.max(0, Number(balances.cash ?? 0)) * 0.05),
    "dirty-cash": Math.floor(Math.max(0, Number(balances["dirty-cash"] ?? 0)) * 0.12)
  };
  const resourcesSeized = Object.fromEntries(
    Object.entries(balances)
      .filter(([key]) => key !== "cash" && key !== "dirty-cash" && key !== "gang-members")
      .map(([key, value]) => [key, Math.floor(Math.max(0, Number(value ?? 0)) * 0.08)])
      .filter(([, value]) => Number(value) > 0)
  );
  const wantedPressure = Math.max(1, policeState.wantedLevel);

  return {
    cashSeized,
    resourcesSeized,
    gangMembersLost: Math.floor(Math.max(0, Number(balances["gang-members"] ?? 0)) * 0.03),
    districtLockdownMinutes: Math.min(120, 15 + wantedPressure * 5),
    heatReduced: Math.min(policeState.heat, Math.max(10, Math.floor(policeState.heat * 0.2)))
  };
};

import type { PendingRaid, PoliceEvent, PoliceState } from "@empire/shared-types";
import type { CoreGameState } from "../../entities";
import type { CoreEvent } from "../../events";
import { CORE_EVENT_TYPES, createEvent } from "../../events";
import type { GameCoreContext } from "../../engine/context";
import { createPlayerPoliceState } from "../../handlers/playerPoliceState";
import { createRaidPreviewConsequences } from "./raidPreview";
import { resolveWantedLevel } from "./wantedLevel";
import { resolvePoliceConfig } from "./policeConfig";
import { calculatePlayerPolicePressure } from "./policePressure";
import { resolveCityHallPoliceMitigation, shouldCreateRaidAfterCityHallMitigation } from "./cityHallPoliceMitigation";
import {
  createPendingRaidMessage,
  createRaidReason,
  createWarningIfAllowed,
  ensureFlag,
  getOpenPendingRaids,
  isRaidCooldownActive,
  resolveRaidSeverity
} from "./raidTriggerHelpers";

const RAID_PENDING_FLAG = "raid:pending";

export type RaidTriggerDecisionType =
  | "no_raid"
  | "warning_only"
  | "pending_raid_created"
  | "political_cover_delayed"
  | "existing_pending_raid_kept"
  | "cooldown_active";

export interface RaidTriggerDecision {
  playerId: string;
  type: RaidTriggerDecisionType;
  aggregatePressure: number;
  raidId?: string;
}

/**
 * Responsibility: Creates warning and pending-raid police state from aggregate pressure.
 * Belongs here: authoritative police trigger decisions.
 * Does not belong here: applying raid penalties or UI formatting.
 */
export const triggerRaid = (
  state: CoreGameState,
  context?: GameCoreContext
): { nextState: CoreGameState; events: CoreEvent[]; decisions: RaidTriggerDecision[] } => {
  const config = resolvePoliceConfig(context);
  let changed = false;
  let nextPoliceStatesById = state.policeStatesById;
  const events: CoreEvent[] = [];
  const decisions: RaidTriggerDecision[] = [];
  const currentTick = state.root.tick;

  for (const player of Object.values(state.playersById)) {
    const pressure = calculatePlayerPolicePressure(
      {
        ...state,
        policeStatesById: nextPoliceStatesById
      },
      player.id,
      context
    );
    const currentPoliceState = nextPoliceStatesById[player.policeStateId]
      ?? createPlayerPoliceState(player, currentTick);

    if (pressure.riskTier === "low") {
      decisions.push({ playerId: player.id, type: "no_raid", aggregatePressure: pressure.aggregatePressure });
      continue;
    }

    if (pressure.riskTier === "medium") {
      const warning = createWarningIfAllowed(currentPoliceState, pressure.aggregatePressure, currentTick, config.raidCooldownTicks);
      if (!warning) {
        decisions.push({ playerId: player.id, type: "cooldown_active", aggregatePressure: pressure.aggregatePressure });
        continue;
      }
      nextPoliceStatesById = {
        ...nextPoliceStatesById,
        [currentPoliceState.id]: warning.nextPoliceState
      };
      changed = true;
      events.push(warning.event);
      decisions.push({ playerId: player.id, type: "warning_only", aggregatePressure: pressure.aggregatePressure });
      continue;
    }

    const existingOpenRaids = getOpenPendingRaids(currentPoliceState);
    if (existingOpenRaids.length >= Math.max(1, config.maxPendingRaidsPerPlayer)) {
      decisions.push({
        playerId: player.id,
        type: "existing_pending_raid_kept",
        aggregatePressure: pressure.aggregatePressure,
        raidId: existingOpenRaids[0]?.raidId
      });
      continue;
    }

    if (isRaidCooldownActive(currentPoliceState, currentTick, config.raidCooldownTicks)) {
      decisions.push({ playerId: player.id, type: "cooldown_active", aggregatePressure: pressure.aggregatePressure });
      continue;
    }

    const severity = resolveRaidSeverity(pressure.aggregatePressure, config.extremePressureRaidThreshold);
    const targetDistrictId = pressure.hottestDistrictHeat >= Math.max(0, config.districtTargetHeatThreshold)
      ? pressure.hottestDistrictId
      : null;
    const raidId = `police:raid:${player.id}:${currentTick}:${(currentPoliceState.pendingRaids ?? []).length + 1}`;
    const cityHallMitigation = resolveCityHallPoliceMitigation({
      state,
      context,
      playerId: player.id,
      targetDistrictId,
      severity,
      rollSeed: `${state.serverInstance.worldSeed}:city-hall-police-cover:${player.id}:${targetDistrictId ?? "none"}:${severity}:${currentTick}`
    });
    if (!shouldCreateRaidAfterCityHallMitigation(cityHallMitigation)) {
      decisions.push({
        playerId: player.id,
        type: "political_cover_delayed",
        aggregatePressure: pressure.aggregatePressure
      });
      continue;
    }
    const previewConsequences = createRaidPreviewConsequences(
      state,
      player.id,
      severity,
      targetDistrictId,
      context
    );
    const pendingRaid: PendingRaid = {
      raidId,
      playerId: player.id,
      targetDistrictId: targetDistrictId ?? undefined,
      severity,
      reason: createRaidReason(pressure.aggregatePressure, targetDistrictId),
      createdAtTick: currentTick,
      expiresAtTick: currentTick + Math.max(1, config.pendingRaidTtlTicks),
      status: "pending",
      previewConsequences,
      sourcePressure: pressure.aggregatePressure
    };
    const policeEvent = createPoliceEvent({
      id: `police:event:${raidId}:pending`,
      type: "police-raid-pending",
      playerId: player.id,
      districtId: targetDistrictId ?? undefined,
      severity,
      message: createPendingRaidMessage(severity),
      createdAtTick: currentTick,
      payload: {
        raidId,
        sourcePressure: pressure.aggregatePressure,
        previewConsequences
      }
    });
    const nextPoliceState: PoliceState = {
      ...currentPoliceState,
      wantedLevel: Math.max(currentPoliceState.wantedLevel, resolveWantedLevel(currentPoliceState.heat)),
      activeFlags: ensureFlag(currentPoliceState.activeFlags, RAID_PENDING_FLAG),
      pendingRaids: [...(currentPoliceState.pendingRaids ?? []), pendingRaid],
      policeEvents: [policeEvent, ...(currentPoliceState.policeEvents ?? [])].slice(0, 12),
      lastRaidCreatedAtTick: currentTick,
      version: currentPoliceState.version + (nextPoliceStatesById[currentPoliceState.id] ? 1 : 0)
    };

    nextPoliceStatesById = {
      ...nextPoliceStatesById,
      [nextPoliceState.id]: nextPoliceState
    };
    changed = true;
    events.push(
      createEvent(CORE_EVENT_TYPES.policeRaidTriggered, {
        playerId: player.id,
        policeStateId: nextPoliceState.id,
        raidId,
        status: "pending",
        heat: nextPoliceState.heat,
        wantedLevel: nextPoliceState.wantedLevel,
        aggregatePressure: pressure.aggregatePressure,
        playerHeatPressure: pressure.playerHeatPressure,
        districtHeatPressure: pressure.districtHeatPressure,
        threshold: config.highPressureRaidThreshold,
        severity,
        targetDistrictId,
        previewConsequences,
        raidResult: previewConsequences,
        cashSeized: {
          "dirty-cash": previewConsequences.seizedDirtyCash
        },
        resourcesSeized: previewConsequences.seizedResources,
        gangMembersLost: 0,
        districtLockdownTicks: previewConsequences.lockdownUntilTick
          ? Math.max(0, previewConsequences.lockdownUntilTick - currentTick)
          : 0,
        heatReduced: previewConsequences.heatReducedBy,
        cityHallMitigation
      })
    );
    decisions.push({
      playerId: player.id,
      type: "pending_raid_created",
      aggregatePressure: pressure.aggregatePressure,
      raidId
    });
  }

  return {
    nextState: changed
      ? {
          ...state,
          policeStatesById: nextPoliceStatesById
        }
      : state,
    events,
    decisions
  };
};

const createPoliceEvent = (event: PoliceEvent): PoliceEvent => event;

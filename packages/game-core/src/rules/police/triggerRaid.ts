import { applyTriggeredRaidConsequences } from "./applyTriggeredRaidConsequences";
import type { PendingRaid, PoliceState } from "@empire/shared-types";
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
import { getCurrentDayNightPhase, getDayNightModifiers } from "../day-night/dayNight";
import { countOpenPendingRaids, resolveMaxConcurrentRaidsForPhase } from "./raidConcurrency";
import {
  createPendingRaidMessage,
  createRaidReason,
  createWarningIfAllowed,
  ensureFlag,
  getOpenPendingRaids,
  isRaidCooldownActive,
  resolveRaidSeverity
} from "./raidTriggerHelpers";
import { resolveScheduledRaidCandidates } from "./raidOpeningTarget";
import { createRaidTriggerEvaluation, type RaidTriggerEvaluation } from "./raidTriggerEvaluation";
import type { RaidTriggerDecision } from "./raidTriggerTypes";
export type { RaidTriggerDecision, RaidTriggerDecisionType } from "./raidTriggerTypes";
export type { RaidTriggerEvaluation } from "./raidTriggerEvaluation";

const RAID_PENDING_FLAG = "raid:pending";

/** Schedules police activity and applies enabled immediate consequences once. */
export const triggerRaid = (
  state: CoreGameState,
  context?: GameCoreContext
): { nextState: CoreGameState; events: CoreEvent[]; decisions: RaidTriggerDecision[]; evaluation: RaidTriggerEvaluation | null } => {
  const config = resolvePoliceConfig(context);
  let nextPoliceStatesById = state.policeStatesById;
  const events: CoreEvent[] = [];
  const decisions: RaidTriggerDecision[] = [];
  const currentTick = state.root.tick;
  const gameTime = getCurrentDayNightPhase(state, context);
  const phaseId = gameTime.phaseId;
  const { activePlayers, scheduledWindow, scheduledTargetId } = resolveScheduledRaidCandidates(
    state,
    context,
    currentTick
  );
  if (!scheduledWindow) {
    return { nextState: state, events: [], decisions: [], evaluation: null };
  }
  const maxConcurrentRaids = resolveMaxConcurrentRaidsForPhase(config, phaseId);
  const raidDurationTicks = Math.max(1, Math.floor(Number(config.raidDurationTicks || config.pendingRaidTtlTicks || 1)));

  for (const player of activePlayers) {
    const pressure = calculatePlayerPolicePressure(
      {
        ...state,
        policeStatesById: nextPoliceStatesById
      },
      player.id,
      context
    );
    const isScheduledRaid = player.id === scheduledTargetId;
    const currentPoliceState = nextPoliceStatesById[player.policeStateId]
      ?? createPlayerPoliceState(player, currentTick);

    if (pressure.riskTier === "low" && !isScheduledRaid) {
      decisions.push({ playerId: player.id, type: "no_raid", aggregatePressure: pressure.aggregatePressure });
      continue;
    }

    if (pressure.riskTier === "medium" && !isScheduledRaid) {
      const warning = createWarningIfAllowed(currentPoliceState, pressure.aggregatePressure, currentTick, config.raidCooldownTicks);
      if (!warning) {
        decisions.push({ playerId: player.id, type: "cooldown_active", aggregatePressure: pressure.aggregatePressure });
        continue;
      }
      nextPoliceStatesById = {
        ...nextPoliceStatesById,
        [currentPoliceState.id]: warning.nextPoliceState
      };
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

    if (countOpenPendingRaids(nextPoliceStatesById) >= maxConcurrentRaids) {
      decisions.push({
        playerId: player.id,
        type: "concurrent_raid_limit_active",
        aggregatePressure: pressure.aggregatePressure
      });
      continue;
    }

    const severityPressure = Math.floor(
      pressure.aggregatePressure * Math.max(0, Number(getDayNightModifiers(state, context).raidSeverityMultiplier ?? 1)) + 1e-9
    );
    const isInspection = isScheduledRaid
      && (pressure.riskTier === "low" || pressure.riskTier === "medium");
    const severity = isInspection
      ? "low"
      : resolveRaidSeverity(severityPressure, config.extremePressureRaidThreshold);
    const targetDistrictId = isScheduledRaid || pressure.hottestDistrictHeat >= Math.max(0, config.districtTargetHeatThreshold)
      ? pressure.hottestDistrictId ?? Object.values(state.districtsById)
        .filter((district) => district.ownerPlayerId === player.id && district.status !== "destroyed")
        .sort((left, right) => left.id.localeCompare(right.id))[0]?.id ?? null
      : null;
    const raidId = `police:raid:${player.id}:${currentTick}:${(currentPoliceState.pendingRaids ?? []).length + 1}`;
    const cityHallMitigation = isInspection ? null : resolveCityHallPoliceMitigation({
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
      kind: isInspection ? "inspection" : "raid",
      explanation: isInspection
        ? "Pravidelná namátková kontrola města. Kontroly se střídají mezi hráči; tvůj tlak policie neodůvodňuje ostrou razii. Bez zabavení zásob, peněz a bez uzavření budov."
        : `Zásah kvůli vysokému tlaku policie (${pressure.aggregatePressure}). Započítává se hledanost hráče i provoz jeho čtvrtí.`,
      reason: isScheduledRaid
        ? `scheduled-${scheduledWindow.boundary}:${pressure.aggregatePressure}:district:${targetDistrictId ?? "none"}`
        : createRaidReason(pressure.aggregatePressure, targetDistrictId),
      createdAtTick: currentTick,
      expiresAtTick: currentTick + (isInspection
        ? Math.max(1, Math.ceil(10 * 60_000 / (context?.config.tickRateMs ?? 10_000)))
        : raidDurationTicks),
      status: "pending",
      previewConsequences,
      sourcePressure: pressure.aggregatePressure
    };
    const policeEvent = {
      id: `police:event:${raidId}:pending`,
      type: "police-raid-pending",
      playerId: player.id,
      districtId: targetDistrictId ?? undefined,
      severity,
      message: isInspection ? "Probíhá rutinní policejní kontrola. Nízký tlak policie: bez konfiskací a omezení provozu." : createPendingRaidMessage(severity),
      createdAtTick: currentTick,
      payload: {
        raidId,
        kind: pendingRaid.kind,
        explanation: pendingRaid.explanation,
        sourcePressure: pressure.aggregatePressure,
        previewConsequences
      }
    };
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
        kind: pendingRaid.kind,
        explanation: pendingRaid.explanation,
        severity,
        targetDistrictId,
        previewConsequences,
        raidResult: previewConsequences,
        cashSeized: {
          "dirty-cash": previewConsequences.seizedDirtyCash
        },
        resourcesSeized: previewConsequences.seizedResources,
        populationLost: 0,
        districtLockdownTicks: previewConsequences.lockdownUntilTick
          ? Math.max(0, previewConsequences.lockdownUntilTick - currentTick)
          : 0,
        heatReduced: previewConsequences.heatReducedBy,
        courtMitigationPct: previewConsequences.courtMitigationPct ?? 0,
        courtBuildingsOwned: previewConsequences.courtBuildingsOwned ?? 0,
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

  const { evaluation, policeScheduleState } = createRaidTriggerEvaluation(
    scheduledWindow,
    currentTick,
    activePlayers.length,
    decisions,
    state.policeScheduleState?.version ?? 0
  );

  const scheduledState = { ...state, policeStatesById: nextPoliceStatesById, policeScheduleState };
  const applied = applyTriggeredRaidConsequences(scheduledState, decisions, context);
  events.push(...applied.events);
  const nextState = applied.nextState;
  return { nextState, events, decisions, evaluation };
};

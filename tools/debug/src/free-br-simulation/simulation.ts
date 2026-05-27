import { resolveModeConfig } from "@empire/game-config";
import { addAuditEvent } from "./audit-log";
import { maybeRunAllianceStep } from "./alliance-simulation";
import { createFreeBrPlayers } from "./bot-player";
import {
  FREE_BR_DEFAULT_START_AT,
  FREE_BR_STEP_MINUTES
} from "./constants";
import {
  applyPassiveIncomeAndHeatDecay,
  maybeRunPoliceRaids
} from "./economy-actions";
import {
  maybeResolveVictory,
  maybeRunElimination,
  recordTimelineSnapshot
} from "./lifecycle";
import { buildMatrixReport } from "./matrix";
import { runBotActionsForStep } from "./player-actions";
import { buildReport } from "./report-builder";
import { resolveFreeBrScenario } from "./scenarios";
import { createSeededRng } from "./seeded-rng";
import {
  assignPlacements,
  findLeader
} from "./final-score";
import {
  createEmptyPlayerStats,
  recordDangerZoneAppearances,
  ticksPerHour
} from "./state-helpers";
import type {
  FreeBrMatrixReport,
  FreeBrMutablePlayerStats,
  FreeBrScenarioName,
  FreeBrSimulationOptions,
  FreeBrSimulationReport,
  FreeBrSimulationState
} from "./types";
import { chooseStartDistrictIds, createWorldDistricts } from "./world";

export const runFreeBrSimulation = (options: FreeBrSimulationOptions = {}): FreeBrSimulationReport => {
  const config = resolveModeConfig("free");
  const scenario = resolveFreeBrScenario(options.scenario);
  const seed = String(options.seed ?? `${scenario.name}:12345`);
  const rng = createSeededRng(seed);
  const startAtMs = Date.parse(options.startAtIso ?? FREE_BR_DEFAULT_START_AT);
  const districts = createWorldDistricts(rng);
  const startDistrictIds = chooseStartDistrictIds(districts);
  const players = createFreeBrPlayers(rng, scenario, startDistrictIds);

  for (const player of players) {
    const district = districts.find((candidate) => candidate.id === player.homeDistrictId);
    if (!district) continue;
    district.ownerPlayerId = player.id;
    district.status = "controlled";
    district.ownerHistory.push({ tick: 0, ownerPlayerId: player.id });
  }

  const state: FreeBrSimulationState = {
    config,
    seed,
    scenario,
    startAtMs: Number.isFinite(startAtMs) ? startAtMs : Date.parse(FREE_BR_DEFAULT_START_AT),
    tick: 0,
    players,
    districts,
    alliances: [],
    events: [],
    timeline: [],
    eliminations: [],
    stats: Object.fromEntries(players.map((player) => [player.id, createEmptyPlayerStats()])) as Record<string, FreeBrMutablePlayerStats>,
    nextEliminationTick: config.balance.elimination?.firstEliminationTick ?? 0,
    lastEliminationTick: null,
    victoryHoldStartTick: null,
    victoryLeaderId: null,
    winner: null,
    winReason: "ongoing",
    hardTimeoutReached: false,
    finalLockdown: {
      status: "inactive",
      startedAtTick: null,
      endedAtTick: null,
      lastUpdatedTick: 0,
      activeElapsedTicks: 0,
      remainingActiveTicks: config.balance.finalLockdown?.activeDurationTicks ?? 0,
      pausedTicks: 0,
      top3: []
    },
    hourlyCounters: { attacks: 0, occupations: 0, spies: 0, buildingActions: 0 },
    counters: {
      destroyedDistricts: 0,
      downtownCaptures: 0,
      rareBuildingActions: 0,
      neutralizedDistrictsAfterEliminations: 0,
      quietHoursDeferredEliminations: 0,
      attacksDuringFinalLockdown: 0,
      allianceCoordinatedAttacks: 0,
      alliancesAgainstDowntownLeader: 0,
      dirtyCashSeized: 0,
      resourceSeized: 0
    }
  };

  const configuredHardTimeoutTicks = config.balance.hardTimeoutTicks
    ?? Math.ceil((168 * 60 * 60 * 1000) / config.tickRateMs);
  const maxTicks = Math.min(
    Math.ceil(((options.hours ?? 168) * 60 * 60 * 1000) / config.tickRateMs),
    configuredHardTimeoutTicks
  );
  const requestedMaxTicks = Math.ceil(((options.hours ?? 168) * 60 * 60 * 1000) / config.tickRateMs);
  const finalLockdownSafetyTicks = (config.balance.finalLockdown?.activeDurationTicks ?? 0) + ticksPerHour(state) * 8;
  const simulationStopTick = requestedMaxTicks + finalLockdownSafetyTicks;
  const stepTicks = Math.max(1, Math.round((FREE_BR_STEP_MINUTES * 60 * 1000) / config.tickRateMs));

  recordTimelineSnapshot(state);
  while ((state.tick < maxTicks || isFinalLockdownRunning(state)) && state.tick < simulationStopTick && !state.winner && !state.hardTimeoutReached) {
    state.tick += stepTicks;
    applyPassiveIncomeAndHeatDecay(state, stepTicks);
    maybeRunAllianceStep(state, rng);
    runBotActionsForStep(state, rng);
    maybeRunPoliceRaids(state, rng);
    maybeRunElimination(state);
    maybeResolveVictory(state);

    if (state.tick % ticksPerHour(state) === 0) {
      recordDangerZoneAppearances(state);
      recordTimelineSnapshot(state);
      state.hourlyCounters = { attacks: 0, occupations: 0, spies: 0, buildingActions: 0 };
    }
  }

  if (!state.winner && state.tick >= configuredHardTimeoutTicks && state.finalLockdown.status === "inactive") {
    state.hardTimeoutReached = true;
    state.winReason = "timeout_no_winner";
    addAuditEvent(state, {
      player: findLeader(state),
      actionType: "victory",
      result: "hard-timeout",
      notes: "Hard timeout reached before Top 8 and Final Lockdown."
    });
  }

  assignPlacements(state);
  return buildReport(state);
};

export const runFreeBrMatrix = (options: FreeBrSimulationOptions & { scenarios?: FreeBrScenarioName[] } = {}): FreeBrMatrixReport => {
  const runs = Math.max(1, Math.floor(options.runs ?? 50));
  const scenarioNames = options.scenarios ?? [options.scenario ?? "canonical-20p"];
  const reports: FreeBrSimulationReport[] = [];

  for (const scenario of scenarioNames) {
    for (let run = 0; run < runs; run += 1) {
      reports.push(runFreeBrSimulation({
        ...options,
        scenario,
        seed: `${options.seed ?? "matrix"}:${scenario}:${run + 1}`
      }));
    }
  }

  return buildMatrixReport(reports, scenarioNames, runs);
};

const isFinalLockdownRunning = (state: FreeBrSimulationState): boolean =>
  state.finalLockdown.status === "active" || state.finalLockdown.status === "paused";

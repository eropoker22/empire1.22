import { addAuditEvent, formatLocalTime } from "./audit-log";
import { activeAlliances } from "./alliance-simulation";
import {
  createFinalEmpireRanking,
  findLeader,
  resolveActivePlacement
} from "./final-score";
import {
  countDowntownOwners,
  createEliminationScore,
  describeWeakness,
  getBottomPlayers,
  getOwnedDistricts,
  neutralizePlayerDistricts,
} from "./state-helpers";
import {
  countActiveAndQuietTicks,
  isQuietHours,
  resolveQuietHoursResumeTick,
  tickToHour,
  ticksPerHour
} from "./time-helpers";
import type { FreeBrEliminationAudit, FreeBrSimulationState, FreeBrTimelineSnapshot } from "./types";

export const maybeRunElimination = (state: FreeBrSimulationState): void => {
  const config = state.config.balance.elimination;
  if (!config?.enabled) return;
  const activePlayers = state.players.filter((player) => player.status === "active");
  if (activePlayers.length <= config.minActivePlayers) return;
  if (state.tick < state.nextEliminationTick) return;

  if (isQuietHours(state, state.tick)) {
    state.nextEliminationTick = resolveQuietHoursResumeTick(state, state.tick);
    state.counters.quietHoursDeferredEliminations += 1;
    addAuditEvent(state, {
      player: null,
      actionType: "elimination",
      result: "deferred-quiet-hours",
      notes: `resume tick ${state.nextEliminationTick}`
    });
    return;
  }

  const bottom = getBottomPlayers(state, config.dangerZoneSize);
  const eliminated = bottom[0];
  if (!eliminated) return;
  const score = createEliminationScore(state, eliminated);
  const neutralizedDistricts = neutralizePlayerDistricts(state, eliminated.id);
  eliminated.status = "defeated";
  eliminated.allianceId = null;
  state.stats[eliminated.id].eliminatedAtTick = state.tick;
  state.stats[eliminated.id].finalPlacement = activePlayers.length;
  state.counters.neutralizedDistrictsAfterEliminations += neutralizedDistricts;

  const audit: FreeBrEliminationAudit = {
    tick: state.tick,
    hour: tickToHour(state, state.tick),
    simulatedTime: new Date(state.startAtMs + state.tick * state.config.tickRateMs).toISOString(),
    localTime: formatLocalTime(state),
    eliminatedPlayerId: eliminated.id,
    playerName: eliminated.name,
    factionId: eliminated.factionId,
    strategyId: eliminated.strategyId,
    finalPlacement: activePlayers.length,
    eliminationScore: score.score,
    controlledDistricts: score.controlledDistricts,
    influence: score.totalOwnedDistrictInfluence,
    cash: score.cleanCash,
    dirtyCash: score.dirtyCash,
    resources: score.totalResourceValue,
    activeBuildings: score.activeBuildingCount,
    population: score.population,
    reasonWhyWeak: describeWeakness(score),
    bottomThree: bottom.map((player) => player.id),
    deferredByQuietHours: false,
    neutralizedDistricts,
    largestBeneficiaryPlayerId: null
  };
  state.eliminations.push(audit);
  for (const player of bottom.slice(1)) state.stats[player.id].comebackCount += 1;
  state.nextEliminationTick = state.tick + config.intervalTicks;
  addAuditEvent(state, {
    player: eliminated,
    actionType: "elimination",
    result: "defeated",
    districtDelta: -neutralizedDistricts,
    notes: audit.reasonWhyWeak
  });
};

export const maybeResolveVictory = (state: FreeBrSimulationState): void => {
  if (state.winner) return;
  const finalConfig = state.config.balance.finalLockdown;
  if (finalConfig?.enabled) {
    maybeRunFinalLockdown(state);
    return;
  }
  const threshold = state.config.balance.districtControlVictoryThreshold ?? 1;
  const activeDistricts = state.districts.filter((district) => district.status !== "destroyed");
  const needed = Math.ceil(activeDistricts.length * threshold);
  const leader = findLeader(state);
  if (!leader) return;
  const leaderDistricts = getOwnedDistricts(state, leader.id).length;
  const allianceDistricts = leader.allianceId
    ? state.districts.filter((district) => {
        const owner = state.players.find((player) => player.id === district.ownerPlayerId);
        return owner?.allianceId === leader.allianceId;
      }).length
    : 0;
  const controlId = allianceDistricts >= leaderDistricts && leader.allianceId ? leader.allianceId : leader.id;
  const controlled = Math.max(leaderDistricts, allianceDistricts);
  const ageReady = state.tick >= (state.config.balance.minimumVictoryTicks ?? 0);
  if (!ageReady || controlled < needed) {
    state.victoryHoldStartTick = null;
    state.victoryLeaderId = null;
    return;
  }
  if (state.victoryLeaderId !== controlId) {
    state.victoryLeaderId = controlId;
    state.victoryHoldStartTick = state.tick;
    return;
  }
  if (state.victoryHoldStartTick !== null && state.tick - state.victoryHoldStartTick >= (state.config.balance.districtControlHoldTicks ?? 0)) {
    state.winner = controlId;
    state.winReason = controlId.startsWith("alliance:") ? "alliance_control_map" : "player_control_map";
    addAuditEvent(state, {
      player: leader,
      actionType: "victory",
      result: state.winReason,
      notes: `${controlled}/${activeDistricts.length} active districts controlled after hold window`
    });
  }
};

const maybeRunFinalLockdown = (state: FreeBrSimulationState): void => {
  const finalConfig = state.config.balance.finalLockdown;
  if (!finalConfig?.enabled || state.winner) return;
  const activePlayers = state.players.filter((player) => player.status === "active");
  if (state.finalLockdown.status === "inactive" && activePlayers.length <= finalConfig.triggerActivePlayers) {
    state.finalLockdown = {
      status: isQuietHours(state, state.tick) ? "paused" : "active",
      startedAtTick: state.tick,
      endedAtTick: null,
      lastUpdatedTick: state.tick,
      activeElapsedTicks: 0,
      remainingActiveTicks: finalConfig.activeDurationTicks,
      pausedTicks: 0,
      top3: []
    };
    state.nextEliminationTick = Number.POSITIVE_INFINITY;
    addAuditEvent(state, {
      player: null,
      actionType: "victory",
      result: "final_lockdown_started",
      notes: "Přežilo 8 gangů. Začíná 12 aktivních hodin do rozsudku."
    });
    return;
  }

  if (state.finalLockdown.status !== "active" && state.finalLockdown.status !== "paused") return;

  const { activeTicks, pausedTicks } = countActiveAndQuietTicks(state, state.finalLockdown.lastUpdatedTick, state.tick);
  state.finalLockdown.activeElapsedTicks = Math.min(
    finalConfig.activeDurationTicks,
    state.finalLockdown.activeElapsedTicks + activeTicks
  );
  state.finalLockdown.pausedTicks += pausedTicks;
  state.finalLockdown.remainingActiveTicks = Math.max(0, finalConfig.activeDurationTicks - state.finalLockdown.activeElapsedTicks);
  state.finalLockdown.lastUpdatedTick = state.tick;
  state.finalLockdown.status = state.finalLockdown.remainingActiveTicks <= 0
    ? "resolved"
    : isQuietHours(state, state.tick)
      ? "paused"
      : "active";

  if (state.finalLockdown.status !== "resolved") return;

  const ranking = createFinalEmpireRanking(state);
  state.finalLockdown.endedAtTick = state.tick;
  state.finalLockdown.top3 = ranking.slice(0, finalConfig.topRankCount).map((entry, index) => ({
    playerId: entry.player.id,
    score: Math.round(entry.score.score * 100) / 100,
    rank: index + 1,
    scoreBreakdown: entry.score.scoreBreakdown
  }));
  state.winner = ranking[0]?.player.id ?? null;
  state.winReason = "final_lockdown_score";
  addAuditEvent(state, {
    player: ranking[0]?.player ?? null,
    actionType: "victory",
    result: "final_lockdown_score",
    notes: `Final Lockdown resolved. Top 3: ${state.finalLockdown.top3.map((entry) => `${entry.rank}. ${entry.playerId}`).join(", ")}`
  });
};

export const recordTimelineSnapshot = (state: FreeBrSimulationState): void => {
  const leader = findLeader(state);
  const bottomThree = getBottomPlayers(state, state.config.balance.elimination?.dangerZoneSize ?? 3).map((player) => player.id);
  const snapshot: FreeBrTimelineSnapshot = {
    hour: tickToHour(state, state.tick),
    tick: state.tick,
    activePlayers: state.players.filter((player) => player.status === "active").length,
    leader: leader?.id ?? null,
    leaderFaction: leader?.factionId ?? null,
    leaderStrategy: leader?.strategyId ?? null,
    leaderDistricts: leader ? getOwnedDistricts(state, leader.id).length : 0,
    bottomThree,
    attacksThisHour: state.hourlyCounters.attacks,
    occupationsThisHour: state.hourlyCounters.occupations,
    spyActionsThisHour: state.hourlyCounters.spies,
    buildingActionsThisHour: state.hourlyCounters.buildingActions,
    alliancesActive: activeAlliances(state).length,
    downtownOwners: countDowntownOwners(state),
    policePressure: Math.round(state.players.reduce((total, player) => total + player.heat, 0)),
    upcomingEliminationCountdownHours: state.nextEliminationTick > state.tick
      && Number.isFinite(state.nextEliminationTick)
      ? Math.round(((state.nextEliminationTick - state.tick) / ticksPerHour(state)) * 10) / 10
      : null,
    quietHoursActive: isQuietHours(state, state.tick)
  };
  state.timeline.push(snapshot);
  for (const player of state.players) {
    const owned = getOwnedDistricts(state, player.id).length;
    state.stats[player.id].controlledDistrictsOverTime.push({ hour: snapshot.hour, districts: owned });
    state.stats[player.id].maxControlledDistricts = Math.max(state.stats[player.id].maxControlledDistricts, owned);
    if (player.status === "active") state.stats[player.id].finalPlacement = resolveActivePlacement(state, player);
  }
};

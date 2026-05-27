import {
  createAllianceAudit,
  createDistrictAudit,
  createDowntownAudit,
  createPoliceAudit
} from "./district-audits";
import {
  FREE_BR_DISTRICT_COUNT,
  FREE_BR_DOWNTOWN_COUNT,
  FREE_BR_PLAYER_COUNT
} from "./constants";
import { average, groupBy, round1, round2, sum } from "./math";
import {
  createEliminationScore,
  findLeader,
  getOwnedDistricts,
  resolveActivePlacement,
  tickToHour
} from "./state-helpers";
import type {
  FreeBrPlayer,
  FreeBrSimulationReport,
  FreeBrSimulationState,
  FreeBrStrategyId
} from "./types";

export const buildReport = (state: FreeBrSimulationState): FreeBrSimulationReport => {
  const players = state.players.map((player) => createPlayerAudit(state, player))
    .sort((left, right) => left.finalPlacement - right.finalPlacement);
  const activeDistricts = state.districts.filter((district) => district.status !== "destroyed");
  const leader = findLeader(state);
  const summary = {
    seed: state.seed,
    scenario: state.scenario.name,
    totalSimulatedHours: tickToHour(state, state.tick),
    totalTicks: state.tick,
    winner: state.winner,
    winReason: state.winReason,
    finalActivePlayers: state.players.filter((player) => player.status === "active").length,
    totalEliminations: state.eliminations.length,
    totalAttacks: sum(players.map((player) => player.attacksMade)),
    successfulAttacks: sum(players.map((player) => player.attacksWon)),
    failedAttacks: sum(players.map((player) => player.attacksLost)),
    destroyedDistricts: state.counters.destroyedDistricts,
    occupiedNeutralDistricts: sum(players.map((player) => player.occupiedNeutralDistricts)),
    totalSpyActions: sum(players.map((player) => player.spyActions)),
    totalBuildingActions: sum(players.map((player) => player.buildingActions)),
    totalCraftActions: sum(players.map((player) => player.craftActions)),
    totalPoliceRaids: sum(players.map((player) => player.policeRaidsReceived)),
    totalHeatGenerated: Math.round(sum(players.map((player) => player.heatGenerated))),
    totalAlliancesFormed: state.alliances.length,
    totalAlliancesBroken: state.alliances.filter((alliance) => alliance.status === "broken").length,
    totalBetrayals: sum(players.map((player) => player.betrayals)),
    totalDowntownCaptures: state.counters.downtownCaptures,
    totalRareBuildingActions: state.counters.rareBuildingActions,
    totalDangerZoneAppearances: sum(players.map((player) => player.dangerZoneAppearances)),
    totalDangerZoneComebacks: sum(players.map((player) => player.comebackCount)),
    totalNeutralizedDistrictsAfterEliminations: state.counters.neutralizedDistrictsAfterEliminations,
    victoryThresholdDistricts: Math.ceil(activeDistricts.length * (state.config.balance.districtControlVictoryThreshold ?? 0.75)),
    leaderDistrictsAtEnd: leader ? getOwnedDistricts(state, leader.id).length : 0,
    hardTimeoutReached: state.hardTimeoutReached,
    quietHoursDeferredEliminations: state.counters.quietHoursDeferredEliminations
  };

  return {
    summary,
    configSnapshot: {
      tickRateMs: state.config.tickRateMs,
      players: FREE_BR_PLAYER_COUNT,
      districts: FREE_BR_DISTRICT_COUNT,
      downtownDistricts: FREE_BR_DOWNTOWN_COUNT,
      firstEliminationTick: state.config.balance.elimination?.firstEliminationTick ?? 0,
      eliminationIntervalTicks: state.config.balance.elimination?.intervalTicks ?? 0,
      dangerZoneSize: state.config.balance.elimination?.dangerZoneSize ?? 0,
      topStop: state.config.balance.elimination?.minActivePlayers ?? 0,
      victoryThreshold: state.config.balance.districtControlVictoryThreshold ?? 0.75,
      minimumVictoryTicks: state.config.balance.minimumVictoryTicks ?? 0,
      controlHoldTicks: state.config.balance.districtControlHoldTicks ?? 0,
      hardTimeoutTicks: state.config.balance.hardTimeoutTicks ?? 0
    },
    approximations: [
      "Mapa je server-side simulační grid 13x13 minus 8 okrajových polí, ne reálná browser canvas geometrie.",
      "Bot akce používají canonical cooldowny/config hodnoty, ale neprocházejí celý command handler pipeline.",
      "Police/heat raid model používá Free police thresholds a seizure procenta, ale pending raid UX stavy jsou agregované.",
      "Craft a building actions používají canonical config cooldown/output, ale výroba se pro audit zapíše okamžitě jako completion approximation.",
      "Aliance jsou simulační sociální vrstva nad core configem; core alliance command handler zatím není použit jako autoritativní API."
    ],
    players,
    factions: createFactionAudits(state, players),
    strategies: createStrategyAudits(state, players),
    districts: createDistrictAudit(state),
    timeline: state.timeline,
    eliminations: state.eliminations,
    alliances: createAllianceAudit(state),
    police: createPoliceAudit(state),
    downtown: createDowntownAudit(state),
    events: state.events
  };
};

const createPlayerAudit = (state: FreeBrSimulationState, player: FreeBrPlayer) => {
  const stats = state.stats[player.id];
  const finalControlledDistricts = getOwnedDistricts(state, player.id).length;
  const score = createEliminationScore(state, player).score;
  return {
    playerId: player.id,
    playerName: player.name,
    factionId: player.factionId,
    strategyId: player.strategyId,
    activityProfile: player.activityProfile,
    finalPlacement: stats.finalPlacement ?? (player.status === "active" ? resolveActivePlacement(state, player) : 20),
    survived: player.status === "active",
    eliminatedAtTick: stats.eliminatedAtTick,
    eliminatedAtHour: stats.eliminatedAtTick === null ? null : tickToHour(state, stats.eliminatedAtTick),
    maxControlledDistricts: stats.maxControlledDistricts,
    finalControlledDistricts,
    downtownDistrictsOwned: getOwnedDistricts(state, player.id).filter((district) => district.isDowntown).length,
    attacksMade: stats.attacksMade,
    attacksWon: stats.attacksWon,
    attacksLost: stats.attacksLost,
    districtsCaptured: stats.districtsCaptured,
    districtsLost: stats.districtsLost,
    occupiedNeutralDistricts: stats.occupiedNeutralDistricts,
    spyActions: stats.spyActions,
    buildingActions: stats.buildingActions,
    craftActions: stats.craftActions,
    policeRaidsReceived: stats.policeRaidsReceived,
    heatGenerated: Math.round(stats.heatGenerated),
    cashEarned: Math.round(stats.cashEarned),
    dirtyCashEarned: Math.round(stats.dirtyCashEarned),
    allianceCount: stats.allianceCount,
    betrayals: stats.betrayals,
    dangerZoneAppearances: stats.dangerZoneAppearances,
    comebackCount: stats.comebackCount,
    finalScore: Math.round(score),
    controlledDistrictsOverTime: stats.controlledDistrictsOverTime
  };
};

const createFactionAudits = (state: FreeBrSimulationState, players: ReturnType<typeof createPlayerAudit>[]) =>
  Object.entries(groupBy(players, (player) => player.factionId)).map(([factionId, entries]) => {
    const attackWins = sum(entries.map((entry) => entry.attacksWon));
    const attacks = sum(entries.map((entry) => entry.attacksMade));
    const top8 = entries.filter((entry) => entry.finalPlacement <= 8).length;
    const comebackAppearances = sum(entries.map((entry) => entry.dangerZoneAppearances));
    const verdict = top8 / Math.max(1, entries.length) > 0.75 && average(entries.map((entry) => entry.finalPlacement)) < 7
      ? "overpowered"
      : top8 === 0
        ? "weak"
        : entries.length < 2
          ? "needs more data"
          : "healthy";
    return {
      factionId,
      playersCount: entries.length,
      averagePlacement: round1(average(entries.map((entry) => entry.finalPlacement))),
      bestPlacement: Math.min(...entries.map((entry) => entry.finalPlacement)),
      survivalToTop8Count: top8,
      totalAttacks: attacks,
      attackWinRate: round2(attackWins / Math.max(1, attacks)),
      averageDistricts: round1(average(entries.map((entry) => entry.finalControlledDistricts))),
      averageCash: round1(average(entries.map((entry) => state.players.find((player) => player.id === entry.playerId)?.resources.cash ?? 0))),
      averageDirtyCash: round1(average(entries.map((entry) => state.players.find((player) => player.id === entry.playerId)?.resources["dirty-cash"] ?? 0))),
      averageHeat: round1(average(entries.map((entry) => state.players.find((player) => player.id === entry.playerId)?.heat ?? 0))),
      downtownControlTime: state.timeline.reduce((total, snapshot) => total + (snapshot.downtownOwners[factionId] ?? 0), 0),
      allianceParticipation: sum(entries.map((entry) => entry.allianceCount)),
      dangerZoneAppearances: comebackAppearances,
      comebackRate: round2(sum(entries.map((entry) => entry.comebackCount)) / Math.max(1, comebackAppearances)),
      verdict: verdict as "overpowered" | "healthy" | "weak" | "needs more data"
    };
  });

const createStrategyAudits = (state: FreeBrSimulationState, players: ReturnType<typeof createPlayerAudit>[]) =>
  Object.entries(groupBy(players, (player) => player.strategyId)).map(([strategyId, entries]) => ({
    strategyId: strategyId as FreeBrStrategyId,
    playersCount: entries.length,
    averagePlacement: round1(average(entries.map((entry) => entry.finalPlacement))),
    top8Rate: round2(entries.filter((entry) => entry.finalPlacement <= 8).length / Math.max(1, entries.length)),
    winRate: round2(entries.filter((entry) => state.winner === entry.playerId).length / Math.max(1, entries.length)),
    attackRate: round1(average(entries.map((entry) => entry.attacksMade))),
    expansionRate: round1(average(entries.map((entry) => entry.occupiedNeutralDistricts + entry.attacksWon))),
    allianceRate: round1(average(entries.map((entry) => entry.allianceCount))),
    downtownSuccessRate: round2(entries.filter((entry) => entry.downtownDistrictsOwned > 0).length / Math.max(1, entries.length)),
    dangerZoneComebackRate: round2(sum(entries.map((entry) => entry.comebackCount)) / Math.max(1, sum(entries.map((entry) => entry.dangerZoneAppearances)))),
    policeRaidRate: round1(average(entries.map((entry) => entry.policeRaidsReceived)))
  }));

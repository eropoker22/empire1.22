import { activeAlliances } from "./alliance-simulation";
import { average, countBy, countWeighted, round1, sum } from "./math";
import { createEliminationScore, getOwnedDistricts } from "./state-helpers";
import { tickToHour } from "./time-helpers";
import type { FreeBrPlayer, FreeBrSimulationState } from "./types";

export type FreeBrPlayerAuditShape = ReturnType<typeof createPlayerAuditForDowntown>;

export const createDistrictAudit = (state: FreeBrSimulationState) => {
  const churn = state.districts.map((district) => district.ownerHistory.length - 1);
  const mostContested = [...state.districts].sort((left, right) => (right.ownerHistory.length - left.ownerHistory.length))[0] ?? null;
  const mostValuable = [...state.districts].sort((left, right) => right.value - left.value)[0] ?? null;
  const firstDowntownCapture = state.counters.firstDowntownCapture;
  return {
    mostContestedDistrict: mostContested?.id ?? null,
    mostValuableDistrict: mostValuable?.id ?? null,
    firstDowntownCaptured: firstDowntownCapture
      ? {
          tick: firstDowntownCapture.tick,
          hour: tickToHour(state, firstDowntownCapture.tick),
          districtId: firstDowntownCapture.districtId,
          playerId: firstDowntownCapture.playerId,
          factionId: firstDowntownCapture.factionId,
          strategyId: firstDowntownCapture.strategyId
        }
      : null,
    downtownOwnerTimeline: state.timeline.map((snapshot) => ({ hour: snapshot.hour, owners: snapshot.downtownOwners })),
    districtOwnershipChurn: sum(churn),
    neutralizedDistrictsAfterEliminations: state.counters.neutralizedDistrictsAfterEliminations,
    destroyedDistricts: state.counters.destroyedDistricts,
    heatHotspots: [...state.districts]
      .sort((left, right) => right.heat - left.heat)
      .slice(0, 10)
      .map((district) => ({ districtId: district.id, heat: round1(district.heat), zone: district.zone }))
  };
};

export const createAllianceAudit = (state: FreeBrSimulationState) => {
  const formed = state.alliances.length;
  const broken = state.alliances.filter((alliance) => alliance.status === "broken").length;
  const betrayals = sum(Object.values(state.stats).map((stats) => stats.betrayals));
  const largest = [...state.alliances].sort((left, right) => right.members.length - left.members.length)[0] ?? null;
  return {
    formed,
    broken,
    betrayals,
    averageSize: round1(average(state.alliances.map((alliance) => alliance.members.length))),
    largestAlliance: { allianceId: largest?.id ?? null, size: largest?.members.length ?? 0 },
    activeAtEnd: activeAlliances(state).length,
    survivedDueToAlliance: state.players.filter((player) => player.status === "active" && player.allianceId).length,
    coordinatedAttacks: state.counters.allianceCoordinatedAttacks,
    byFaction: countBy(state.players.filter((player) => state.stats[player.id].allianceCount > 0), (player) => player.factionId),
    byStrategy: countBy(state.players.filter((player) => state.stats[player.id].allianceCount > 0), (player) => player.strategyId),
    records: state.alliances
  };
};

export const createPoliceAudit = (state: FreeBrSimulationState) => {
  const highest = [...state.players].sort((left, right) => right.heat - left.heat)[0] ?? null;
  return {
    totalRaids: sum(Object.values(state.stats).map((stats) => stats.policeRaidsReceived)),
    raidsByPlayer: Object.fromEntries(Object.entries(state.stats).map(([playerId, stats]) => [playerId, stats.policeRaidsReceived])),
    raidsByFaction: countWeighted(state.players, (player) => player.factionId, (player) => state.stats[player.id].policeRaidsReceived),
    raidsByStrategy: countWeighted(state.players, (player) => player.strategyId, (player) => state.stats[player.id].policeRaidsReceived),
    highestHeatPlayerId: highest?.id ?? null,
    highestHeat: round1(highest?.heat ?? 0),
    totalDirtyCashSeized: state.counters.dirtyCashSeized,
    totalResourceSeized: state.counters.resourceSeized
  };
};

export const createDowntownAudit = (state: FreeBrSimulationState) => {
  const first = createDistrictAudit(state).firstDowntownCaptured;
  const firstOwnerAudit = first ? createPlayerAuditForDowntown(state, state.players.find((player) => player.id === first.playerId) as FreeBrPlayer) : null;
  const maxHeld = Math.max(0, ...state.timeline.map((snapshot) => Math.max(0, ...Object.values(snapshot.downtownOwners))));
  const earlyOwnerWon = Boolean(first && state.winner === first.playerId);
  const verdict: "not a problem" | "mild but healthy" | "risky" | "broken" = earlyOwnerWon && maxHeld >= 4
    ? "broken"
    : (firstOwnerAudit?.finalPlacement ?? 20) <= 8 && maxHeld >= 3
      ? "risky"
      : maxHeld >= 2
        ? "mild but healthy"
        : "not a problem";
  return {
    verdict,
    firstCapturedAtHour: first?.hour ?? null,
    firstOwnerPlayerId: first?.playerId ?? null,
    earlyOwnerSurvivedTop8: (firstOwnerAudit?.finalPlacement ?? 99) <= 8,
    earlyOwnerWon,
    attacksOnDowntown: state.counters.attacksOnDowntown,
    alliancesAgainstDowntownLeader: state.counters.alliancesAgainstDowntownLeader,
    rareBuildingActions: state.counters.rareBuildingActions,
    ownerTimeline: state.timeline.map((snapshot) => ({ hour: snapshot.hour, owners: snapshot.downtownOwners })),
    maxDowntownHeldByOnePlayer: maxHeld
  };
};

const createPlayerAuditForDowntown = (state: FreeBrSimulationState, player: FreeBrPlayer) => {
  const stats = state.stats[player.id];
  return {
    finalPlacement: stats.finalPlacement ?? 20,
    finalScore: Math.round(createEliminationScore(state, player).score),
    downtownDistrictsOwned: getOwnedDistricts(state, player.id).filter((district) => district.isDowntown).length
  };
};

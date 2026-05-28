import type { SeededRng } from "./seeded-rng";
import type { FreeBrAlliance, FreeBrDistrict, FreeBrPlayer, FreeBrSimulationState } from "./types";
import { addAuditEvent } from "./audit-log";
import { getOwnedDistricts } from "./state-helpers";

const SIMULATION_MAX_ALLIANCE_SIZE = 4;

export const maybeRunAllianceStep = (state: FreeBrSimulationState, rng: SeededRng): void => {
  if (state.tick % ticksPerHour(state) !== 0) return;

  maybeBreakAlliance(state, rng);
  refreshAllianceSharedEnemies(state);
  maybeFormAlliance(state, rng);
};

export const activeAlliances = (state: FreeBrSimulationState): FreeBrAlliance[] =>
  state.alliances.filter((alliance) => alliance.status === "active");

export const resolveMaxAllianceSize = (state: FreeBrSimulationState): number =>
  Math.max(1, Math.min(SIMULATION_MAX_ALLIANCE_SIZE, Math.floor(state.config.balance.maxAllianceSize ?? SIMULATION_MAX_ALLIANCE_SIZE)));

export const getAllianceMembers = (state: FreeBrSimulationState, allianceId: string | null): FreeBrPlayer[] =>
  allianceId
    ? state.players.filter((player) => player.status === "active" && player.allianceId === allianceId)
    : [];

export const arePlayersAllied = (
  left: FreeBrPlayer | null | undefined,
  right: FreeBrPlayer | null | undefined
): boolean =>
  Boolean(left?.allianceId && right?.allianceId && left.allianceId === right.allianceId);

export const resolveAllianceAttackTargetScore = (
  state: FreeBrSimulationState,
  attacker: FreeBrPlayer,
  targetPlayerId: string | null,
  leader: FreeBrPlayer | null
): number => {
  if (!attacker.allianceId || !targetPlayerId) return 1;
  const target = state.players.find((player) => player.id === targetPlayerId) ?? null;
  if (arePlayersAllied(attacker, target)) return 0;

  const alliance = activeAlliances(state).find((candidate) => candidate.id === attacker.allianceId);
  if (!alliance) return 1;

  let score = 1;
  if (alliance.sharedEnemies.includes(targetPlayerId)) score *= 2.1;
  if (leader?.id === targetPlayerId) score *= 1.35;
  if (target && getOwnedDistricts(state, target.id).some((district) => district.isDowntown)) score *= 1.25;
  if (isAllianceCoordinatedAttack(state, attacker, targetPlayerId)) score *= 1.35;
  return score;
};

export const isAllianceCoordinatedAttack = (
  state: FreeBrSimulationState,
  attacker: FreeBrPlayer,
  targetPlayerId: string | null
): boolean => {
  if (!attacker.allianceId || !targetPlayerId) return false;
  const target = state.players.find((player) => player.id === targetPlayerId) ?? null;
  if (arePlayersAllied(attacker, target)) return false;
  const alliance = activeAlliances(state).find((candidate) => candidate.id === attacker.allianceId);
  if (alliance?.sharedEnemies.includes(targetPlayerId)) return true;
  const allies = getAllianceMembers(state, attacker.allianceId).filter((player) => player.id !== attacker.id);
  return allies.some((ally) => {
    const allyDistricts = getOwnedDistricts(state, ally.id);
    return allyDistricts.some((district) =>
      district.adjacentDistrictIds.some((adjacentId) => state.districts[adjacentId - 1]?.ownerPlayerId === targetPlayerId)
    );
  });
};

const maybeFormAlliance = (state: FreeBrSimulationState, rng: SeededRng): void => {
  const maxAllianceSize = resolveMaxAllianceSize(state);
  const candidates = state.players
    .filter((player) => player.status === "active" && !player.allianceId && player.alliancePreference > 0.25);
  if (candidates.length < 2) return;

  const leader = rng.pick(candidates);
  const leaderScore = leader.alliancePreference * state.scenario.allianceMultiplier;
  if (!rng.chance(leaderScore * 0.18)) return;

  const leaderDistricts = state.districts.filter((district) => district.ownerPlayerId === leader.id);
  const partners = candidates
    .filter((player) => player.id !== leader.id)
    .map((player) => ({
      player,
      score: compatibilityScore(state, leader, player, leaderDistricts)
    }))
    .filter((entry) => entry.score > 0.15)
    .sort((left, right) => right.score - left.score)
    .slice(0, maxAllianceSize - 1)
    .map((entry) => entry.player);

  if (partners.length === 0) return;

  const allianceId = `alliance:${state.alliances.length + 1}`;
  const members = [leader, ...partners].slice(0, maxAllianceSize);
  for (const member of members) {
    member.allianceId = allianceId;
    state.stats[member.id].allianceCount += 1;
  }

  const largestEnemy = findCurrentLeader(state)?.id ?? null;
  const alliance: FreeBrAlliance = {
    id: allianceId,
    members: members.map((member) => member.id),
    createdAtTick: state.tick,
    trustScore: Math.round((0.48 + rng.float(0, 0.42)) * 100) / 100,
    sharedEnemies: largestEnemy ? [largestEnemy] : [],
    helpedActions: 0,
    betrayalRisk: Math.round((0.08 + rng.float(0, 0.22)) * 100) / 100,
    status: "active",
    brokenAtTick: null,
    reason: largestEnemy ? "společný tlak proti leaderovi" : "geografická blízkost a přežití"
  };
  state.alliances.push(alliance);
  if (largestEnemy && state.districts.some((district) => district.ownerPlayerId === largestEnemy && district.isDowntown)) {
    state.counters.alliancesAgainstDowntownLeader += 1;
  }

  addAuditEvent(state, {
    player: leader,
    actionType: "form-alliance",
    result: "formed",
    notes: `${allianceId}: ${members.map((member) => member.name).join(", ")}`
  });
};

const maybeBreakAlliance = (state: FreeBrSimulationState, rng: SeededRng): void => {
  for (const alliance of activeAlliances(state)) {
    const members = alliance.members
      .map((playerId) => state.players.find((player) => player.id === playerId) ?? null)
      .filter((player): player is FreeBrPlayer => Boolean(player && player.status === "active"));
    if (members.length <= 1) {
      breakAlliance(state, alliance, members[0] ?? null, "členové byli eliminováni", false);
      continue;
    }
    const betrayalCandidate = members.find((player) => player.strategyId === "opportunist" || player.strategyId === "high-risk-criminal");
    const breakChance = alliance.betrayalRisk * (betrayalCandidate ? 0.13 : 0.06) * (1.1 - alliance.trustScore);
    if (rng.chance(breakChance)) {
      breakAlliance(state, alliance, betrayalCandidate ?? members[0], "nízká důvěra / změna výhodnosti", Boolean(betrayalCandidate));
    }
  }
};

const refreshAllianceSharedEnemies = (state: FreeBrSimulationState): void => {
  const leader = findCurrentLeader(state);
  for (const alliance of activeAlliances(state)) {
    const members = new Set(alliance.members);
    const enemies = new Set(alliance.sharedEnemies.filter((playerId) =>
      !members.has(playerId)
      && state.players.some((player) => player.id === playerId && player.status === "active")
    ));
    if (leader && !members.has(leader.id)) enemies.add(leader.id);

    const downtownThreat = state.players
      .filter((player) => player.status === "active" && !members.has(player.id))
      .sort((left, right) =>
        getOwnedDistricts(state, right.id).filter((district) => district.isDowntown).length
        - getOwnedDistricts(state, left.id).filter((district) => district.isDowntown).length
      )[0] ?? null;
    if (downtownThreat && getOwnedDistricts(state, downtownThreat.id).some((district) => district.isDowntown)) {
      enemies.add(downtownThreat.id);
    }

    alliance.sharedEnemies = [...enemies].slice(0, 3);
  }
};


const breakAlliance = (
  state: FreeBrSimulationState,
  alliance: FreeBrAlliance,
  actor: FreeBrPlayer | null,
  reason: string,
  betrayal: boolean
): void => {
  alliance.status = "broken";
  alliance.brokenAtTick = state.tick;
  alliance.reason = reason;
  for (const playerId of alliance.members) {
    const player = state.players.find((candidate) => candidate.id === playerId);
    if (player?.allianceId === alliance.id) player.allianceId = null;
  }
  if (betrayal && actor) {
    state.stats[actor.id].betrayals += 1;
  }
  addAuditEvent(state, {
    player: actor,
    actionType: betrayal ? "betray-alliance" : "break-alliance",
    result: "broken",
    notes: `${alliance.id}: ${reason}`
  });
};

const compatibilityScore = (
  state: FreeBrSimulationState,
  left: FreeBrPlayer,
  right: FreeBrPlayer,
  leftDistricts: FreeBrDistrict[]
): number => {
  const rightDistrictIds = new Set(state.districts.filter((district) => district.ownerPlayerId === right.id).map((district) => district.id));
  const near = leftDistricts.some((district) => district.adjacentDistrictIds.some((adjacentId) => rightDistrictIds.has(adjacentId))) ? 0.25 : 0;
  const sharedDanger = getDangerZonePlayerIds(state).includes(left.id) || getDangerZonePlayerIds(state).includes(right.id) ? 0.2 : 0;
  const strategy = (left.alliancePreference + right.alliancePreference) / 2;
  const sameFactionBonus = left.factionId === right.factionId ? 0.12 : 0;
  return strategy + near + sharedDanger + sameFactionBonus;
};

const findCurrentLeader = (state: FreeBrSimulationState): FreeBrPlayer | null => {
  const active = state.players.filter((player) => player.status === "active");
  return active.sort((left, right) => countDistricts(state, right.id) - countDistricts(state, left.id))[0] ?? null;
};

const getDangerZonePlayerIds = (state: FreeBrSimulationState): string[] => {
  const dangerZoneSize = state.config.balance.elimination?.dangerZoneSize ?? 3;
  return state.players
    .filter((player) => player.status === "active")
    .sort((left, right) => countDistricts(state, left.id) - countDistricts(state, right.id))
    .slice(0, dangerZoneSize)
    .map((player) => player.id);
};

const countDistricts = (state: FreeBrSimulationState, playerId: string): number =>
  getOwnedDistricts(state, playerId).length;

const ticksPerHour = (state: FreeBrSimulationState): number =>
  Math.max(1, Math.round((60 * 60 * 1000) / state.config.tickRateMs));

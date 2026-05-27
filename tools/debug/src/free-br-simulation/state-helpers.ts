import { compareEliminationScores, type PlayerEliminationScore } from "@empire/game-core";
import { sum } from "./math";
import type { SeededRng } from "./seeded-rng";
import type { FreeBrDistrict, FreeBrMutablePlayerStats, FreeBrPlayer, FreeBrSimulationState } from "./types";

export const assignPlacements = (state: FreeBrSimulationState): void => {
  const active = state.players
    .filter((player) => player.status === "active")
    .sort((left, right) => createEliminationScore(state, right).score - createEliminationScore(state, left).score);
  active.forEach((player, index) => {
    state.stats[player.id].finalPlacement = index + 1;
  });
};

export const neutralizePlayerDistricts = (state: FreeBrSimulationState, playerId: string): number => {
  let count = 0;
  for (const district of state.districts) {
    if (district.ownerPlayerId !== playerId) continue;
    district.ownerPlayerId = null;
    district.status = "neutral";
    district.influence = Math.max(0, district.influence * 0.5);
    district.ownerHistory.push({ tick: state.tick, ownerPlayerId: null });
    count += 1;
  }
  return count;
};

export const setDistrictOwner = (state: FreeBrSimulationState, district: FreeBrDistrict, ownerPlayerId: string | null): void => {
  if (district.ownerPlayerId === ownerPlayerId) return;
  district.ownerPlayerId = ownerPlayerId;
  district.status = ownerPlayerId ? "controlled" : "neutral";
  district.ownerHistory.push({ tick: state.tick, ownerPlayerId });
};

export const createEliminationScore = (state: FreeBrSimulationState, player: FreeBrPlayer): PlayerEliminationScore => {
  const weights = state.config.balance.elimination?.scoreWeights;
  const districts = getOwnedDistricts(state, player.id);
  const activeBuildingCount = districts.length;
  const cleanCash = player.resources.cash ?? 0;
  const dirtyCash = player.resources["dirty-cash"] ?? 0;
  const totalResourceValue = sumNonCashResources(player);
  const influence = sum(districts.map((district) => district.influence));
  const recentActivityBonus = player.lastActionTick !== null ? (weights?.recentActivityBonus ?? 250) : 0;
  const score =
    districts.length * (weights?.controlledDistricts ?? 10000)
    + influence * (weights?.districtInfluence ?? 25)
    + activeBuildingCount * (weights?.activeBuildingCount ?? 500)
    + cleanCash * (weights?.cleanCash ?? 0.1)
    + dirtyCash * (weights?.dirtyCash ?? 0.05)
    + totalResourceValue * (weights?.resources ?? 0.2)
    + player.population * (weights?.population ?? 2)
    + recentActivityBonus;
  return {
    playerId: player.id,
    playerName: player.name,
    score,
    controlledDistricts: districts.length,
    totalOwnedDistrictInfluence: influence,
    activeBuildingCount,
    cleanCash,
    dirtyCash,
    totalResourceValue,
    population: player.population,
    recentActivityBonus,
    lastActionAt: player.lastActionTick === null ? null : new Date(state.startAtMs + player.lastActionTick * state.config.tickRateMs).toISOString()
  };
};

export const describeWeakness = (score: PlayerEliminationScore): string => {
  if (score.controlledDistricts <= 1) return "málo kontrolovaných districtů a slabá expanze";
  if (score.cleanCash + score.dirtyCash < 2000) return "nízká ekonomika a hotovost";
  if (score.activeBuildingCount < 2) return "slabá infrastruktura budov";
  return "nejnižší celkové elimination score po započtení ekonomiky, vlivu a aktivity";
};

export const createEmptyPlayerStats = (): FreeBrMutablePlayerStats => ({
  attacksMade: 0,
  attacksWon: 0,
  attacksLost: 0,
  districtsCaptured: 0,
  districtsLost: 0,
  occupiedNeutralDistricts: 0,
  spyActions: 0,
  buildingActions: 0,
  craftActions: 0,
  policeRaidsReceived: 0,
  heatGenerated: 0,
  cashEarned: 0,
  dirtyCashEarned: 0,
  allianceCount: 0,
  betrayals: 0,
  dangerZoneAppearances: 0,
  comebackCount: 0,
  maxControlledDistricts: 1,
  eliminatedAtTick: null,
  finalPlacement: null,
  controlledDistrictsOverTime: []
});

export const getAdjacentTargets = (state: FreeBrSimulationState, player: FreeBrPlayer): FreeBrDistrict[] => {
  const ownedIds = new Set(getOwnedDistricts(state, player.id).map((district) => district.id));
  const ids = new Set<number>();
  for (const district of state.districts) {
    if (!ownedIds.has(district.id)) continue;
    for (const adjacentId of district.adjacentDistrictIds) ids.add(adjacentId);
  }
  return [...ids].map((id) => state.districts[id - 1]).filter((district): district is FreeBrDistrict => Boolean(district && !ownedIds.has(district.id)));
};

export const pickDistrictByValue = (rng: SeededRng, districts: FreeBrDistrict[], player: FreeBrPlayer): FreeBrDistrict => {
  const weights = Object.fromEntries(districts.map((district) => [
    String(district.id),
    district.value * (district.isDowntown ? 1 + player.downtownPreference * 2 : 1)
  ]));
  const id = Number(rng.weightedPick<string>(weights));
  return districts.find((district) => district.id === id) ?? rng.pick(districts);
};

export const pickDistrictByAttackValue = (
  state: FreeBrSimulationState,
  rng: SeededRng,
  districts: FreeBrDistrict[],
  player: FreeBrPlayer,
  leader: FreeBrPlayer | null
): FreeBrDistrict => {
  const weights = Object.fromEntries(districts.map((district) => {
    const owner = district.ownerPlayerId ? state.players.find((candidate) => candidate.id === district.ownerPlayerId) : null;
    const leaderBonus = owner?.id === leader?.id ? 2.2 : 1;
    const weakBonus = owner && getOwnedDistricts(state, owner.id).length <= 2 ? 1.5 : 1;
    return [String(district.id), district.value * leaderBonus * weakBonus * (district.isDowntown ? 1 + player.downtownPreference * 2.4 : 1)];
  }));
  const id = Number(rng.weightedPick<string>(weights));
  return districts.find((district) => district.id === id) ?? rng.pick(districts);
};

export const computeAttackPower = (state: FreeBrSimulationState, player: FreeBrPlayer, coordinated: boolean): number =>
  18
  + player.aggression * 34
  + Math.sqrt(Math.max(0, player.resources["metal-parts"] ?? 0)) * 2
  + getOwnedDistricts(state, player.id).length * 1.6
  + (coordinated ? 8 : 0);

export const computeDefensePower = (state: FreeBrSimulationState, defender: FreeBrPlayer, district: FreeBrDistrict): number =>
  district.baseDefense
  + defender.defensePreference * 28
  + Math.sqrt(Math.max(0, defender.resources["tech-core"] ?? 0)) * 2
  + getOwnedDistricts(state, defender.id).length * 0.8
  + (district.isDowntown ? 8 : 0);

export const addHeat = (state: FreeBrSimulationState, player: FreeBrPlayer, amount: number, district: FreeBrDistrict | null): void => {
  player.heat += amount;
  if (district) district.heat += amount;
  state.stats[player.id].heatGenerated += amount;
};

export const recordDangerZoneAppearances = (state: FreeBrSimulationState): void => {
  for (const player of getBottomPlayers(state, state.config.balance.elimination?.dangerZoneSize ?? 3)) {
    state.stats[player.id].dangerZoneAppearances += 1;
  }
};

export const getBottomPlayers = (state: FreeBrSimulationState, count: number): FreeBrPlayer[] =>
  state.players
    .filter((player) => player.status === "active")
    .map((player) => ({ player, score: createEliminationScore(state, player) }))
    .sort((left, right) => compareEliminationScores(left.score, right.score))
    .slice(0, count)
    .map((entry) => entry.player);

export const findLeader = (state: FreeBrSimulationState): FreeBrPlayer | null =>
  state.players
    .filter((player) => player.status === "active")
    .sort((left, right) => createEliminationScore(state, right).score - createEliminationScore(state, left).score)[0] ?? null;

export const getOwnedDistricts = (state: FreeBrSimulationState, playerId: string): FreeBrDistrict[] =>
  state.districts.filter((district) => district.ownerPlayerId === playerId && district.status !== "destroyed");

export const countDowntownOwners = (state: FreeBrSimulationState): Record<string, number> => {
  const result: Record<string, number> = {};
  for (const district of state.districts.filter((candidate) => candidate.isDowntown && candidate.ownerPlayerId)) {
    const owner = state.players.find((player) => player.id === district.ownerPlayerId);
    const key = owner?.factionId ?? district.ownerPlayerId ?? "neutral";
    result[key] = (result[key] ?? 0) + 1;
  }
  return result;
};

export const resolveActivePlacement = (state: FreeBrSimulationState, player: FreeBrPlayer): number => {
  const active = state.players
    .filter((candidate) => candidate.status === "active")
    .sort((left, right) => createEliminationScore(state, right).score - createEliminationScore(state, left).score);
  return active.findIndex((candidate) => candidate.id === player.id) + 1;
};

export const isCooldownReady = (state: FreeBrSimulationState, player: FreeBrPlayer, key: string): boolean =>
  (player.cooldowns[key] ?? 0) <= state.tick;

export const isRareBuildingType = (buildingType: string): boolean =>
  ["stock_exchange", "central_bank", "airport", "city_hall", "courthouse", "vip_lounge", "port", "parliament", "lobby_club"].includes(buildingType);

export const isQuietHours = (state: FreeBrSimulationState, tick: number): boolean => {
  const quiet = state.config.balance.elimination?.quietHours;
  if (!quiet?.enabled) return false;
  const hour = getLocalHour(state, tick, quiet.timeZone);
  const start = quiet.startHour;
  const end = quiet.endHour;
  return start < end ? hour >= start && hour < end : hour >= start || hour < end;
};

export const resolveQuietHoursResumeTick = (state: FreeBrSimulationState, tick: number): number => {
  const ticksHour = ticksPerHour(state);
  let candidate = tick + ticksHour;
  while (isQuietHours(state, candidate)) candidate += ticksHour;
  return candidate;
};

export const getLocalHour = (state: FreeBrSimulationState, tick: number, timeZone: string): number => {
  const hour = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "2-digit",
    hourCycle: "h23"
  }).formatToParts(new Date(state.startAtMs + tick * state.config.tickRateMs)).find((part) => part.type === "hour")?.value;
  return Number(hour ?? 0);
};

export const ticksPerHour = (state: FreeBrSimulationState): number =>
  Math.max(1, Math.round((60 * 60 * 1000) / state.config.tickRateMs));

export const tickToHour = (state: FreeBrSimulationState, tick: number): number =>
  Math.round((tick * state.config.tickRateMs / (60 * 60 * 1000)) * 100) / 100;

export const sumNonCashResources = (player: FreeBrPlayer): number =>
  Object.entries(player.resources)
    .filter(([key]) => !["cash", "dirty-cash", "population", "influence"].includes(key))
    .reduce((total, [, value]) => total + Math.max(0, Number(value || 0)), 0);

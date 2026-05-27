import { compareEliminationScores, type PlayerEliminationScore } from "@empire/game-core";
import { sum } from "./math";
import type { SeededRng } from "./seeded-rng";
import type { FreeBrDistrict, FreeBrMutablePlayerStats, FreeBrPlayer, FreeBrSimulationState } from "./types";

export const neutralizePlayerDistricts = (state: FreeBrSimulationState, playerId: string): number => {
  let count = 0;
  const ownedIds = [...(state.ownedDistrictIdsByPlayer[playerId] ?? [])];
  for (const districtId of ownedIds) {
    const district = state.districts[districtId - 1];
    if (!district || district.ownerPlayerId !== playerId) continue;
    district.ownerPlayerId = null;
    district.status = "neutral";
    district.influence = Math.max(0, district.influence * 0.5);
    district.ownerHistory.push({ tick: state.tick, ownerPlayerId: null });
    state.ownedDistrictIdsByPlayer[playerId]?.delete(district.id);
    adjustOwnedBuildingTypeCount(state, playerId, district.buildingType, -1);
    count += 1;
  }
  return count;
};

export const setDistrictOwner = (state: FreeBrSimulationState, district: FreeBrDistrict, ownerPlayerId: string | null): void => {
  if (district.ownerPlayerId === ownerPlayerId) return;
  if (district.ownerPlayerId) {
    state.ownedDistrictIdsByPlayer[district.ownerPlayerId]?.delete(district.id);
    adjustOwnedBuildingTypeCount(state, district.ownerPlayerId, district.buildingType, -1);
  }
  if (ownerPlayerId) {
    state.ownedDistrictIdsByPlayer[ownerPlayerId] ??= new Set<number>();
    state.ownedDistrictIdsByPlayer[ownerPlayerId].add(district.id);
    adjustOwnedBuildingTypeCount(state, ownerPlayerId, district.buildingType, 1);
  }
  district.ownerPlayerId = ownerPlayerId;
  district.status = ownerPlayerId ? "controlled" : "neutral";
  district.ownerHistory.push({ tick: state.tick, ownerPlayerId });
};

const adjustOwnedBuildingTypeCount = (
  state: FreeBrSimulationState,
  playerId: string,
  buildingType: string,
  delta: number
): void => {
  state.ownedBuildingTypeCountsByPlayer[playerId] ??= {};
  const next = (state.ownedBuildingTypeCountsByPlayer[playerId][buildingType] ?? 0) + delta;
  if (next <= 0) {
    delete state.ownedBuildingTypeCountsByPlayer[playerId][buildingType];
    return;
  }
  state.ownedBuildingTypeCountsByPlayer[playerId][buildingType] = next;
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
  const ownedIds = state.ownedDistrictIdsByPlayer[player.id] ?? new Set<number>();
  const ids = new Set<number>();
  for (const districtId of ownedIds) {
    const district = state.districts[districtId - 1];
    if (!district) continue;
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

export const getOwnedDistricts = (state: FreeBrSimulationState, playerId: string): FreeBrDistrict[] =>
  [...(state.ownedDistrictIdsByPlayer[playerId] ?? [])]
    .map((districtId) => state.districts[districtId - 1])
    .filter((district): district is FreeBrDistrict => Boolean(district && district.ownerPlayerId === playerId && district.status !== "destroyed"));

export const getOwnedBuildingTypes = (state: FreeBrSimulationState, playerId: string): string[] =>
  Object.keys(state.ownedBuildingTypeCountsByPlayer[playerId] ?? {});

export const countDowntownOwners = (state: FreeBrSimulationState): Record<string, number> => {
  const result: Record<string, number> = {};
  for (const district of state.districts.filter((candidate) => candidate.isDowntown && candidate.ownerPlayerId)) {
    const owner = state.players.find((player) => player.id === district.ownerPlayerId);
    const key = owner?.factionId ?? district.ownerPlayerId ?? "neutral";
    result[key] = (result[key] ?? 0) + 1;
  }
  return result;
};

export const isCooldownReady = (state: FreeBrSimulationState, player: FreeBrPlayer, key: string): boolean =>
  (player.cooldowns[key] ?? 0) <= state.tick;

export const isRareBuildingType = (buildingType: string): boolean =>
  ["stock_exchange", "central_bank", "airport", "city_hall", "courthouse", "vip_lounge", "port", "parliament", "lobby_club"].includes(buildingType);

export const sumNonCashResources = (player: FreeBrPlayer): number =>
  Object.entries(player.resources)
    .filter(([key]) => !["cash", "dirty-cash", "population", "influence"].includes(key))
    .reduce((total, [, value]) => total + Math.max(0, Number(value || 0)), 0);

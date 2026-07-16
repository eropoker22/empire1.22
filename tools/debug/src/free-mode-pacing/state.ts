import {
  applyFactionStartingPackage,
  createInitialState,
  type CoreGameState,
  type ResolvedGameModeConfig
} from "@empire/game-core";
import {
  DEFAULT_PLAYER_COLOR,
  PRODUCTION_GAME_LIFECYCLE_PHASES,
  type Alliance,
  type Building,
  type District,
  PLAYER_FACTION_IDS,
  type Player
} from "@empire/shared-types";
import { resolveFactionBotBehavior } from "./factionBotBehavior";

const STARTING_LOADOUT = { "baseball-bat": 10, pistol: 5, grenade: 1 };

export const createFreeModePacingState = (input: {
  config: ResolvedGameModeConfig;
  seed: string;
  botCount: number;
  districtCount: number;
}): CoreGameState => {
  let state = createInitialState("pacing:free:1", "free");
  state.serverInstance.status = "running";
  state.serverInstance.worldSeed = input.seed;
  state.root.phase = PRODUCTION_GAME_LIFECYCLE_PHASES.live;

  for (const allianceIndex of [1, 2, 3, 4]) {
    const memberIds = Array.from({ length: 4 }, (_, index) => `player:${(allianceIndex - 1) * 4 + index + 1}`);
    state.alliancesById[`alliance:${allianceIndex}`] = {
      id: `alliance:${allianceIndex}`,
      serverInstanceId: state.serverInstance.id,
      name: `Pacing Alliance ${allianceIndex}`,
      tag: `A${allianceIndex}`,
      ownerPlayerId: memberIds[0],
      memberIds,
      status: "active",
      createdAt: new Date(0).toISOString(),
      version: 1
    } satisfies Alliance;
    state.root.allianceIds.push(`alliance:${allianceIndex}`);
  }

  const homeDistrictIds = selectHomeDistrictIds(input.districtCount, input.botCount);
  for (let playerIndex = 1; playerIndex <= input.botCount; playerIndex += 1) {
    addPlayer(state, playerIndex, homeDistrictIds[playerIndex - 1], input.config);
  }

  const width = Math.ceil(Math.sqrt(input.districtCount));
  for (let index = 1; index <= input.districtCount; index += 1) {
    const districtId = `district:${index}`;
    const ownerPlayerId = homeDistrictIds.indexOf(districtId) >= 0
      ? `player:${homeDistrictIds.indexOf(districtId) + 1}`
      : null;
    const district = createDistrict(index, input.districtCount, width, ownerPlayerId, state);
    state.districtsById[districtId] = district;
    state.root.districtIds.push(districtId);
    if (ownerPlayerId) attachStarterBuildings(state, districtId, ownerPlayerId);
  }

  for (const playerId of state.root.playerIds) {
    state = applyFactionStartingPackage(state, playerId, { config: input.config });
  }

  return state;
};

export const attachStarterBuildings = (
  state: CoreGameState,
  districtId: string,
  playerId: string
): void => {
  for (const buildingTypeId of resolveStarterBuildingTypes(state, playerId)) {
    if (state.districtsById[districtId]?.buildingIds.some((id) => state.buildingsById[id]?.buildingTypeId === buildingTypeId)) {
      continue;
    }
    const building: Building = {
      id: `building:${districtId}:${buildingTypeId}:${state.districtsById[districtId].buildingIds.length + 1}`,
      serverInstanceId: state.serverInstance.id,
      districtId,
      ownerPlayerId: playerId,
      buildingTypeId,
      level: 1,
      status: "active",
      processing: null,
      actionCooldowns: {},
      startedAt: new Date(0).toISOString(),
      completedAt: new Date(0).toISOString(),
      version: 1
    };
    state.buildingsById[building.id] = building;
    state.districtsById[districtId].buildingIds.push(building.id);
  }
};

const resolveStarterBuildingTypes = (state: CoreGameState, playerId: string): string[] => {
  const profile = resolveFactionBotBehavior(state.playersById[playerId]?.factionId);
  const fallback = ["restaurant", "factory", "armory", "warehouse"];
  return [...new Set([...profile.preferredBuildingTypes, ...fallback])].slice(0, 4);
};

const addPlayer = (
  state: CoreGameState,
  index: number,
  homeDistrictId: string,
  config: ResolvedGameModeConfig
): void => {
  const playerId = `player:${index}`;
  const allianceId = index <= 16 ? `alliance:${Math.ceil(index / 4)}` : null;
  const player: Player = {
    id: playerId,
    accountId: `account:${index}`,
    serverInstanceId: state.serverInstance.id,
    name: `Bot ${index}`,
    factionId: PLAYER_FACTION_IDS[(index - 1) % PLAYER_FACTION_IDS.length],
    color: DEFAULT_PLAYER_COLOR,
    status: "active",
    allianceId,
    homeDistrictId,
    attackLoadout: { ...STARTING_LOADOUT },
    resourceStateId: `resource:${playerId}`,
    cooldownStateId: `cooldown:${playerId}`,
    effectStateId: `effect:${playerId}`,
    policeStateId: `police:${playerId}`,
    createdAt: new Date(0).toISOString(),
    lastActionAt: null,
    version: 1
  };
  state.playersById[player.id] = player;
  state.root.playerIds.push(player.id);
  state.resourceStatesById[player.resourceStateId] = {
    id: player.resourceStateId,
    ownerType: "player",
    ownerId: player.id,
    balances: { ...config.balance.startingResources },
    incomeModifiers: {},
    lastUpdatedTick: 0,
    version: 1
  };
  state.cooldownStatesById[player.cooldownStateId] = {
    id: player.cooldownStateId,
    ownerType: "player",
    ownerId: player.id,
    cooldowns: {},
    version: 1
  };
  state.policeStatesById[player.policeStateId] = {
    id: player.policeStateId,
    ownerPlayerId: player.id,
    heat: 0,
    wantedLevel: 0,
    lastDecayTick: 0,
    activeFlags: [],
    version: 1
  };
};

const createDistrict = (
  index: number,
  districtCount: number,
  width: number,
  ownerPlayerId: string | null,
  state: CoreGameState
): District => ({
  id: `district:${index}`,
  serverInstanceId: state.serverInstance.id,
  templateId: `template:${index}`,
  name: `District ${index}`,
  zone: resolveZone(index),
  adjacentDistrictIds: resolveAdjacentDistrictIds(index, districtCount, width),
  ownerPlayerId,
  controllerAllianceId: ownerPlayerId ? state.playersById[ownerPlayerId]?.allianceId ?? null : null,
  heat: 0,
  lastHeatDecayTick: 0,
  influence: 1,
  buildingIds: [],
  defenseLoadout: ownerPlayerId ? { barricades: 3, cameras: 1 } : resolveNeutralDefense(index),
  slotCount: 8,
  status: ownerPlayerId ? "claimed" : "neutral",
    resourceModifiers: {},
    securityRevision: 1,
    conflictRevision: 1,
    version: 1
});

const selectHomeDistrictIds = (districtCount: number, botCount: number): string[] => {
  const width = Math.ceil(Math.sqrt(districtCount));
  const candidates = Array.from({ length: botCount }, (_, index) => {
    const row = Math.floor((index * 7) % width);
    const col = Math.floor((index * 11 + Math.floor(index / 2) * 3) % width);
    return Math.min(districtCount, row * width + col + 1);
  });
  const used = new Set<number>();
  return candidates.map((candidate) => {
    let next = candidate;
    while (used.has(next)) next = (next % districtCount) + 1;
    used.add(next);
    return `district:${next}`;
  });
};

const resolveAdjacentDistrictIds = (index: number, districtCount: number, width: number): string[] => {
  const row = Math.floor((index - 1) / width);
  const col = (index - 1) % width;
  return [[row - 1, col], [row + 1, col], [row, col - 1], [row, col + 1]]
    .map(([r, c]) => r * width + c + 1)
    .filter((id) => id >= 1 && id <= districtCount)
    .map((id) => `district:${id}`);
};

const resolveNeutralDefense = (index: number): District["defenseLoadout"] =>
  index % 5 === 0 ? { barricades: 4, cameras: 2, alarm: 1 } : index % 3 === 0 ? { barricades: 3, cameras: 1 } : { barricades: 2 };

const resolveZone = (index: number): string =>
  index % 5 === 0 ? "industrial" : index % 4 === 0 ? "commercial" : index % 3 === 0 ? "downtown" : "residential";

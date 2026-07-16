import { createInitialState } from "@empire/game-core";
import { resolveDistrictBuildingTypes, resolveModeConfig } from "@empire/game-config";
import { DEV_SETUP_GAME_LIFECYCLE_PHASES, type Building, type District, type GameModeId, type Player, type PlayerColorHex, type ResourceState } from "@empire/shared-types";
import { allocateServerPlayerColor } from "./player-color-allocation";

export interface DistrictBuildingSliceSeedDistrict {
  id: string;
  name: string;
  ownerPlayerId: string | null;
  zone?: string;
  heat?: number;
  influence?: number;
  buildingTypes?: string[];
  legacyBuildingNames?: string[];
  legacyBuildingDisplayNames?: string[];
  buildingSetKey?: string | null;
  buildingTier?: string | null;
  buildingSetTitle?: string | null;
  status?: District["status"];
  adjacentDistrictIds?: string[];
  defenseLoadout?: District["defenseLoadout"];
}

export interface DistrictBuildingSliceSeedOptions {
  instanceId: string;
  playerId: string;
  districtId: string;
  mode: GameModeId;
  playerFactionId?: Player["factionId"];
  playerColor?: PlayerColorHex | string | null;
  playerName?: string;
  homeDistrict?: Partial<DistrictBuildingSliceSeedDistrict>;
  extraDistricts?: DistrictBuildingSliceSeedDistrict[];
  playerAttackLoadout?: Player["attackLoadout"];
}

export const createDistrictBuildingSliceSeed = (options: DistrictBuildingSliceSeedOptions) => {
  const config = resolveModeConfig(options.mode);
  const state = createInitialState(options.instanceId, options.mode);
  state.root.phase = DEV_SETUP_GAME_LIFECYCLE_PHASES.devSetup;
  const districts: DistrictBuildingSliceSeedDistrict[] = [
    {
      ...options.homeDistrict,
      id: options.districtId,
      name: options.homeDistrict?.name ?? "Starter District",
      ownerPlayerId: options.playerId,
      zone: options.homeDistrict?.zone ?? "commercial",
      status: "claimed",
      adjacentDistrictIds: options.homeDistrict?.adjacentDistrictIds ?? options.extraDistricts?.map((district) => district.id) ?? [],
      buildingSetKey: options.homeDistrict?.buildingSetKey ?? "early-stable-2"
    },
    ...(options.extraDistricts ?? [])
  ];
  const playerIds = Array.from(
    new Set(
      districts
        .map((district) => district.ownerPlayerId)
        .filter((ownerPlayerId): ownerPlayerId is string => ownerPlayerId !== null)
    )
  );

  const assignedPlayerColors = new Set<string>();

  playerIds.forEach((playerId) => {
    const playerColor = allocateServerPlayerColor(
      assignedPlayerColors,
      playerId === options.playerId ? options.playerColor : null
    );
    const player = createSeedPlayer(
      options.instanceId,
      playerId,
      options.districtId,
      playerId === options.playerId ? options.playerAttackLoadout ?? {} : {},
      playerColor,
      playerId === options.playerId ? options.playerFactionId : undefined,
      playerId === options.playerId ? options.playerName : undefined
    );
    state.playersById[player.id] = player;
    state.resourceStatesById[player.resourceStateId] = createSeedPlayerResourceState(
      player,
      config.balance.startingResources
    );
    state.root.playerIds.push(player.id);
  });

  districts.forEach((districtSeed) => {
    const district = createSeedDistrict(options.instanceId, config.balance.buildSlotLimit, districtSeed);
    state.districtsById[district.id] = district;
    state.root.districtIds.push(district.id);

    getSeedBuildingTypes(districtSeed, district.zone).forEach((buildingTypeId, index) => {
      const building = createSeedBuilding(
        options.instanceId,
        district,
        buildingTypeId,
        index,
        resolveSeedBuildingDisplayName(districtSeed, index)
      );
      const productionProfile = config.balance.productionBuildings?.[building.buildingTypeId];

      state.buildingsById[building.id] = building;

      if (building && productionProfile) {
        state.resourceStatesById[`resource:${building.id}`] = createSeedBuildingResourceState(
          building,
          productionProfile.resourceKey
        );
      }
    });
  });

  return state;
};

const getSeedBuildingTypes = (
  districtSeed: DistrictBuildingSliceSeedDistrict,
  zone: string
): string[] => {
  if (districtSeed.buildingTypes) {
    return districtSeed.buildingTypes;
  }
  const configured = resolveDistrictBuildingTypes({
    districtId: districtSeed.id,
    zone,
    buildingSetKey: districtSeed.buildingSetKey,
    buildingTier: districtSeed.buildingTier,
    legacyBuildingNames: districtSeed.legacyBuildingNames
  });
  return configured.length > 0
    ? configured
    : resolveDistrictBuildingTypes({ districtId: districtSeed.id, zone: "residential", buildingSetKey: "res-early-1" });
};

const createSeedPlayer = (
  instanceId: string,
  playerId: string,
  homeDistrictId: string,
  attackLoadout: Player["attackLoadout"],
  color: PlayerColorHex,
  factionId?: Player["factionId"],
  playerName?: string
): Player => ({
  id: playerId,
  accountId: `account:${playerId}`,
  serverInstanceId: instanceId,
  name: playerName || (playerId.startsWith("player:") ? playerId.replace(/^player:/, "").replace(/:/g, " ") : "Seed Player"),
  factionId: factionId ?? "mafian",
  color,
  status: "active",
  allianceId: null,
  homeDistrictId,
  attackLoadout,
  resourceStateId: `resource:${playerId}`,
  cooldownStateId: `cooldown:${playerId}`,
  effectStateId: `effect:${playerId}`,
  policeStateId: `police:${playerId}`,
  createdAt: new Date(0).toISOString(),
  lastActionAt: null,
  version: 1
});

const createSeedDistrict = (
  instanceId: string,
  slotCount: number,
  districtSeed: DistrictBuildingSliceSeedDistrict
): District => ({
  ...(() => {
    const zone = districtSeed.zone ?? "residential";
    const buildingTypes = getSeedBuildingTypes(districtSeed, zone);

    return {
      id: districtSeed.id,
      serverInstanceId: instanceId,
      templateId: `district-template:${zone}`,
      name: districtSeed.name,
      zone,
      adjacentDistrictIds: districtSeed.adjacentDistrictIds ?? [],
      ownerPlayerId: districtSeed.ownerPlayerId,
      controllerAllianceId: null,
      heat: districtSeed.heat ?? 0,
      influence: districtSeed.influence ?? 0,
      buildingIds: buildingTypes.map((buildingType, index) => createSeedBuildingId(districtSeed.id, buildingType, index)),
      defenseLoadout: districtSeed.defenseLoadout ?? {},
      slotCount: Math.max(slotCount, buildingTypes.length),
      status: districtSeed.status ?? (districtSeed.ownerPlayerId ? "claimed" : "neutral"),
    resourceModifiers: {},
    securityRevision: 1,
    conflictRevision: 1,
    version: 1
    };
  })()
});

const createSeedBuildingId = (districtId: string, buildingType: string, index: number): string =>
  `building:${districtId.replace(/[^a-zA-Z0-9-]/g, "-")}:${buildingType}:${index + 1}`;

const resolveSeedBuildingDisplayName = (districtSeed: DistrictBuildingSliceSeedDistrict, index: number): string | null =>
  String(districtSeed.legacyBuildingDisplayNames?.[index] || "").trim() || null;

const createSeedBuilding = (
  instanceId: string,
  district: District,
  buildingTypeId: string,
  index: number,
  displayName: string | null
): Building => ({
  id: createSeedBuildingId(district.id, buildingTypeId, index),
  serverInstanceId: instanceId,
  districtId: district.id,
  ownerPlayerId: district.ownerPlayerId ?? "player:neutral",
  buildingTypeId,
  displayName,
  level: 1,
  status: "active",
  processing: null,
  actionCooldowns: {},
  startedAt: new Date(0).toISOString(),
  completedAt: new Date(0).toISOString(),
  version: 1
});

const createSeedPlayerResourceState = (
  player: Player,
  startingResources: Record<string, number>
): ResourceState => ({
  id: player.resourceStateId,
  ownerType: "player",
  ownerId: player.id,
  balances: {
    ...startingResources
  },
  incomeModifiers: {},
  lastUpdatedTick: 0,
  version: 1
});

const createSeedBuildingResourceState = (
  building: Building,
  resourceKey: string
): ResourceState => ({
  id: `resource:${building.id}`,
  ownerType: "building",
  ownerId: building.id,
  balances: {
    [resourceKey]: 0
  },
  incomeModifiers: {},
  lastUpdatedTick: 0,
  version: 1
});

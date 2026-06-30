import {
  type CoreGameState,
  createPlayerPoliceState,
  normalizeFactionId
} from "@empire/game-core";
import { resolveModeConfig } from "@empire/game-config";
import {
  PRODUCTION_GAME_LIFECYCLE_PHASES,
  type GameModeId,
  type Player,
  type PlayerFactionId,
  type ResourceState,
  type ServerInstanceId
} from "@empire/shared-types";
import {
  ensureSharedCityMap,
  sharedCitySpawnDistrictIds
} from "./gameplay-slice-shared-city-seed";

export interface GameplaySliceMembershipRequest {
  serverInstanceId: ServerInstanceId;
  playerId: string;
  districtId?: string | null;
  factionId?: PlayerFactionId | string | null;
  mode: GameModeId;
}

/**
 * Responsibility: deterministic bootstrap seed for one joined gameplay slice player.
 * Belongs here: starter player, starter districts, and starter building records.
 * Does not belong here: gameplay command effects or client-side rules.
 */
export const addPlayerToGameplaySliceState = (
  state: CoreGameState,
  request: GameplaySliceMembershipRequest
): CoreGameState => {
  const config = resolveModeConfig(request.mode);
  const factionId = normalizeFactionId(request.factionId, config);
  ensureSharedCityMap(state, request.serverInstanceId, {
    buildSlotLimit: config.balance.buildSlotLimit,
    productionBuildings: config.balance.productionBuildings ?? {}
  });

  const player = createPlayer(request, factionId);

  state.playersById[player.id] = player;
  state.resourceStatesById[player.resourceStateId] = createResourceState(
    player.resourceStateId,
    "player",
    player.id,
    config.balance.startingResources
  );
  state.policeStatesById[player.policeStateId] = createPlayerPoliceState(player, state.root.tick);
  appendUnique(state.root.playerIds, player.id);

  ensureLiveBountyTarget(state, request);

  return state;
};

const createPlayer = (
  request: GameplaySliceMembershipRequest,
  factionId: PlayerFactionId
): Player => ({
  id: request.playerId,
  accountId: `account:${request.playerId}`,
  serverInstanceId: request.serverInstanceId,
  name: request.playerId.replace(/^player:/u, "").replace(/[-:]+/gu, " ") || "Street Player",
  factionId,
  color: "#3b82f6",
  status: "active",
  allianceId: null,
  homeDistrictId: null,
  attackLoadout: { pistol: 2, smg: 1 },
  metadata: {
    spawnSelectionStatus: "awaiting_spawn_selection"
  },
  resourceStateId: `resource:${request.playerId}`,
  cooldownStateId: `cooldown:${request.playerId}`,
  effectStateId: `effect:${request.playerId}`,
  policeStateId: `police:${request.playerId}`,
  createdAt: new Date(0).toISOString(),
  lastActionAt: null,
  version: 1
});

const createResourceState = (
  id: string,
  ownerType: ResourceState["ownerType"],
  ownerId: string,
  balances: Record<string, number>
): ResourceState => ({ id, ownerType, ownerId, balances: { ...balances }, incomeModifiers: {}, lastUpdatedTick: 0, version: 1 });

const appendUnique = <TValue>(target: TValue[], value: TValue): void => {
  if (!target.includes(value)) target.push(value);
};

const DEV_BOUNTY_DEMO_TARGETS = [
  {
    playerId: "player:live-bounty-target",
    name: "LowKeyLad",
    color: "#ec4899",
    factionId: "kartel" as const
  },
  {
    playerId: "player:demo-bounty-neon-viktor",
    name: "NeonViktor",
    color: "#06b6d4",
    factionId: "mafian" as const
  },
  {
    playerId: "player:demo-bounty-sable-queen",
    name: "SableQueen",
    color: "#8b5cf6",
    factionId: "hackeri" as const
  }
] satisfies Array<{
  playerId: string;
  name: string;
  color: Player["color"];
  factionId: PlayerFactionId;
}>;

export const ensureLiveBountyTarget = (
  state: CoreGameState,
  request: GameplaySliceMembershipRequest
): void => {
  if (state.root.phase !== PRODUCTION_GAME_LIFECYCLE_PHASES.live) {
    return;
  }
  if (!isDevBountyDemoSeedEnabled()) {
    return;
  }

  for (const target of DEV_BOUNTY_DEMO_TARGETS) {
    ensureDevBountyDemoTarget(state, request, target);
  }
};

const ensureDevBountyDemoTarget = (
  state: CoreGameState,
  request: GameplaySliceMembershipRequest,
  target: (typeof DEV_BOUNTY_DEMO_TARGETS)[number]
): void => {
  if (state.playersById[target.playerId]) {
    return;
  }

  const targetDistrict = findAvailableDemoTargetDistrict(state);
  if (!targetDistrict) {
    return;
  }
  const config = resolveModeConfig(request.mode);
  const targetPlayer: Player = {
    ...createPlayer({
      ...request,
      playerId: target.playerId,
      districtId: targetDistrict.id,
      factionId: target.factionId
    }, target.factionId),
    name: target.name,
    color: target.color,
    homeDistrictId: targetDistrict.id,
    metadata: {
      spawnSelectionStatus: "ready_to_play",
      systemBountyTarget: true
    }
  };

  state.playersById[targetPlayer.id] = targetPlayer;
  state.resourceStatesById[targetPlayer.resourceStateId] = createResourceState(
    targetPlayer.resourceStateId,
    "player",
    targetPlayer.id,
    config.balance.startingResources
  );
  state.policeStatesById[targetPlayer.policeStateId] = createPlayerPoliceState(targetPlayer, state.root.tick);
  state.districtsById[targetDistrict.id] = {
    ...targetDistrict,
    ownerPlayerId: targetPlayer.id,
    status: "claimed",
    version: targetDistrict.version + 1
  };
  for (const buildingId of targetDistrict.buildingIds) {
    const building = state.buildingsById[buildingId];
    if (!building) continue;
    state.buildingsById[buildingId] = {
      ...building,
      ownerPlayerId: targetPlayer.id,
      version: building.version + 1
    };
  }
};

const findAvailableDemoTargetDistrict = (state: CoreGameState) =>
  state.root.districtIds
    .map((districtId) => state.districtsById[districtId])
    .find((district) =>
      district
      && !district.ownerPlayerId
      && district.status !== "destroyed"
      && district.status !== "locked"
      && !sharedCitySpawnDistrictIds.includes(district.id)
    )
  || state.root.districtIds
    .map((districtId) => state.districtsById[districtId])
    .find((district) =>
      district
      && !district.ownerPlayerId
      && district.status !== "destroyed"
      && district.status !== "locked"
    );

const isDevBountyDemoSeedEnabled = (): boolean => {
  const processEnv = typeof process === "undefined" ? undefined : process.env;
  if (processEnv?.NODE_ENV === "production") {
    return processEnv.EMPIRE_ENABLE_BOUNTY_DEMO_TARGETS === "1";
  }
  return processEnv?.EMPIRE_ENABLE_BOUNTY_DEMO_TARGETS !== "0";
};

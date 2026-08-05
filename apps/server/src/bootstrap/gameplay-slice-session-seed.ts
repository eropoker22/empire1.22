import {
  createPlayerSpyOperationState,
  type CoreGameState,
  createPlayerPoliceState,
  normalizeFactionId
} from "@empire/game-core";
import { resolveModeConfig } from "@empire/game-config";
import {
  PRODUCTION_GAME_LIFECYCLE_PHASES,
  ATTACK_WEAPON_IDS,
  type GameModeId,
  type HostedStartingPlayerStateView,
  type Player,
  type PlayerFactionId,
  type ResourceState,
  type ServerInstanceId
} from "@empire/shared-types";
import {
  ensureSharedCityMap,
  sharedCitySpawnDistrictIds
} from "./gameplay-slice-shared-city-seed";
import { removeDisabledDevBountyDemoTargets } from "./gameplay-slice-demo-target-cleanup";
import {
  resolveGameplaySliceStartingBalances,
  resolveGameplaySliceStartingInfluence,
  resolveGameplaySliceStartingPopulation
} from "./gameplay-slice-starting-state";

export interface GameplaySliceMembershipRequest {
  serverInstanceId: ServerInstanceId;
  playerId: string;
  districtId?: string | null;
  factionId?: PlayerFactionId | string | null;
  mode: GameModeId;
  startingPlayerState?: HostedStartingPlayerStateView;
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
  ensureSharedCityMap(state, request.serverInstanceId, { buildSlotLimit: config.balance.buildSlotLimit,
    productionBuildings: config.balance.productionBuildings ?? {}, robbery: config.balance.conflict?.robbery });

  const player = createPlayer(
    request,
    factionId,
    resolveGameplaySliceStartingPopulation(config.balance.startingResources, request.startingPlayerState)
  );

  state.playersById[player.id] = player;
  state.resourceStatesById[player.resourceStateId] = createResourceState(
    player.resourceStateId,
    "player",
    player.id,
    resolveGameplaySliceStartingBalances(config.balance.startingResources, request.startingPlayerState)
  );
  state.playerSpyOperationStatesByPlayerId ??= {};
  state.playerSpyOperationStatesByPlayerId[player.id] = createPlayerSpyOperationState(player.id);
  state.policeStatesById[player.policeStateId] = createPlayerPoliceState(player, state.root.tick);
  appendUnique(state.root.playerIds, player.id);

  ensureLiveBountyTarget(state, request);
  state.root.version += 1;

  return state;
};

const createPlayer = (
  request: GameplaySliceMembershipRequest,
  factionId: PlayerFactionId,
  population: number
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
  population,
  attackLoadout: request.startingPlayerState
    ? Object.fromEntries(ATTACK_WEAPON_IDS.map((weaponId) => [
        weaponId,
        request.startingPlayerState!.materials[weaponId] ?? 0
      ]))
    : { pistol: 2, smg: 1 },
  metadata: {
    spawnSelectionStatus: "awaiting_spawn_selection",
    startingInfluence: resolveGameplaySliceStartingInfluence(request.startingPlayerState)
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
): boolean => {
  if (state.root.phase !== PRODUCTION_GAME_LIFECYCLE_PHASES.live) {
    return false;
  }
  if (!isDevBountyDemoSeedEnabled()) {
    const removed = removeDisabledDevBountyDemoTargets(
      state,
      DEV_BOUNTY_DEMO_TARGETS.map((target) => target.playerId)
    );
    if (removed) state.root.version += 1;
    return removed;
  }

  let changed = false;
  for (const target of DEV_BOUNTY_DEMO_TARGETS) {
    changed = ensureDevBountyDemoTarget(state, request, target) || changed;
  }
  if (changed) state.root.version += 1;
  return changed;
};

const ensureDevBountyDemoTarget = (
  state: CoreGameState,
  request: GameplaySliceMembershipRequest,
  target: (typeof DEV_BOUNTY_DEMO_TARGETS)[number]
): boolean => {
  if (state.playersById[target.playerId]) {
    return false;
  }

  const targetDistrict = findAvailableDemoTargetDistrict(state);
  if (!targetDistrict) {
    return false;
  }
  const config = resolveModeConfig(request.mode);
  const startingPopulation = resolveGameplaySliceStartingPopulation(config.balance.startingResources);
  const targetPlayer: Player = {
    ...createPlayer({
      ...request,
      playerId: target.playerId,
      districtId: targetDistrict.id,
      factionId: target.factionId
    }, target.factionId, startingPopulation),
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
    resolveGameplaySliceStartingBalances(config.balance.startingResources)
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
  return true;
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
  return processEnv?.EMPIRE_ENABLE_BOUNTY_DEMO_TARGETS === "1";
};

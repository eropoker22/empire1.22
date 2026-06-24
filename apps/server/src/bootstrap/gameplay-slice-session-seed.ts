import {
  type CoreGameState,
  createPlayerPoliceState,
  normalizeFactionId
} from "@empire/game-core";
import { resolveModeConfig } from "@empire/game-config";
import type {
  GameModeId,
  Player,
  PlayerFactionId,
  ResourceState,
  ServerInstanceId
} from "@empire/shared-types";
import { ensureSharedCityMap } from "./gameplay-slice-shared-city-seed";

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

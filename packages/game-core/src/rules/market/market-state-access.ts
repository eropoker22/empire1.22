import type {
  MarketPaymentType,
  MarketResourceId
} from "./market-types";
import { cloneEntity } from "./market-state-clone";

type AnyRecord = Record<string, any>;

const CLEAN_CASH_KEYS = ["cleanCash", "cleanMoney", "cash"];
const DIRTY_CASH_KEYS = ["dirtyCash", "dirtyMoney", "dirty-cash"];
const RESOURCE_ALIASES: Record<MarketResourceId, string[]> = {
  metalParts: ["metalParts", "metal-parts", "metal_parts"],
  techCore: ["techCore", "tech-core", "tech_core"],
  chemicals: ["chemicals"],
  biomass: ["biomass"]
};
export const resolvePlayerForMutation = (serverState: AnyRecord, playerState: AnyRecord): AnyRecord => {
  const playerId = getPlayerId(playerState);
  const existing = playerId ? findPlayer(serverState, playerId) : null;
  return existing ?? cloneEntity(playerState);
};

export const resolvePlayerForRead = (serverState: AnyRecord, playerState: AnyRecord): AnyRecord =>
  findPlayer(serverState, getPlayerId(playerState)) ?? playerState ?? {};

export const findPlayer = (serverState: AnyRecord, playerId: string): AnyRecord | null => {
  if (!playerId) {
    return null;
  }
  if (serverState.playersById?.[playerId]) {
    return serverState.playersById[playerId];
  }
  if (Array.isArray(serverState.players)) {
    return serverState.players.find((player: AnyRecord) => player?.id === playerId) ?? null;
  }
  if (serverState.players && typeof serverState.players === "object") {
    return serverState.players[playerId] ?? null;
  }
  return null;
};

export const getAllPlayers = (serverState: AnyRecord): AnyRecord[] => {
  if (serverState.playersById && typeof serverState.playersById === "object") {
    return Object.values(serverState.playersById);
  }
  if (Array.isArray(serverState.players)) {
    return serverState.players;
  }
  if (serverState.players && typeof serverState.players === "object") {
    return Object.values(serverState.players);
  }
  return [];
};

export const getPlayerId = (player: AnyRecord | null | undefined): string =>
  String(player?.id ?? player?.playerId ?? "").trim();

export const getPlayerCash = (
  serverState: AnyRecord,
  player: AnyRecord,
  paymentType: MarketPaymentType,
  seenResourceStates?: Set<string>
): number => {
  const resourceState = getPlayerResourceState(serverState, player);
  if (resourceState?.balances) {
    if (seenResourceStates && resourceState.id) {
      if (seenResourceStates.has(resourceState.id)) {
        return 0;
      }
      seenResourceStates.add(resourceState.id);
    }
    return getBalanceFromContainer(resourceState.balances, paymentType === "cleanCash" ? CLEAN_CASH_KEYS : DIRTY_CASH_KEYS);
  }
  if (player?.economy && typeof player.economy === "object") {
    return getBalanceFromContainer(player.economy, paymentType === "cleanCash" ? CLEAN_CASH_KEYS : DIRTY_CASH_KEYS);
  }
  return getBalanceFromContainer(player, paymentType === "cleanCash" ? CLEAN_CASH_KEYS : DIRTY_CASH_KEYS);
};

export const hasPlayerCash = (serverState: AnyRecord, player: AnyRecord, paymentType: MarketPaymentType, amount: number): boolean =>
  getPlayerCash(serverState, player, paymentType) >= safeInteger(amount);

export const debitPlayerCash = (serverState: AnyRecord, player: AnyRecord, paymentType: MarketPaymentType, amount: number): void => {
  const container = getPrimaryCashContainer(serverState, player);
  debitBalance(container, paymentType === "cleanCash" ? CLEAN_CASH_KEYS : DIRTY_CASH_KEYS, amount);
};

export const creditPlayerCash = (serverState: AnyRecord, player: AnyRecord, paymentType: MarketPaymentType, amount: number): void => {
  const container = getPrimaryCashContainer(serverState, player);
  creditBalance(container, paymentType === "cleanCash" ? CLEAN_CASH_KEYS : DIRTY_CASH_KEYS, amount);
};

const getPrimaryCashContainer = (serverState: AnyRecord, player: AnyRecord): AnyRecord => {
  const resourceState = getPlayerResourceState(serverState, player);
  if (resourceState?.balances) {
    return resourceState.balances;
  }
  if (player.economy && typeof player.economy === "object") {
    return player.economy;
  }
  return player;
};

const getPlayerResourceState = (serverState: AnyRecord, player: AnyRecord): AnyRecord | null => {
  if (player?.resourceStateId && serverState.resourceStatesById?.[player.resourceStateId]) {
    return serverState.resourceStatesById[player.resourceStateId];
  }
  if (serverState.resourceStatesById && typeof serverState.resourceStatesById === "object") {
    return Object.values(serverState.resourceStatesById).find((resourceState: any) =>
      resourceState?.ownerType === "player" && resourceState?.ownerId === getPlayerId(player)
    ) as AnyRecord | null ?? null;
  }
  return null;
};

const getPrimaryResourceContainer = (serverState: AnyRecord, player: AnyRecord): AnyRecord => {
  const resourceState = getPlayerResourceState(serverState, player);
  if (resourceState?.balances) {
    return resourceState.balances;
  }
  if (player.resources && typeof player.resources === "object") {
    return player.resources;
  }
  if (player.inventory?.materials && typeof player.inventory.materials === "object") {
    return player.inventory.materials;
  }
  player.resources = player.resources && typeof player.resources === "object" ? player.resources : {};
  return player.resources;
};

export const getPlayerResourceAmount = (serverState: AnyRecord, player: AnyRecord, resourceId: MarketResourceId): number =>
  getBalanceFromContainer(getPrimaryResourceContainer(serverState, player), RESOURCE_ALIASES[resourceId]);

export const creditPlayerResource = (serverState: AnyRecord, player: AnyRecord, resourceId: MarketResourceId, amount: number): void =>
  creditBalance(getPrimaryResourceContainer(serverState, player), RESOURCE_ALIASES[resourceId], amount);

export const debitPlayerResource = (serverState: AnyRecord, player: AnyRecord, resourceId: MarketResourceId, amount: number): void => {
  debitBalance(getPrimaryResourceContainer(serverState, player), RESOURCE_ALIASES[resourceId], amount);
};

const getBalanceFromContainer = (container: AnyRecord | null | undefined, keys: string[]): number => {
  if (!container || typeof container !== "object") {
    return 0;
  }
  const key = resolveExistingKey(container, keys);
  return key ? safeInteger(container[key]) : 0;
};

const debitBalance = (container: AnyRecord, keys: string[], amount: number): number => {
  const key = resolveExistingKey(container, keys) ?? keys[0];
  const safeAmount = safeInteger(amount);
  const current = safeInteger(container[key]);
  const debited = Math.min(current, safeAmount);
  container[key] = Math.max(0, current - debited);
  return debited;
};

const creditBalance = (container: AnyRecord, keys: string[], amount: number): void => {
  const key = resolveExistingKey(container, keys) ?? keys[0];
  container[key] = safeInteger(container[key]) + safeInteger(amount);
};

const resolveExistingKey = (container: AnyRecord, keys: string[]): string | null =>
  keys.find((key) => Object.prototype.hasOwnProperty.call(container, key)) ?? null;
const safeInteger = (value: unknown): number => {
  const numeric = Math.floor(Number(value));
  return Number.isFinite(numeric) ? numeric : 0;
};

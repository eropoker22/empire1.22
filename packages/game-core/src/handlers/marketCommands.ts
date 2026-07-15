import type { MarketCommand } from "@empire/shared-types";
import type { CoreGameState } from "../entities";
import type { CoreEvent } from "../events";
import type { CoreError } from "../errors";
import { createEvent, CORE_EVENT_TYPES } from "../events";
import type { GameCoreContext } from "../engine/context";
import {
  buyResource,
  buyPlayerMarketListing,
  cancelPlayerMarketListing,
  createPlayerMarketListing,
  marketResourceIds,
  sellResource,
  tickMarket,
  type MarketActionResult,
  type MarketPaymentType,
  type MarketResourceId,
  type MarketType
} from "../rules/market";
import { canPlayerReceiveResource, normalizeStorageBalances } from "./warehouseBuilding";

export const handleMarketCommand = (
  state: CoreGameState,
  command: MarketCommand,
  context: GameCoreContext
): { nextState: CoreGameState; events: CoreEvent[]; errors: CoreError[] } => {
  const player = state.playersById[command.playerId];
  if (!player) {
    return rejected(state, "market_player_not_found", "Hráč pro market akci nebyl nalezen.");
  }

  if ("resourceId" in command.payload && !isMarketResourceId(command.payload.resourceId)) {
    return rejected(state, "market_unknown_resource", "Tuhle surovinu serverový market nepodporuje.");
  }

  if ("amount" in command.payload && (!Number.isInteger(command.payload.amount) || command.payload.amount <= 0)) {
    return rejected(state, "market_invalid_amount", "Množství v marketu musí být kladné celé číslo.");
  }

  const normalizedState = normalizePlayerStorageAliases(state, player.id);
  const now = context.clock?.now().getTime() ?? normalizedState.root.tick * context.config.tickRateMs;
  const marketState = tickMarket(normalizedState, now).nextState as CoreGameState;
  if (command.type === "buy-market-resource" && context.config.balance.warehouse) {
    const capacityCheck = canPlayerReceiveResource(
      marketState,
      player.id,
      command.payload.resourceId,
      command.payload.amount,
      context.config.balance.warehouse
    );
    if (!capacityCheck.allowed) {
      return rejected(
        state,
        capacityCheck.code ?? "storage_capacity_full",
        capacityCheck.message ?? "Sklad je pro tuto položku plný."
      );
    }
  }

  if (command.type === "buy-player-market-listing" && context.config.balance.warehouse) {
    const listing = (marketState.market as { playerListings?: Array<{ id: string; resourceId: string; amount: number; status: string }> } | undefined)
      ?.playerListings?.find((entry) => entry.id === command.payload.listingId && entry.status === "active");
    if (listing && isMarketResourceId(listing.resourceId)) {
      const capacityCheck = canPlayerReceiveResource(
        marketState,
        player.id,
        listing.resourceId,
        listing.amount,
        context.config.balance.warehouse
      );
      if (!capacityCheck.allowed) {
        return rejected(state, capacityCheck.code ?? "storage_capacity_full", capacityCheck.message ?? "Sklad je pro tuto položku plný.");
      }
    }
  }

  const result = command.type === "buy-market-resource"
    ? buyResource(marketState, player, command.payload.resourceId, command.payload.amount, command.payload.marketType as MarketType, command.payload.paymentType as MarketPaymentType, now)
    : command.type === "sell-market-resource"
      ? sellResource(marketState, player, command.payload.resourceId, command.payload.amount, now)
      : command.type === "create-player-market-listing"
        ? createPlayerMarketListing(marketState, player, command.payload.resourceId, command.payload.amount, command.payload.unitPrice, command.payload.paymentType, now)
        : command.type === "buy-player-market-listing"
          ? buyPlayerMarketListing(marketState, player, command.payload.listingId, now)
          : cancelPlayerMarketListing(marketState, player, command.payload.listingId, now);

  if (!result.success || !result.nextState) {
    return rejected(
      state,
      `market_${String(result.reason || "rejected").toLowerCase()}`,
      result.message || "Market akce byla zamítnuta."
    );
  }

  return {
    nextState: result.nextState as CoreGameState,
    events: [createEvent(CORE_EVENT_TYPES.marketTransactionResolved, createMarketEventPayload(command, result))],
    errors: []
  };
};

const createMarketEventPayload = (
  command: MarketCommand,
  result: MarketActionResult
) => ({
  playerId: command.playerId,
  transactionId: result.transactionId,
  transactionType: command.type,
  resourceId: result.resourceId,
  amount: result.amount,
  marketType: result.marketType,
  paymentType: result.paymentType,
  unitPrice: result.unitPrice,
  totalPrice: result.totalPrice,
  heatAdded: result.heatAdded || 0,
  policeSuspicionAdded: result.policeSuspicionAdded || 0,
  auditTriggered: result.auditTriggered === true
});

const normalizePlayerStorageAliases = (state: CoreGameState, playerId: string): CoreGameState => {
  const player = state.playersById[playerId];
  const resourceState = player ? state.resourceStatesById[player.resourceStateId] : undefined;
  if (!resourceState) return state;
  const balances = normalizeStorageBalances(resourceState.balances);
  return {
    ...state,
    resourceStatesById: {
      ...state.resourceStatesById,
      [resourceState.id]: { ...resourceState, balances }
    }
  };
};

const isMarketResourceId = (value: unknown): value is MarketResourceId =>
  typeof value === "string" && (marketResourceIds as readonly string[]).includes(value);

const rejected = (
  state: CoreGameState,
  code: string,
  message: string
): { nextState: CoreGameState; events: CoreEvent[]; errors: CoreError[] } => ({
  nextState: state,
  events: [],
  errors: [{ code, message }]
});


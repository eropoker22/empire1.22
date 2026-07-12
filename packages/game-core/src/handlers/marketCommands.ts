import type { BuyMarketResourceCommand, SellMarketResourceCommand } from "@empire/shared-types";
import type { CoreGameState } from "../entities";
import type { CoreEvent } from "../events";
import type { CoreError } from "../errors";
import { createEvent, CORE_EVENT_TYPES } from "../events";
import type { GameCoreContext } from "../engine/context";
import {
  buyResource,
  marketResourceIds,
  sellResource,
  type MarketActionResult,
  type MarketPaymentType,
  type MarketResourceId,
  type MarketType
} from "../rules/market";
import { canPlayerReceiveResource, normalizeStorageBalances } from "./warehouseBuilding";

type MarketCommand = BuyMarketResourceCommand | SellMarketResourceCommand;

export const handleMarketCommand = (
  state: CoreGameState,
  command: MarketCommand,
  context: GameCoreContext
): { nextState: CoreGameState; events: CoreEvent[]; errors: CoreError[] } => {
  const player = state.playersById[command.playerId];
  if (!player) {
    return rejected(state, "market_player_not_found", "Hráč pro market akci nebyl nalezen.");
  }

  if (!isMarketResourceId(command.payload.resourceId)) {
    return rejected(state, "market_unknown_resource", "Tuhle surovinu serverový market nepodporuje.");
  }

  if (!Number.isInteger(command.payload.amount) || command.payload.amount <= 0) {
    return rejected(state, "market_invalid_amount", "Množství v marketu musí být kladné celé číslo.");
  }

  const normalizedState = normalizePlayerStorageAliases(state, player.id);
  if (command.type === "buy-market-resource" && context.config.balance.warehouse) {
    const capacityCheck = canPlayerReceiveResource(
      normalizedState,
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

  const result = command.type === "buy-market-resource"
    ? buyResource(
        normalizedState,
        player,
        command.payload.resourceId,
        command.payload.amount,
        command.payload.marketType as MarketType,
        command.payload.paymentType as MarketPaymentType
      )
    : sellResource(normalizedState, player, command.payload.resourceId, command.payload.amount);

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
  transactionType: command.type === "buy-market-resource" ? "buy" : "sell",
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


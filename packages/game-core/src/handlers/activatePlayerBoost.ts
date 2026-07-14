import type { ActivatePlayerBoostCommand } from "@empire/shared-types";
import type { CoreGameState } from "../entities";
import type { GameCoreContext } from "../engine/context";
import type { CoreEvent } from "../events";
import type { CoreError } from "../errors";
import { CORE_EVENT_TYPES, createEvent, createNotification } from "../events";
import { completeDrugLabProduction } from "../rules/production/completeDrugLabProduction";
import { completeFactoryProduction } from "../rules/production/completeFactoryProduction";
import { completePharmacyProduction } from "../rules/production/completePharmacyProduction";
import {
  completeArmoryProduction,
  getActivePlayerBoost,
  getPlayerBoostState,
  rescalePlayerProductionAtBoostBoundary
} from "../rules";
import { composeEntityId } from "../utils";

export const handleActivatePlayerBoost = (
  state: CoreGameState,
  command: ActivatePlayerBoostCommand,
  context: GameCoreContext
): { nextState: CoreGameState; events: CoreEvent[]; errors: CoreError[] } => {
  const player = state.playersById[command.playerId];
  const definition = context.config.balance.playerBoosts?.[command.payload.boostId];
  if (!player || !definition) {
    return rejected(state, "boost_unknown", "Tento boost není dostupný.");
  }
  if (getActivePlayerBoost(state, player.id)) {
    return rejected(state, "boost_already_active", "Jiný boost je právě aktivní.");
  }
  const boostState = getPlayerBoostState(state, player.id);
  if (Number(boostState.cooldownUntilTickByBoostId[definition.boostId] || 0) > state.root.tick) {
    return rejected(state, "boost_on_cooldown", "Tento boost je ještě v cooldownu.");
  }
  const resources = state.resourceStatesById[player.resourceStateId];
  if (!resources) {
    return rejected(state, "boost_unavailable", "Boosty nejsou v tomto režimu dostupné.");
  }
  if (Math.floor(Number(resources.balances.cash || 0)) < definition.cleanCashCost) {
    return rejected(state, "boost_missing_clean_cash", "Nemáš dost čistých peněz.");
  }
  if (Object.entries(definition.inputCosts).some(
    ([resourceKey, amount]) => Math.floor(Number(resources.balances[resourceKey] || 0)) < amount
  )) {
    return rejected(state, "boost_missing_resources", "Ve SKLADU chybí potřebné komponenty.");
  }

  const synchronizedState = synchronizeProductionAtCurrentTick(state, context);
  const productionMultiplier = definition.effect.productionSpeedMultiplier ?? 1;
  const boundaryState = definition.boostId === "industrial-overdrive"
    ? rescalePlayerProductionAtBoostBoundary(
        synchronizedState,
        player.id,
        synchronizedState.root.tick,
        1,
        productionMultiplier
      )
    : synchronizedState;
  const currentResources = boundaryState.resourceStatesById[player.resourceStateId] ?? resources;
  const nextBalances = { ...currentResources.balances };
  nextBalances.cash = Math.max(0, Math.floor(Number(nextBalances.cash || 0)) - definition.cleanCashCost);
  for (const [resourceKey, amount] of Object.entries(definition.inputCosts)) {
    nextBalances[resourceKey] = Math.max(0, Math.floor(Number(nextBalances[resourceKey] || 0)) - amount);
  }
  const activatedAtTick = boundaryState.root.tick;
  const expiresAtTick = activatedAtTick + definition.activeDurationTicks;
  const cooldownUntilTick = activatedAtTick + definition.cooldownTicks;
  const nextBoostState = {
    ...boostState,
    active: {
      boostId: definition.boostId,
      activatedAtTick,
      expiresAtTick,
      status: definition.consumptionMode === "next-valid-pvp-combat" ? "armed" as const : "timed" as const,
      effectSnapshot: { ...definition.effect }
    },
    cooldownUntilTickByBoostId: {
      ...boostState.cooldownUntilTickByBoostId,
      [definition.boostId]: cooldownUntilTick
    },
    version: boostState.version + 1
  };
  const title = definition.boostId === "tactical-grid"
    ? "Tactical Grid byl nabitý."
    : `${definition.label} byl aktivován.`;
  const notificationId = composeEntityId("notification", `boost:${player.id}:${activatedAtTick}:activated`);
  const notification = createNotification({
    id: notificationId,
    recipientType: "player",
    recipientId: player.id,
    category: "player.boost",
    title,
    bodyKey: "player.boost.activated",
    payload: {
      boostId: definition.boostId,
      activatedAtTick,
      expiresAtTick,
      cooldownUntilTick
    },
    createdAt: context.clock?.nowIso?.() ?? new Date(0).toISOString(),
    readAt: null
  });

  return {
    nextState: {
      ...boundaryState,
      playersById: {
        ...boundaryState.playersById,
        [player.id]: { ...player, lastActionAt: command.issuedAt, version: player.version + 1 }
      },
      playerBoostStatesByPlayerId: {
        ...(boundaryState.playerBoostStatesByPlayerId ?? {}),
        [player.id]: nextBoostState
      },
      resourceStatesById: {
        ...boundaryState.resourceStatesById,
        [currentResources.id]: {
          ...currentResources,
          balances: nextBalances,
          lastUpdatedTick: boundaryState.root.tick,
          version: currentResources.version + 1
        }
      },
      notificationsById: { ...boundaryState.notificationsById, [notification.id]: notification },
      root: {
        ...boundaryState.root,
        notificationIds: [...boundaryState.root.notificationIds, notification.id],
        version: boundaryState.root.version + 1
      }
    },
    events: [
      createEvent(CORE_EVENT_TYPES.playerBoostActivated, {
        playerId: player.id,
        boostId: definition.boostId,
        activatedAtTick,
        expiresAtTick,
        cooldownUntilTick
      }),
      createEvent(CORE_EVENT_TYPES.notificationCreated, {
        notificationId: notification.id,
        recipientId: player.id,
        category: notification.category
      })
    ],
    errors: []
  };
};

const synchronizeProductionAtCurrentTick = (
  state: CoreGameState,
  context: GameCoreContext
): CoreGameState => completeArmoryProduction(
  completeFactoryProduction(
    completeDrugLabProduction(
      completePharmacyProduction(state, context),
      context
    ),
    context
  ),
  context
);

const rejected = (
  state: CoreGameState,
  code: string,
  message: string
): { nextState: CoreGameState; events: CoreEvent[]; errors: CoreError[] } => ({
  nextState: state,
  events: [],
  errors: [{ code, message }]
});

import type { CoreGameState } from "../../entities";
import type { GameCoreContext } from "../../engine/context";
import type { CoreEvent } from "../../events";
import { CORE_EVENT_TYPES, createEvent, createNotification } from "../../events";
import { composeEntityId } from "../../utils";
import {
  getActivePlayerBoost,
  getPlayerBoostState,
  rescalePlayerProductionAtBoostBoundary
} from "./playerBoostState";

export const consumeTacticalGrid = (
  state: CoreGameState,
  playerId: string | null | undefined,
  combatId: string,
  role: "attacker" | "defender",
  context: GameCoreContext
): { nextState: CoreGameState; events: CoreEvent[]; multiplier: number; consumed: boolean } => {
  if (!playerId) return { nextState: state, events: [], multiplier: 1, consumed: false };
  const active = getActivePlayerBoost(state, playerId);
  if (active?.boostId !== "tactical-grid" || active.status !== "armed") {
    return { nextState: state, events: [], multiplier: 1, consumed: false };
  }
  const multiplier = positiveMultiplier(active.effectSnapshot.combatPowerMultiplier, 1);
  const bonusPct = Math.round((multiplier - 1) * 100);
  const playerBoostState = getPlayerBoostState(state, playerId);
  const message = role === "attacker"
    ? `Tactical Grid byl spotřebován při útoku: +${bonusPct} % bojové síly.`
    : `Tactical Grid byl spotřebován při obraně: +${bonusPct} % bojové síly.`;
  const notificationId = composeEntityId("notification", `boost:${playerId}:${active.activatedAtTick}:consumed:${combatId}:${role}`);
  const notification = createNotification({
    id: notificationId,
    recipientType: "player",
    recipientId: playerId,
    category: "player.boost",
    title: message,
    bodyKey: "player.boost.consumed",
    payload: { boostId: active.boostId, combatId, role, appliedMultiplier: multiplier },
    createdAt: context.clock?.nowIso?.() ?? new Date().toISOString(),
    readAt: null
  });
  return {
    nextState: {
      ...state,
      playerBoostStatesByPlayerId: {
        ...(state.playerBoostStatesByPlayerId ?? {}),
        [playerId]: { ...playerBoostState, active: null, version: playerBoostState.version + 1 }
      },
      notificationsById: { ...state.notificationsById, [notification.id]: notification },
      root: {
        ...state.root,
        notificationIds: [...state.root.notificationIds, notification.id],
        version: state.root.version + 1
      }
    },
    events: [
      createEvent(CORE_EVENT_TYPES.playerBoostConsumed, {
        playerId,
        boostId: active.boostId,
        combatId,
        role,
        appliedMultiplier: multiplier
      }),
      createEvent(CORE_EVENT_TYPES.notificationCreated, {
        notificationId: notification.id,
        recipientId: playerId,
        category: notification.category
      })
    ],
    multiplier,
    consumed: true
  };
};

export const expirePlayerBoosts = (
  state: CoreGameState,
  context: GameCoreContext
): { nextState: CoreGameState; events: CoreEvent[] } => {
  let nextState = state;
  const events: CoreEvent[] = [];
  for (const playerId of Object.keys(state.playersById)) {
    const playerBoostState = getPlayerBoostState(nextState, playerId);
    const active = playerBoostState.active;
    if (!active || active.expiresAtTick > state.root.tick) continue;
    if (active.boostId === "industrial-overdrive") {
      nextState = rescalePlayerProductionAtBoostBoundary(
        nextState,
        playerId,
        active.expiresAtTick,
        positiveMultiplier(active.effectSnapshot.productionSpeedMultiplier, 1),
        1
      );
    }
    const definition = context.config.balance.playerBoosts?.[active.boostId];
    const title = active.boostId === "tactical-grid"
      ? "Tactical Grid expiroval bez použití."
      : active.boostId === "industrial-overdrive"
        ? "Industrial Overdrive skončil."
        : "Ghost Network vypršel.";
    const notificationId = composeEntityId("notification", `boost:${playerId}:${active.activatedAtTick}:expired`);
    const notification = createNotification({
      id: notificationId,
      recipientType: "player",
      recipientId: playerId,
      category: "player.boost",
      title,
      bodyKey: "player.boost.expired",
      payload: { boostId: active.boostId, expiredAtTick: active.expiresAtTick },
      createdAt: context.clock?.nowIso?.() ?? new Date().toISOString(),
      readAt: null
    });
    nextState = {
      ...nextState,
      playerBoostStatesByPlayerId: {
        ...(nextState.playerBoostStatesByPlayerId ?? {}),
        [playerId]: { ...playerBoostState, active: null, version: playerBoostState.version + 1 }
      },
      notificationsById: { ...nextState.notificationsById, [notification.id]: notification },
      root: {
        ...nextState.root,
        notificationIds: [...nextState.root.notificationIds, notification.id],
        version: nextState.root.version + 1
      }
    };
    events.push(
      createEvent(CORE_EVENT_TYPES.playerBoostExpired, {
        playerId,
        boostId: active.boostId,
        expiredAtTick: active.expiresAtTick,
        label: definition?.label ?? active.boostId
      }),
      createEvent(CORE_EVENT_TYPES.notificationCreated, {
        notificationId: notification.id,
        recipientId: playerId,
        category: notification.category
      })
    );
  }
  return { nextState, events };
};

const positiveMultiplier = (value: unknown, fallback: number): number => {
  const normalized = Number(value);
  return Number.isFinite(normalized) && normalized > 0 ? normalized : fallback;
};

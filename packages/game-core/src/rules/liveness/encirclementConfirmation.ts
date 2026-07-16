import type { EncirclementConfirmationToken, Notification } from "@empire/shared-types";
import type { CoreGameState } from "../../entities";
import type { GameCoreContext } from "../../engine/context";
import type { CoreEvent } from "../../events";
import { CORE_EVENT_TYPES, createEvent, createNotification } from "../../events";
import { composeEntityId } from "../../utils";
import { detectAlliedEncirclementAfterOccupy } from "../map/frontier";

export const isEncirclementConfirmationValid = (
  state: CoreGameState,
  playerId: string,
  targetDistrictId: string,
  tokenId: string | undefined
): boolean => {
  if (!tokenId) return false;
  const token = state.encirclementConfirmationTokensById?.[tokenId];
  const player = state.playersById[playerId];
  const target = state.districtsById[targetDistrictId];
  const alliance = player?.allianceId ? state.alliancesById[player.allianceId] : null;
  if (!token || !player || !target || !alliance) return false;
  if (token.consumedAtTick !== null || token.expiresAtTick <= state.root.tick) return false;
  if (token.actorPlayerId !== playerId || token.targetDistrictId !== targetDistrictId) return false;
  if (
    token.targetVersion !== target.version
    || token.targetConflictRevision !== target.conflictRevision
    || token.allianceId !== alliance.id
    || token.allianceVersion !== alliance.version
  ) return false;
  const current = detectAlliedEncirclementAfterOccupy(state, playerId, targetDistrictId);
  return current.requiresConsent
    && sameIds(token.affectedPlayerIds, current.affectedPlayerIds);
};

export const prepareEncirclementConfirmation = (
  state: CoreGameState,
  input: { commandId: string; playerId: string; targetDistrictId: string; sourceDistrictId: string; issuedAt: string },
  context: GameCoreContext
): { nextState: CoreGameState; events: CoreEvent[]; errors: [] } => {
  const player = state.playersById[input.playerId];
  const target = state.districtsById[input.targetDistrictId];
  const alliance = player?.allianceId ? state.alliancesById[player.allianceId] : null;
  const consent = detectAlliedEncirclementAfterOccupy(state, input.playerId, input.targetDistrictId);
  if (!player || !target || !alliance || !consent.requiresConsent) {
    return { nextState: state, events: [], errors: [] };
  }
  const tokenId = composeEntityId("encirclement-confirmation", input.commandId);
  const token: EncirclementConfirmationToken = {
    id: tokenId,
    actorPlayerId: player.id,
    targetDistrictId: target.id,
    sourceDistrictId: input.sourceDistrictId,
    affectedPlayerIds: [...consent.affectedPlayerIds].sort(),
    targetVersion: target.version,
    targetConflictRevision: target.conflictRevision,
    allianceId: alliance.id,
    allianceVersion: alliance.version,
    issuedAtTick: state.root.tick,
    expiresAtTick: state.root.tick + Math.max(1, context.config.balance.playerLiveness?.encirclementConfirmationTicks ?? 1),
    consumedAtTick: null,
    version: 1
  };
  const notification: Notification = createNotification({
    id: composeEntityId("notification", `${input.commandId}:encirclement-warning`),
    recipientType: "player",
    recipientId: player.id,
    category: "warning.encirclement",
    title: "Alianční koridor",
    bodyKey: "warning.encirclement",
    payload: {
      token: token.id,
      targetDistrictId: target.id,
      sourceDistrictId: token.sourceDistrictId,
      affectedPlayerIds: token.affectedPlayerIds,
      expiresAtTick: token.expiresAtTick
    },
    createdAt: input.issuedAt,
    readAt: null
  });
  return {
    nextState: {
      ...state,
      encirclementConfirmationTokensById: {
        ...(state.encirclementConfirmationTokensById ?? {}),
        [token.id]: token
      },
      notificationsById: { ...state.notificationsById, [notification.id]: notification },
      root: {
        ...state.root,
        notificationIds: [...state.root.notificationIds, notification.id],
        version: state.root.version + 1
      }
    },
    events: [createEvent(CORE_EVENT_TYPES.notificationCreated, {
      notificationId: notification.id,
      recipientId: player.id,
      category: notification.category
    })],
    errors: []
  };
};

export const consumeEncirclementConfirmation = (
  state: CoreGameState,
  tokenId: string | undefined
): CoreGameState => {
  if (!tokenId) return state;
  const token = state.encirclementConfirmationTokensById?.[tokenId];
  if (!token || token.consumedAtTick !== null) return state;
  return {
    ...state,
    encirclementConfirmationTokensById: {
      ...(state.encirclementConfirmationTokensById ?? {}),
      [token.id]: { ...token, consumedAtTick: state.root.tick, version: token.version + 1 }
    }
  };
};

const sameIds = (left: string[], right: string[]): boolean => {
  const a = [...left].sort();
  const b = [...right].sort();
  return a.length === b.length && a.every((value, index) => value === b[index]);
};

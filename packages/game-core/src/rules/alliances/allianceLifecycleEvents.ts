import type { AllianceAuditEvent, Notification } from "@empire/shared-types";
import type { CoreGameState } from "../../entities";

export const addNotificationsAndAudit = (
  state: CoreGameState,
  notifications: Notification[],
  auditEvents: AllianceAuditEvent[]
): CoreGameState => {
  const nextNotificationsById = { ...state.notificationsById };
  const nextNotificationIds = [...state.root.notificationIds];
  for (const notification of notifications) {
    if (nextNotificationsById[notification.id]) continue;
    nextNotificationsById[notification.id] = notification;
    nextNotificationIds.push(notification.id);
  }
  const nextAuditEventsById = { ...(state.allianceAuditEventsById ?? {}) };
  for (const auditEvent of auditEvents) {
    if (nextAuditEventsById[auditEvent.id]) continue;
    nextAuditEventsById[auditEvent.id] = auditEvent;
  }
  return {
    ...state,
    notificationsById: nextNotificationsById,
    allianceAuditEventsById: nextAuditEventsById,
    root: {
      ...state.root,
      notificationIds: nextNotificationIds,
      version: state.root.version + (notifications.length || auditEvents.length ? 1 : 0)
    }
  };
};

export const createAllianceNotification = (input: {
  id: string;
  allianceId: string;
  title: string;
  bodyKey: string;
  createdAt: string;
  payload: Record<string, unknown>;
}): Notification => ({
  id: input.id,
  recipientType: "alliance",
  recipientId: input.allianceId,
  category: "alliance.lifecycle",
  title: input.title,
  bodyKey: input.bodyKey,
  payload: input.payload,
  createdAt: input.createdAt,
  readAt: null
});

export const createPlayerNotification = (input: {
  id: string;
  playerId: string;
  title: string;
  bodyKey: string;
  createdAt: string;
  payload: Record<string, unknown>;
}): Notification => ({
  id: input.id,
  recipientType: "player",
  recipientId: input.playerId,
  category: "alliance.lifecycle",
  title: input.title,
  bodyKey: input.bodyKey,
  payload: input.payload,
  createdAt: input.createdAt,
  readAt: null
});

export const createAudit = (
  id: string,
  allianceId: string,
  type: AllianceAuditEvent["type"],
  createdAt: string,
  actorPlayerId?: string,
  targetPlayerId?: string,
  payload: Record<string, unknown> = {}
): AllianceAuditEvent => ({
  id,
  allianceId,
  actorPlayerId,
  targetPlayerId,
  type,
  createdAt,
  payload
});


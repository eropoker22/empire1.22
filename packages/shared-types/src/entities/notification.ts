import type { NotificationId } from "../ids/entity-id";

/**
 * Responsibility: Shared contract for server-generated notifications.
 * Belongs here: recipient, category, payload, and read-state fields.
 * Does not belong here: websocket delivery bookkeeping or localization rendering.
 */
export interface Notification {
  id: NotificationId;
  recipientType: NotificationRecipientType;
  recipientId: string;
  category: string;
  title: string;
  bodyKey: string;
  payload: Record<string, unknown>;
  createdAt: string;
  readAt: string | null;
}

export type NotificationRecipientType = "player" | "alliance" | "admin";


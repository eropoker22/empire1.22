import type { AllianceId, PlayerId, ServerInstanceId } from "../ids/entity-id";

/**
 * Responsibility: Stable alliance contract for one server instance.
 * Belongs here: membership references, ownership, and lifecycle status.
 * Does not belong here: chat runtime, invitation queues, or ranking caches.
 */
export interface Alliance {
  id: AllianceId;
  serverInstanceId: ServerInstanceId;
  name: string;
  tag: string;
  ownerPlayerId: PlayerId;
  memberIds: PlayerId[];
  status: AllianceStatus;
  createdAt: string;
  version: number;
}

export type AllianceStatus = "forming" | "active" | "disbanded";


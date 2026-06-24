import type { ServerInstanceId } from "@empire/shared-types";

export interface RuntimeOutboxRecord {
  outboxId: string;
  serverInstanceId: ServerInstanceId;
  commandId: string;
  eventType: string;
  payload: unknown;
  createdAt: string;
  publishedAt: string | null;
  attempts: number;
  lastError: string | null;
}


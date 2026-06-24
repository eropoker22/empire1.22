import type { ServerInstanceId } from "@empire/shared-types";
import type { RuntimeOutboxRecord } from "../dto";

export interface RuntimeOutboxRepository {
  append(record: RuntimeOutboxRecord): Promise<void>;
  listUnpublished(instanceId?: ServerInstanceId): Promise<RuntimeOutboxRecord[]>;
  markPublished(outboxId: string, publishedAt: string): Promise<void>;
  markPublishFailed(outboxId: string, error: string): Promise<void>;
}

export const createNullRuntimeOutboxRepository = (): RuntimeOutboxRepository => ({
  append: async (_record) => {
    return;
  },
  listUnpublished: async (_instanceId) => [],
  markPublished: async (_outboxId, _publishedAt) => {
    return;
  },
  markPublishFailed: async (_outboxId, _error) => {
    return;
  }
});


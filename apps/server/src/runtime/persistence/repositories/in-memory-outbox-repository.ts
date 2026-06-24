import type { ServerInstanceId } from "@empire/shared-types";
import type { RuntimeOutboxRecord } from "../dto";
import type { RuntimeOutboxRepository } from "./outbox-repository";

export const createInMemoryRuntimeOutboxRepository = (
  records: RuntimeOutboxRecord[] = []
): RuntimeOutboxRepository => ({
  append: async (record) => {
    if (!records.some((candidate) => candidate.outboxId === record.outboxId)) {
      records.push(clone(record));
    }
  },
  listUnpublished: async (instanceId?: ServerInstanceId) =>
    records
      .filter((record) => !record.publishedAt && (!instanceId || record.serverInstanceId === instanceId))
      .map(clone),
  markPublished: async (outboxId, publishedAt) => {
    const record = records.find((candidate) => candidate.outboxId === outboxId);
    if (record) {
      record.publishedAt = publishedAt;
      record.lastError = null;
    }
  },
  markPublishFailed: async (outboxId, error) => {
    const record = records.find((candidate) => candidate.outboxId === outboxId);
    if (record) {
      record.attempts += 1;
      record.lastError = error;
    }
  }
});

const clone = <TValue>(value: TValue): TValue =>
  JSON.parse(JSON.stringify(value)) as TValue;


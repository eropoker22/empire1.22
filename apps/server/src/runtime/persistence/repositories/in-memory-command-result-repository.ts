import type { ServerInstanceId } from "@empire/shared-types";
import type { CommandResultRecord } from "../dto";
import type { CommandResultRepository } from "./command-result-repository";

export const createInMemoryCommandResultRepository = (
  records: Map<string, CommandResultRecord> = new Map()
): CommandResultRepository => ({
  save: async (record) => {
    const key = createCommandResultKey(record.serverInstanceId, record.commandId);
    if (!records.has(key)) {
      records.set(key, clone(record));
      return;
    }

    const existing = records.get(key);
    if (existing?.payloadHash !== record.payloadHash || existing.status !== record.status) {
      throw new Error(`Command result conflict for command "${record.commandId}".`);
    }
  },
  getByCommandId: async (instanceId, commandId) => {
    const record = records.get(createCommandResultKey(instanceId, commandId));
    return record ? clone(record) : null;
  },
  listByInstance: async (instanceId: ServerInstanceId) =>
    [...records.values()]
      .filter((record) => record.serverInstanceId === instanceId)
      .map(clone)
});

const createCommandResultKey = (instanceId: ServerInstanceId, commandId: string): string =>
  `${instanceId}\u0000${commandId}`;

const clone = <TValue>(value: TValue): TValue =>
  JSON.parse(JSON.stringify(value)) as TValue;


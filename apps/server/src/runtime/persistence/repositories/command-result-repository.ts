import type { ServerInstanceId } from "@empire/shared-types";
import type { CommandResultRecord } from "../dto";

export interface CommandResultRepository {
  save(record: CommandResultRecord): Promise<void>;
  getByCommandId(instanceId: ServerInstanceId, commandId: string): Promise<CommandResultRecord | null>;
  listByInstance(instanceId: ServerInstanceId): Promise<CommandResultRecord[]>;
}

export const createNullCommandResultRepository = (): CommandResultRepository => ({
  save: async (_record) => {
    return;
  },
  getByCommandId: async (_instanceId, _commandId) => null,
  listByInstance: async (_instanceId) => []
});


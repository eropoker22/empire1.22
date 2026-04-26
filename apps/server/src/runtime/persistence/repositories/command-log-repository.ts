import type { ServerInstanceId } from "@empire/shared-types";
import type { CommandRecord } from "../dto";

/**
 * Responsibility: Storage boundary for command audit history.
 * Belongs here: append/read contract for command records.
 * Does not belong here: gameplay validation or transport parsing.
 */
export interface CommandLogRepository {
  append(record: CommandRecord): Promise<void>;
  listByInstance(instanceId: ServerInstanceId): Promise<CommandRecord[]>;
}

export const createNullCommandLogRepository = (): CommandLogRepository => ({
  append: async (_record) => {
    return;
  },
  listByInstance: async (_instanceId) => []
});


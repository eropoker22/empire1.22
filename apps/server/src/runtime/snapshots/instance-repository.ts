import type { ServerInstanceRecord } from "../instance/server-instance-record";

/**
 * Responsibility: Persistence boundary for instance lifecycle metadata.
 * Belongs here: save/load contracts for instance records separate from game state snapshots.
 * Does not belong here: runtime-only queues, sockets, or gameplay rules.
 */
export interface InstanceRepository {
  save(record: ServerInstanceRecord): Promise<void>;
  load(instanceId: string): Promise<ServerInstanceRecord | null>;
}

export const createNullInstanceRepository = (): InstanceRepository => ({
  save: async (_record) => {
    return;
  },
  load: async (_instanceId) => null
});


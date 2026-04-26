import type { ServerInstanceId } from "@empire/shared-types";
import type { DiagnosticRecord } from "../dto";

/**
 * Responsibility: Storage boundary for diagnostic and crash-oriented logs.
 * Belongs here: append/read contract for operational diagnostics.
 * Does not belong here: gameplay audit history or transport-specific state.
 */
export interface DiagnosticLogRepository {
  append(record: DiagnosticRecord): Promise<void>;
  listByInstance(instanceId: ServerInstanceId): Promise<DiagnosticRecord[]>;
}

export const createNullDiagnosticLogRepository = (): DiagnosticLogRepository => ({
  append: async (_record) => {
    return;
  },
  listByInstance: async (_instanceId) => []
});


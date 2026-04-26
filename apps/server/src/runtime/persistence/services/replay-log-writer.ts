import type { CommandRecord, DiagnosticRecord, EventRecord } from "../dto";
import type {
  CommandLogRepository,
  DiagnosticLogRepository,
  EventLogRepository
} from "../repositories";

/**
 * Responsibility: Writes command, event, and diagnostic records to the correct log repositories.
 * Belongs here: separation of audit streams by intent and retention policy.
 * Does not belong here: command routing, event creation, or UI notifications.
 */
export interface ReplayLogWriter {
  writeCommand(record: CommandRecord): Promise<void>;
  writeEvent(record: EventRecord): Promise<void>;
  writeDiagnostic(record: DiagnosticRecord): Promise<void>;
}

export const createReplayLogWriter = (
  commandLogRepository: CommandLogRepository,
  eventLogRepository: EventLogRepository,
  diagnosticLogRepository: DiagnosticLogRepository
): ReplayLogWriter => ({
  writeCommand: async (record) => commandLogRepository.append(record),
  writeEvent: async (record) => eventLogRepository.append(record),
  writeDiagnostic: async (record) => diagnosticLogRepository.append(record)
});


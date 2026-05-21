import type { ServerInstanceId } from "@empire/shared-types";
import type { DiagnosticRecord } from "../dto";
import type { DiagnosticLogRepository } from "./diagnostic-log-repository";
import {
  appendJsonLine,
  createInstancePersistenceFile,
  readJsonLines,
  type FilePersistenceOptions
} from "./file-persistence-utils";

/**
 * Responsibility: Local durable diagnostic log stored as readable NDJSON.
 * Belongs here: operational records under the repository boundary.
 * Does not belong here: gameplay audit events or log shipping.
 */
export const createFileDiagnosticLogRepository = (
  options: FilePersistenceOptions
): DiagnosticLogRepository => ({
  append: async (record) => {
    await appendJsonLine(createDiagnosticLogPath(options.rootDir, record.instanceId), record);
  },
  listByInstance: async (instanceId: ServerInstanceId) =>
    readJsonLines<DiagnosticRecord>(createDiagnosticLogPath(options.rootDir, instanceId))
});

const createDiagnosticLogPath = (rootDir: string, instanceId: ServerInstanceId): string =>
  createInstancePersistenceFile(rootDir, instanceId, "diagnostics.ndjson");

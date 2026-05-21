import type { ServerInstanceId } from "@empire/shared-types";
import type { CommandRecord } from "../dto";
import type { CommandLogRepository } from "./command-log-repository";
import {
  appendJsonLine,
  createInstancePersistenceFile,
  readJsonLines,
  type FilePersistenceOptions
} from "./file-persistence-utils";

/**
 * Responsibility: Local durable command audit log stored as readable NDJSON.
 * Belongs here: append-only file persistence under the repository boundary.
 * Does not belong here: gameplay validation, replay execution, or DB adapters.
 */
export const createFileCommandLogRepository = (
  options: FilePersistenceOptions
): CommandLogRepository => ({
  append: async (record) => {
    await appendJsonLine(createCommandLogPath(options.rootDir, record.instanceId), record);
  },
  listByInstance: async (instanceId: ServerInstanceId) =>
    readJsonLines<CommandRecord>(createCommandLogPath(options.rootDir, instanceId))
});

const createCommandLogPath = (rootDir: string, instanceId: ServerInstanceId): string =>
  createInstancePersistenceFile(rootDir, instanceId, "commands.ndjson");

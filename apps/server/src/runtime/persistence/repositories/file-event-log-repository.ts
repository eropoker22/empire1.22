import type { ServerInstanceId } from "@empire/shared-types";
import type { EventRecord } from "../dto";
import type { EventLogRepository } from "./event-log-repository";
import {
  appendJsonLine,
  createInstancePersistenceFile,
  readJsonLines,
  type FilePersistenceOptions
} from "./file-persistence-utils";

/**
 * Responsibility: Local durable event audit log stored as readable NDJSON.
 * Belongs here: append-only file persistence under the repository boundary.
 * Does not belong here: event creation, websocket delivery, or projection logic.
 */
export const createFileEventLogRepository = (
  options: FilePersistenceOptions
): EventLogRepository => ({
  append: async (record) => {
    await appendJsonLine(createEventLogPath(options.rootDir, record.instanceId), record);
  },
  listByInstance: async (instanceId: ServerInstanceId) =>
    readJsonLines<EventRecord>(createEventLogPath(options.rootDir, instanceId))
});

const createEventLogPath = (rootDir: string, instanceId: ServerInstanceId): string =>
  createInstancePersistenceFile(rootDir, instanceId, "events.ndjson");

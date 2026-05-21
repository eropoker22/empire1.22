import { promises as fs } from "node:fs";
import { dirname, join } from "node:path";

export const FILE_PERSISTENCE_SCHEMA_VERSION = 1;

export interface FilePersistenceOptions {
  rootDir: string;
}

export interface FileEnvelope<TRecord> {
  schemaVersion: typeof FILE_PERSISTENCE_SCHEMA_VERSION;
  record: TRecord;
}

export const createInstancePersistenceDir = (
  rootDir: string,
  instanceId: string
): string => join(rootDir, "instances", encodePathSegment(instanceId));

export const createInstancePersistenceFile = (
  rootDir: string,
  instanceId: string,
  fileName: string
): string => join(createInstancePersistenceDir(rootDir, instanceId), fileName);

export const appendJsonLine = async <TRecord>(
  filePath: string,
  record: TRecord
): Promise<void> => {
  await fs.mkdir(dirname(filePath), { recursive: true });
  await fs.appendFile(filePath, `${JSON.stringify(createEnvelope(record))}\n`, "utf8");
};

export const readJsonLines = async <TRecord>(
  filePath: string
): Promise<TRecord[]> => {
  let raw = "";

  try {
    raw = await fs.readFile(filePath, "utf8");
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      return [];
    }
    throw error;
  }

  return raw
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as FileEnvelope<TRecord>)
    .filter(isSupportedEnvelope)
    .map((entry) => entry.record);
};

export const writeJsonFileAtomic = async <TRecord>(
  filePath: string,
  record: TRecord
): Promise<void> => {
  await fs.mkdir(dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tempPath, `${JSON.stringify(createEnvelope(record), null, 2)}\n`, "utf8");
  await fs.rename(tempPath, filePath);
};

export const readJsonFile = async <TRecord>(
  filePath: string
): Promise<TRecord | null> => {
  try {
    const parsed = JSON.parse(await fs.readFile(filePath, "utf8")) as FileEnvelope<TRecord>;
    return isSupportedEnvelope(parsed) ? parsed.record : null;
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      return null;
    }
    throw error;
  }
};

export const encodePathSegment = (value: string): string => encodeURIComponent(value);

const createEnvelope = <TRecord>(record: TRecord): FileEnvelope<TRecord> => ({
  schemaVersion: FILE_PERSISTENCE_SCHEMA_VERSION,
  record
});

const isSupportedEnvelope = <TRecord>(value: FileEnvelope<TRecord>): value is FileEnvelope<TRecord> =>
  value?.schemaVersion === FILE_PERSISTENCE_SCHEMA_VERSION && "record" in value;

const isNodeError = (error: unknown): error is { code?: string } =>
  Boolean(error && typeof error === "object" && "code" in error);

import {
  getProductionSchemaStatus,
  type PostgresDatabase
} from "../runtime/persistence/postgres";

export const HOSTED_WORKER_SCHEMA_ERROR =
  "Hosted worker refuses to start with pending or mismatched database migrations.";

export const assertHostedRuntimeWorkerSchemaCurrent = async (
  database: PostgresDatabase
): Promise<{ schemaVersion: string; expectedSchemaVersion: string }> => {
  const status = await getProductionSchemaStatus(database).catch(() => null);
  if (!status?.current || !status.appliedVersion) {
    throw new Error(HOSTED_WORKER_SCHEMA_ERROR);
  }
  return { schemaVersion: status.appliedVersion, expectedSchemaVersion: status.expectedVersion };
};

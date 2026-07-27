import {
  isProductionSchemaCurrent,
  type PostgresDatabase
} from "../runtime/persistence/postgres";

export const HOSTED_WORKER_SCHEMA_ERROR =
  "Hosted worker refuses to start with pending or mismatched database migrations.";

export const assertHostedRuntimeWorkerSchemaCurrent = async (
  database: PostgresDatabase
): Promise<void> => {
  if (!await isProductionSchemaCurrent(database)) {
    throw new Error(HOSTED_WORKER_SCHEMA_ERROR);
  }
};

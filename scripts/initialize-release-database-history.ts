import "./load-local-environment";
import { createPostgresDatabase } from "../apps/server/src/runtime/persistence/postgres";
import {
  acquireMigrationLock,
  ensureHistoryTable
} from "../apps/server/src/runtime/persistence/postgres/migration-runner";
import {
  assertReleaseDatabaseCanInitialize,
  validateReleaseDatabaseEnvironment
} from "./release-database-guard";

const release = validateReleaseDatabaseEnvironment(process.env);
const databaseUrl = String(process.env.EMPIRE_DATABASE_URL ?? "").trim();
const database = createPostgresDatabase(databaseUrl);

try {
  await database.transaction(async (client) => {
    await acquireMigrationLock(client);
    const target = await client.query<{
      current_schema: string | null;
      history_exists: boolean;
      public_object_count: number;
    }>(
      `SELECT current_schema() AS current_schema,
        to_regclass('public.empire_schema_migrations') IS NOT NULL AS history_exists,
        (
          SELECT count(*)::integer
          FROM pg_catalog.pg_class relation
          JOIN pg_catalog.pg_namespace namespace ON namespace.oid=relation.relnamespace
          WHERE namespace.nspname='public'
            AND relation.relkind IN ('r','p','v','m','S','f')
        ) AS public_object_count`
    );
    const state = target.rows[0];
    assertReleaseDatabaseCanInitialize({
      initializationConfirmed: release.initializationConfirmed,
      currentSchema: state?.current_schema ?? null,
      historyExists: Boolean(state?.history_exists),
      publicObjectCount: Number(state?.public_object_count)
    });
    await ensureHistoryTable(client);
  });
  console.log(`Initialized empty release migration history: environment=${release.environment};`
    + ` mode=${release.connectionMode}; providerHash=${release.providerHostnameHash};`
    + ` databaseHash=${release.databaseNameHash}; sslmode=${release.sslMode}; backupHash=${release.backupIdHash}.`);
} finally {
  await database.close();
}

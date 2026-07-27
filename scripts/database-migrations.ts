import "./load-local-environment";
import { createPostgresDatabase } from "../apps/server/src/runtime/persistence/postgres";
import { prepareSnapshotRecoveryMigrationControlled } from
  "../apps/server/src/runtime/persistence/postgres/controlled-snapshot-recovery-migration";
import { getDatabaseMigrationStatus, migrateDatabase } from "../apps/server/src/runtime/persistence/postgres/migration-runner";

const databaseUrl = String(process.env.EMPIRE_DATABASE_URL ?? process.env.EMPIRE_TEST_DATABASE_URL ?? "").trim();
if (!databaseUrl) throw new Error("Set EMPIRE_DATABASE_URL or EMPIRE_TEST_DATABASE_URL before running database migrations.");
const database = createPostgresDatabase(databaseUrl);
const migrations = new URL("../apps/server/src/runtime/persistence/postgres/migrations/", import.meta.url);

try {
  const command = process.argv.includes("--status") ? "status" : "migrate";
  const controlledSnapshotRecovery =
    command === "migrate" && process.argv.includes("--controlled-snapshot-recovery");
  const prepareLegacyImport =
    command === "migrate" && process.argv.includes("--prepare-legacy-import");
  if (controlledSnapshotRecovery && prepareLegacyImport) {
    throw new Error("Choose either controlled snapshot recovery or legacy import preparation.");
  }
  if (prepareLegacyImport) {
    const status = await migrateDatabase(database, migrations, {
      stopBeforeFilename: "016_free_mode_ten_second_tick.sql"
    });
    if (status.applied.at(-1) !== "015_account_age_requirement.sql" ||
      status.pending[0] !== "016_free_mode_ten_second_tick.sql") {
      throw new Error("Legacy import preparation did not stop at the canonical migration 015 boundary.");
    }
    console.log("Database prepared at canonical migration 015 for a controlled legacy data import.");
    console.log(`Applied: ${status.applied.length}; pending: ${status.pending.length}.`);
    process.exitCode = 0;
  } else {
    if (controlledSnapshotRecovery) {
      await migrateDatabase(database, migrations, {
        stopBeforeFilename: "017_snapshot_recovery_heads_and_checkpoints.sql"
      });
      await prepareSnapshotRecoveryMigrationControlled(database, {
        batchSize: positiveIntegerEnvironment("EMPIRE_SNAPSHOT_MIGRATION_BATCH_SIZE", 500)
      });
    }
    const status = command === "status"
      ? await getDatabaseMigrationStatus(database, migrations)
      : await migrateDatabase(database, migrations);
    console.log(`Database migrations: ${status.current ? "current" : "pending"}.`);
    console.log(`Applied: ${status.applied.length}; pending: ${status.pending.length}.`);
    if (!status.current) process.exitCode = 1;
  }
} finally {
  await database.close();
}

function positiveIntegerEnvironment(key: string, fallback: number): number {
  const value = Number(process.env[key] ?? fallback);
  return Number.isSafeInteger(value) && value > 0 ? value : fallback;
}

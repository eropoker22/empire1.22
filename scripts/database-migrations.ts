import "./load-local-environment";
import { createPostgresDatabase, getDatabaseMigrationStatus, migrateDatabase } from "../apps/server/src/runtime/persistence/postgres";

const databaseUrl = String(process.env.EMPIRE_DATABASE_URL ?? process.env.EMPIRE_TEST_DATABASE_URL ?? "").trim();
if (!databaseUrl) throw new Error("Set EMPIRE_DATABASE_URL or EMPIRE_TEST_DATABASE_URL before running database migrations.");
const database = createPostgresDatabase(databaseUrl);
const migrations = new URL("../apps/server/src/runtime/persistence/postgres/migrations/", import.meta.url);

try {
  const command = process.argv.includes("--status") ? "status" : "migrate";
  const status = command === "status"
    ? await getDatabaseMigrationStatus(database, migrations)
    : await migrateDatabase(database, migrations);
  console.log(`Database migrations: ${status.current ? "current" : "pending"}.`);
  console.log(`Applied: ${status.applied.length}; pending: ${status.pending.length}.`);
  if (!status.current) process.exitCode = 1;
} finally {
  await database.close();
}

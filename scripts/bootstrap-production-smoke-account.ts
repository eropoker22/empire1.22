import "./load-local-environment";
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { createPostgresPlayerEntryRepository } from "../apps/server/src/player-entry/postgres-player-entry-repository";
import { entryErrorCode } from "../apps/server/src/player-entry/player-entry-error";
import { normalizePlayerUsername } from "../apps/server/src/player-entry/player-entry-policy";
import { createPostgresDatabase } from "../apps/server/src/runtime/persistence/postgres";
import { getDatabaseMigrationStatus } from "../apps/server/src/runtime/persistence/postgres/migration-runner";
import { validateProductionSmokeAccountEnvironment } from "./production-smoke-account-contract.mjs";

const run = async () => {
  const config = validateProductionSmokeAccountEnvironment(process.env);
  const password = String(process.env.EMPIRE_PRODUCTION_SMOKE_ACCOUNT_PASSWORD);
  const database = createPostgresDatabase(String(process.env.EMPIRE_DATABASE_URL), {
    max: 1,
    connectionTimeoutMillis: 10_000,
    statementTimeoutMillis: 15_000,
    queryTimeoutMillis: 15_000,
    allowExitOnIdle: true
  });
  try {
    const migrationStatus = await getDatabaseMigrationStatus(
      database,
      new URL("../apps/server/src/runtime/persistence/postgres/migrations/", import.meta.url)
    );
    if (!migrationStatus.current) throw new Error("PRODUCTION_SMOKE_ACCOUNT_SCHEMA_MISMATCH");
    const repository = createPostgresPlayerEntryRepository(database);
    let created = false;
    let account;
    try {
      account = await repository.login({ username: config.username, password });
    } catch (error) {
      if (entryErrorCode(error) !== "ACCOUNT_LOGIN_INVALID") throw error;
      account = await repository.registerAccount({
        username: config.username,
        displayName: config.username,
        gangName: config.gangName,
        dateOfBirth: "1990-01-01",
        password,
        passwordConfirmation: password,
        termsAccepted: true,
        termsVersion: config.termsVersion
      });
      created = true;
    }
    if (account.session.username !== config.username || account.session.gangName !== config.gangName) {
      throw new Error("PRODUCTION_SMOKE_ACCOUNT_PROFILE_MISMATCH");
    }
    if (!await repository.revokeSession(account.token)) throw new Error("PRODUCTION_SMOKE_ACCOUNT_SESSION_REVOKE_FAILED");
    const verified = await repository.login({ username: config.username, password });
    if (verified.session.accountId !== account.session.accountId) throw new Error("PRODUCTION_SMOKE_ACCOUNT_IDENTITY_MISMATCH");
    if (!await repository.revokeSession(verified.token)) throw new Error("PRODUCTION_SMOKE_ACCOUNT_VERIFY_REVOKE_FAILED");
    const count = await database.query<{ count: string | number }>(
      "SELECT count(*) AS count FROM empire_accounts WHERE normalized_username=$1",
      [normalizePlayerUsername(config.username)]
    );
    if (Number(count.rows[0]?.count ?? 0) !== 1) throw new Error("PRODUCTION_SMOKE_ACCOUNT_DUPLICATE");
    const evidence = {
      checkedAt: new Date().toISOString(),
      environment: "production",
      buildSha: config.buildSha,
      action: created ? "created" : "verified-existing",
      usernameHash: safeHash(config.username),
      accountIdHash: safeHash(account.session.accountId),
      databaseTargetHash: config.databaseTargetHash,
      backupIdHash: config.backupIdHash,
      schemaVersion: migrationStatus.applied.at(-1) ?? null,
      sessionsRevoked: true
    };
    await mkdir(dirname(config.evidencePath), { recursive: true });
    await writeFile(config.evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
    console.log(`Production smoke account ${evidence.action}; usernameHash=${evidence.usernameHash}.`);
  } finally {
    await database.close();
  }
};

run().catch((error) => {
  const code = String(error instanceof Error ? error.message : error).split(":", 1)[0]
    .replace(/[^A-Z0-9_.-]/giu, "_").slice(0, 120);
  console.error(`Production smoke account bootstrap failed: ${code}.`);
  process.exitCode = 1;
});

const safeHash = (value: string): string => createHash("sha256").update(value).digest("hex").slice(0, 16);

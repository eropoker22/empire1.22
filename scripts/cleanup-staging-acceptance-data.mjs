import pg from "pg";
import { assertSafeRemoteStagingFixtureEnvironment } from "./remote-staging-fixture-safety.mjs";
import {
  runStagingAcceptanceCleanup,
  validateStagingAcceptanceCleanupRequest
} from "./staging-acceptance-cleanup-contract.mjs";

const value = (name, fallback = "") => {
  const prefix = `${name}=`;
  return process.argv.find((entry) => entry.startsWith(prefix))?.slice(prefix.length) ?? fallback;
};
const safety = assertSafeRemoteStagingFixtureEnvironment(process.env);
const request = validateStagingAcceptanceCleanupRequest({
  environment: process.env,
  options: {
    apply: process.argv.includes("--apply"),
    targetHash: value("--target-hash"),
    syntheticPrefix: value("--synthetic-prefix"),
    runNonceHash: value("--run-nonce-hash"),
    createdBefore: value("--created-before"),
    maxAccounts: Number(value("--max-accounts", "100")),
    maxServers: Number(value("--max-servers", "10"))
  }
});
if (request.targetHash !== safety.targetHash) throw new Error("STAGING_ACCEPTANCE_CLEANUP_TARGET_HASH_MISMATCH");

const pool = new pg.Pool({ connectionString: String(process.env.EMPIRE_DATABASE_URL), max: 1 });
const database = {
  query: (text, parameters) => pool.query(text, parameters),
  transaction: async (callback) => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const result = await callback(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },
  close: () => pool.end()
};
try {
  const repository = {
    findScope: async (scope) => {
      const servers = await database.query(
        `SELECT server_instance_id,status FROM empire_hosted_server_instances
         WHERE display_name LIKE $1 ESCAPE '\\' AND created_at <= $2::timestamptz
         ORDER BY created_at LIMIT $3`,
        [`${scope.syntheticPrefix.replaceAll("%", "\\%").replaceAll("_", "\\_")}%`, scope.createdBefore,
          scope.maxServers + 1]
      );
      const serverIds = servers.rows.map((row) => row.server_instance_id);
      const accounts = serverIds.length === 0 ? { rows: [] } : await database.query(
        `SELECT DISTINCT account_id FROM empire_server_memberships
         WHERE server_instance_id = ANY($1::text[]) ORDER BY account_id LIMIT $2`,
        [serverIds, scope.maxAccounts + 1]
      );
      return { servers: servers.rows, accountIds: accounts.rows.map((row) => row.account_id), serverIds };
    },
    applyScope: ({ scope, nowIso }) => database.transaction(async (client) => {
      const sessionIds = scope.serverIds;
      const accounts = scope.accountIds;
      const gameplay = await client.query(
        `UPDATE empire_gameplay_sessions SET revoked_at=COALESCE(revoked_at,$2::timestamptz),
           updated_at=$2::timestamptz,version=version+1
         WHERE server_instance_id=ANY($1::text[]) AND revoked_at IS NULL RETURNING session_id`,
        [sessionIds, nowIso]
      );
      const accountSessions = await client.query(
        `UPDATE empire_account_sessions SET revoked_at=COALESCE(revoked_at,$2::timestamptz),version=version+1
         WHERE account_id=ANY($1::text[]) AND revoked_at IS NULL RETURNING session_id`,
        [accounts, nowIso]
      );
      const tickets = await client.query(
        `UPDATE empire_join_tickets SET status='revoked',updated_at=$2::timestamptz
         WHERE server_instance_id=ANY($1::text[]) AND consumed_at IS NULL RETURNING ticket_id`,
        [sessionIds, nowIso]
      );
      await client.query(
        `UPDATE empire_hosted_join_reservations SET status='canceled',canceled_at=$2::timestamptz,
           updated_at=$2::timestamptz,version=version+1
         WHERE server_instance_id=ANY($1::text[]) AND status IN ('reserved','committed')`,
        [sessionIds, nowIso]
      );
      const disabled = await client.query(
        `UPDATE empire_accounts SET status='disabled',updated_at=$2::timestamptz,version=version+1
         WHERE account_id=ANY($1::text[]) AND status <> 'disabled' RETURNING account_id`,
        [accounts, nowIso]
      );
      return {
        sessionsRevoked: (gameplay.rowCount ?? 0) + (accountSessions.rowCount ?? 0),
        ticketsExpired: tickets.rowCount ?? 0,
        syntheticAccountsDisabled: disabled.rowCount ?? 0
      };
    })
  };
  const summary = await runStagingAcceptanceCleanup({
    request,
    repository,
    nowIso: new Date().toISOString()
  });
  console.log(JSON.stringify(summary));
} finally {
  await database.close();
}

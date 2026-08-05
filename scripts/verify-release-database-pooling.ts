import { createPostgresDatabase } from "../apps/server/src/runtime/persistence/postgres";
import { validateReleaseDatabaseEndpoints } from "./release-database-endpoint-contract.mjs";
import { assertReleaseDatabasePoolingState } from "./release-database-pooling-contract";

const endpointSummary = validateReleaseDatabaseEndpoints(process.env);
const pooledUrls = new Set([
  String(process.env.EMPIRE_RELEASE_DATABASE_URL_POOLED ?? "").trim(),
  String(process.env.GAMEPLAY_RELEASE_DATABASE_URL_POOLED ?? "").trim()
]);
const verifiedTimeouts = new Set<number>();

for (const databaseUrl of pooledUrls) {
  const database = createPostgresDatabase(databaseUrl, {
    max: 1,
    idleTimeoutMillis: 1_000,
    connectionTimeoutMillis: 5_000,
    queryTimeoutMillis: 15_000,
    allowExitOnIdle: true
  });
  try {
    const state = await database.query<{
      current_schema: string | null;
      statement_timeout: string;
    }>(
      `SELECT current_schema() AS current_schema,
        current_setting('statement_timeout') AS statement_timeout`
    );
    verifiedTimeouts.add(assertReleaseDatabasePoolingState({
      currentSchema: state.rows[0]?.current_schema ?? null,
      statementTimeout: String(state.rows[0]?.statement_timeout ?? "")
    }));
    await database.transaction(async (client) => {
      const result = await client.query<{ connected: number }>("SELECT 1 AS connected");
      if (result.rows[0]?.connected !== 1) throw new Error("RELEASE_POOLED_TRANSACTION_FAILED");
    });
  } finally {
    await database.close();
  }
}

console.log(`Release pooled database verified: provider=${endpointSummary.provider};`
  + ` providerHash=${endpointSummary.providerHostnameHash}; databaseHash=${endpointSummary.databaseNameHash};`
  + ` statementTimeoutMs=${[...verifiedTimeouts].sort((left, right) => left - right).join(",")}.`);

import type { PostgresDatabase } from "./postgres-client";

export const revokeAccountGameplaySessions = (
  database: PostgresDatabase,
  accountId: string,
  revokedAt: string
): Promise<number> => revokeSessions(database, "account_id", accountId, revokedAt);

export const revokePlayerGameplaySessions = (
  database: PostgresDatabase,
  playerId: string,
  revokedAt: string
): Promise<number> => revokeSessions(database, "player_id", playerId, revokedAt);

const revokeSessions = async (
  database: PostgresDatabase,
  identityColumn: "account_id" | "player_id",
  identityId: string,
  revokedAt: string
): Promise<number> => {
  const result = await database.query(
    `UPDATE empire_gameplay_sessions
    SET revoked_at = $2::timestamptz,
        version = version + 1,
        updated_at = now()
    WHERE ${identityColumn} = $1
      AND revoked_at IS NULL
    RETURNING session_id`,
    [identityId, revokedAt]
  );
  return result.rowCount ?? 0;
};

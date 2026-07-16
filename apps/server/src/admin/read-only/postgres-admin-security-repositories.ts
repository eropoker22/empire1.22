import type { AdminAuditEntryView } from "@empire/shared-types";
import type { PostgresQueryable } from "../../runtime/persistence/postgres";
import type {
  AdminAuditRepository,
  AdminLoginRateLimitRepository,
  AdminSessionRepository,
  AdminStoredSession
} from "./admin-repositories";

interface SessionRow extends Record<string, unknown> {
  admin_session_id: string;
  token_hash: string;
  actor_id: string;
  display_name: string;
  role: AdminStoredSession["role"];
  authentication_method: AdminStoredSession["authenticationMethod"];
  created_at: Date | string;
  expires_at: Date | string;
  revoked_at: Date | string | null;
}

export const createPostgresAdminSessionRepository = (
  database: PostgresQueryable
): AdminSessionRepository => ({
  durable: true,
  createSession: async (session) => {
    const result = await database.query<SessionRow>(
      `INSERT INTO empire_admin_sessions (
        id, admin_session_id, token_hash, actor_id, display_name, role,
        authentication_method, created_at, expires_at, revoked_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::timestamptz, $9::timestamptz, $10::timestamptz)
      RETURNING admin_session_id, token_hash, actor_id, display_name, role,
        authentication_method, created_at, expires_at, revoked_at`,
      [`admin-session:${session.adminSessionId}`, session.adminSessionId, session.tokenHash, session.actorId,
        session.displayName, session.role, session.authenticationMethod, session.createdAt, session.expiresAt, session.revokedAt]
    );
    return mapSession(result.rows[0]!);
  },
  getSessionByTokenHash: async (tokenHash) => {
    const result = await database.query<SessionRow>(
      `SELECT admin_session_id, token_hash, actor_id, display_name, role,
        authentication_method, created_at, expires_at, revoked_at
       FROM empire_admin_sessions WHERE token_hash = $1`, [tokenHash]);
    return result.rows[0] ? mapSession(result.rows[0]) : null;
  },
  revokeSession: async (sessionId, revokedAt) => {
    const result = await database.query(
      `UPDATE empire_admin_sessions SET revoked_at = $2::timestamptz, updated_at = now()
       WHERE admin_session_id = $1 AND revoked_at IS NULL RETURNING admin_session_id`, [sessionId, revokedAt]);
    return (result.rowCount ?? result.rows.length) > 0;
  }
});

export const createPostgresAdminAuditRepository = (
  database: PostgresQueryable
): AdminAuditRepository => ({
  durable: true,
  append: async (entry) => {
    await database.query(
      `INSERT INTO empire_admin_access_audit (
        id, admin_session_id, actor_id, role, action, target_instance_id,
        result, correlation_id, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::timestamptz)`,
      [entry.id, entry.adminSessionId, entry.actorId, entry.role, entry.action,
        entry.targetInstanceId, entry.result, entry.correlationId, entry.createdAt]
    );
  },
  list: async (limit) => {
    const result = await database.query<{
      id: string;
      admin_session_id: string | null;
      actor_id: string | null;
      role: AdminAuditEntryView["role"];
      action: AdminAuditEntryView["action"];
      target_instance_id: string | null;
      result: AdminAuditEntryView["result"];
      correlation_id: string;
      created_at: Date | string;
    }>(`SELECT id, admin_session_id, actor_id, role, action, target_instance_id,
          result, correlation_id, created_at
        FROM empire_admin_access_audit ORDER BY created_at DESC LIMIT $1`, [cap(limit)]);
    return result.rows.map((row) => ({
      id: row.id,
      adminSessionId: row.admin_session_id,
      actorId: row.actor_id,
      role: row.role,
      action: row.action,
      targetInstanceId: row.target_instance_id,
      result: row.result,
      correlationId: row.correlation_id,
      createdAt: iso(row.created_at)
    }));
  }
});

export const createPostgresAdminLoginRateLimitRepository = (
  database: PostgresQueryable
): AdminLoginRateLimitRepository => ({
  durable: true,
  countRecentFailures: async (scopeHash, since) => {
    const result = await database.query<{ count: string | number }>(
      `SELECT count(*) AS count FROM empire_admin_login_failures
       WHERE (fingerprint_hash = $1 OR actor_hash = $1) AND created_at >= $2::timestamptz`, [scopeHash, since]);
    return Number(result.rows[0]?.count ?? 0);
  },
  recordFailure: async (entry) => {
    await database.query(
      `INSERT INTO empire_admin_login_failures (id, fingerprint_hash, actor_hash, created_at)
       VALUES ($1, $2, $3, $4::timestamptz)`,
      [entry.id, entry.fingerprintHash, entry.actorHash, entry.createdAt]
    );
  }
});

const mapSession = (row: SessionRow): AdminStoredSession => ({
  adminSessionId: row.admin_session_id,
  tokenHash: row.token_hash,
  actorId: row.actor_id,
  displayName: row.display_name,
  role: row.role,
  authenticationMethod: row.authentication_method,
  createdAt: iso(row.created_at),
  expiresAt: iso(row.expires_at),
  revokedAt: row.revoked_at ? iso(row.revoked_at) : null
});
const iso = (value: Date | string): string => value instanceof Date ? value.toISOString() : new Date(value).toISOString();
const cap = (value: number): number => Math.max(1, Math.min(500, Math.floor(value)));

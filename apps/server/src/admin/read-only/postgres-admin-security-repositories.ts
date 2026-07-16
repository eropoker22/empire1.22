import type { AdminAuditEntryView } from "@empire/shared-types";
import type { PostgresQueryable } from "../../runtime/persistence/postgres";
import type {
  AdminAuditRepository,
  AdminLoginRateLimitRepository,
  AdminSessionRepository,
  AdminStoredSession,
  AdminUserRecord,
  AdminUserRepository
} from "./admin-repositories";

interface SessionRow extends Record<string, unknown> {
  admin_session_id: string;
  token_hash: string;
  admin_user_id: string;
  actor_id: string;
  username: string;
  display_name: string;
  role: AdminStoredSession["role"];
  authentication_method: AdminStoredSession["authenticationMethod"];
  created_at: Date | string;
  expires_at: Date | string;
  revoked_at: Date | string | null;
  last_seen_at: Date | string;
  password_version: number;
}

interface AdminUserRow extends Record<string, unknown> {
  admin_user_id: string;
  username: string;
  normalized_username: string;
  password_hash: string;
  password_salt: string;
  password_algorithm: AdminUserRecord["passwordAlgorithm"];
  password_parameters: AdminUserRecord["passwordParameters"];
  password_version: number;
  role: AdminUserRecord["role"];
  status: AdminUserRecord["status"];
  display_name: string;
  created_at: Date | string;
  updated_at: Date | string;
  last_login_at: Date | string | null;
  password_changed_at: Date | string;
  version: string | number;
}

export const createPostgresAdminUserRepository = (database: PostgresQueryable): AdminUserRepository => ({
  durable: true,
  getByNormalizedUsername: async (normalizedUsername) => {
    const result = await database.query<AdminUserRow>(`${USER_SELECT} WHERE normalized_username = $1`, [normalizedUsername]);
    return result.rows[0] ? mapUser(result.rows[0]) : null;
  },
  getById: async (adminUserId) => {
    const result = await database.query<AdminUserRow>(`${USER_SELECT} WHERE admin_user_id = $1`, [adminUserId]);
    return result.rows[0] ? mapUser(result.rows[0]) : null;
  },
  create: async (user) => {
    const result = await database.query<AdminUserRow>(
      `INSERT INTO empire_admin_users (
        id, admin_user_id, username, normalized_username, password_hash, password_salt,
        password_algorithm, password_parameters, password_version, role, status, display_name,
        created_at, updated_at, last_login_at, password_changed_at, version
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10,$11,$12,$13::timestamptz,$14::timestamptz,$15::timestamptz,$16::timestamptz,$17)
      RETURNING ${USER_COLUMNS}`,
      [`admin-user:${user.adminUserId}`, user.adminUserId, user.username, user.normalizedUsername,
        user.passwordHash, user.passwordSalt, user.passwordAlgorithm, JSON.stringify(user.passwordParameters),
        user.passwordVersion, user.role, user.status, user.displayName, user.createdAt, user.updatedAt,
        user.lastLoginAt, user.passwordChangedAt, user.version]
    );
    return mapUser(result.rows[0]!);
  },
  updateProfileAndRole: async (input) => {
    const result = await database.query<AdminUserRow>(
      `UPDATE empire_admin_users SET username=$2, normalized_username=$3, display_name=$4, role=$5,
       status=$6, updated_at=$7::timestamptz, version=version+1 WHERE admin_user_id=$1 RETURNING ${USER_COLUMNS}`,
      [input.adminUserId, input.username, input.normalizedUsername, input.displayName, input.role, input.status, input.updatedAt]
    );
    if (!result.rows[0]) throw new Error("Admin user was not found.");
    return mapUser(result.rows[0]);
  },
  rotatePassword: async (input) => {
    const result = await database.query<AdminUserRow>(
      `UPDATE empire_admin_users SET password_hash=$2, password_salt=$3, password_algorithm=$4,
       password_parameters=$5::jsonb, password_version=password_version+1,
       password_changed_at=$6::timestamptz, updated_at=$7::timestamptz, version=version+1
       WHERE admin_user_id=$1 RETURNING ${USER_COLUMNS}`,
      [input.adminUserId, input.passwordHash, input.passwordSalt, input.passwordAlgorithm,
        JSON.stringify(input.passwordParameters), input.passwordChangedAt, input.updatedAt]
    );
    if (!result.rows[0]) throw new Error("Admin user was not found.");
    return mapUser(result.rows[0]);
  },
  recordLogin: async (adminUserId, at) => {
    await database.query(`UPDATE empire_admin_users SET last_login_at=$2::timestamptz, updated_at=$2::timestamptz,
      version=version+1 WHERE admin_user_id=$1`, [adminUserId, at]);
  }
});

export const createPostgresAdminSessionRepository = (
  database: PostgresQueryable
): AdminSessionRepository => ({
  durable: true,
  createSession: async (session) => {
    const result = await database.query<SessionRow>(
      `INSERT INTO empire_admin_sessions (
        id, admin_session_id, token_hash, admin_user_id, actor_id, username, display_name, role,
        authentication_method, password_version, created_at, expires_at, revoked_at, last_seen_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::timestamptz,$12::timestamptz,$13::timestamptz,$14::timestamptz)
      RETURNING ${SESSION_COLUMNS}`,
      [`admin-session:${session.adminSessionId}`, session.adminSessionId, session.tokenHash, session.adminUserId,
        session.actorId, session.username, session.displayName, session.role, session.authenticationMethod,
        session.passwordVersion, session.createdAt, session.expiresAt, session.revokedAt, session.lastSeenAt]
    );
    return mapSession(result.rows[0]!);
  },
  getSessionByTokenHash: async (tokenHash) => {
    const result = await database.query<SessionRow>(
      `SELECT ${SESSION_COLUMNS}
       FROM empire_admin_sessions WHERE token_hash = $1 AND admin_user_id IS NOT NULL
       AND username IS NOT NULL AND password_version IS NOT NULL AND last_seen_at IS NOT NULL`, [tokenHash]);
    return result.rows[0] ? mapSession(result.rows[0]) : null;
  },
  revokeSession: async (sessionId, revokedAt) => {
    const result = await database.query(
      `UPDATE empire_admin_sessions SET revoked_at = $2::timestamptz, updated_at = now()
       WHERE admin_session_id = $1 AND revoked_at IS NULL RETURNING admin_session_id`, [sessionId, revokedAt]);
    return (result.rowCount ?? result.rows.length) > 0;
  },
  revokeSessionsForUser: async (adminUserId, revokedAt, exceptSessionId) => {
    const result = await database.query(`UPDATE empire_admin_sessions SET revoked_at=$2::timestamptz, updated_at=now()
      WHERE admin_user_id=$1 AND revoked_at IS NULL AND ($3::text IS NULL OR admin_session_id <> $3)`,
    [adminUserId, revokedAt, exceptSessionId ?? null]);
    return result.rowCount ?? 0;
  },
  touchSession: async (sessionId, lastSeenAt) => {
    await database.query(`UPDATE empire_admin_sessions SET last_seen_at=$2::timestamptz, updated_at=now()
      WHERE admin_session_id=$1 AND revoked_at IS NULL`, [sessionId, lastSeenAt]);
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
       WHERE (fingerprint_hash=$1 OR actor_hash=$1 OR username_hash=$1 OR combination_hash=$1)
       AND created_at >= $2::timestamptz`, [scopeHash, since]);
    return Number(result.rows[0]?.count ?? 0);
  },
  recordFailure: async (entry) => {
    await database.query(
      `INSERT INTO empire_admin_login_failures (id, fingerprint_hash, actor_hash, username_hash, combination_hash, created_at)
       VALUES ($1,$2,$3,$4,$5,$6::timestamptz)`,
      [entry.id, entry.fingerprintHash, entry.actorHash, entry.usernameHash, entry.combinationHash, entry.createdAt]
    );
  },
  clearFailures: async (usernameHash, combinationHash) => {
    await database.query(`DELETE FROM empire_admin_login_failures WHERE username_hash=$1 OR combination_hash=$2`,
      [usernameHash, combinationHash]);
  }
});

const mapSession = (row: SessionRow): AdminStoredSession => ({
  adminSessionId: row.admin_session_id,
  tokenHash: row.token_hash,
  adminUserId: row.admin_user_id,
  actorId: row.actor_id,
  username: row.username,
  displayName: row.display_name,
  role: row.role,
  authenticationMethod: row.authentication_method,
  createdAt: iso(row.created_at),
  expiresAt: iso(row.expires_at),
  revokedAt: row.revoked_at ? iso(row.revoked_at) : null,
  lastSeenAt: iso(row.last_seen_at),
  passwordVersion: row.password_version
});
const mapUser = (row: AdminUserRow): AdminUserRecord => ({
  adminUserId: row.admin_user_id, username: row.username, normalizedUsername: row.normalized_username,
  passwordHash: row.password_hash, passwordSalt: row.password_salt, passwordAlgorithm: row.password_algorithm,
  passwordParameters: row.password_parameters, passwordVersion: row.password_version, role: row.role,
  status: row.status, displayName: row.display_name, createdAt: iso(row.created_at), updatedAt: iso(row.updated_at),
  lastLoginAt: row.last_login_at ? iso(row.last_login_at) : null, passwordChangedAt: iso(row.password_changed_at),
  version: Number(row.version)
});
const USER_COLUMNS = `admin_user_id, username, normalized_username, password_hash, password_salt,
  password_algorithm, password_parameters, password_version, role, status, display_name, created_at,
  updated_at, last_login_at, password_changed_at, version`;
const USER_SELECT = `SELECT ${USER_COLUMNS} FROM empire_admin_users`;
const SESSION_COLUMNS = `admin_session_id, token_hash, admin_user_id, actor_id, username, display_name,
  role, authentication_method, password_version, created_at, expires_at, revoked_at, last_seen_at`;
const iso = (value: Date | string): string => value instanceof Date ? value.toISOString() : new Date(value).toISOString();
const cap = (value: number): number => Math.max(1, Math.min(500, Math.floor(value)));

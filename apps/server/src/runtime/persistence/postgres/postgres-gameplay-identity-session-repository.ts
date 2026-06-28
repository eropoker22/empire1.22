import * as crypto from "node:crypto";
import type {
  GameplayIdentitySessionRepository,
  GameplaySessionRecord,
  JoinTicketRecord,
  PlayerRegistrationRecord
} from "../../../auth";
import type { PostgresDatabase, PostgresQueryable } from "./postgres-client";
import { ensurePostgresServerInstanceRow } from "./postgres-server-instance-row";

interface PlayerRegistrationRow {
  [key: string]: unknown;
  id: string;
  account_id: string;
  server_instance_id: string;
  player_id: string;
  status: "active" | "revoked";
  created_at: Date | string;
  version: string | number;
}

interface JoinTicketRow {
  [key: string]: unknown;
  ticket_id: string;
  account_id: string;
  server_instance_id: string;
  mode: "free" | "war";
  faction_id: string | null;
  issued_at: Date | string;
  expires_at: Date | string;
  consumed_at: Date | string | null;
  nonce: string;
}

interface GameplaySessionRow {
  [key: string]: unknown;
  session_id: string;
  registration_id: string;
  account_id: string;
  player_id: string;
  server_instance_id: string;
  created_at: Date | string;
  expires_at: Date | string;
  last_seen_at: Date | string;
  revoked_at: Date | string | null;
  version: string | number;
}

export const createPostgresGameplayIdentitySessionRepository = (
  database: PostgresDatabase
): GameplayIdentitySessionRepository => ({
  createJoinTicket: async (ticket) => {
    await ensurePostgresServerInstanceRow(database, ticket.serverInstanceId, {
      mode: ticket.mode,
      status: "lobby"
    });
    const result = await database.query<JoinTicketRow>(
      `INSERT INTO empire_join_tickets (
        id,
        ticket_id,
        account_id,
        server_instance_id,
        mode,
        faction_id,
        nonce,
        issued_at,
        expires_at,
        consumed_at,
        payload
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::timestamptz, $9::timestamptz, $10::timestamptz, '{}'::jsonb)
      ON CONFLICT (ticket_id) DO UPDATE SET
        updated_at = now()
      RETURNING ticket_id, account_id, server_instance_id, mode, faction_id, issued_at, expires_at, consumed_at, nonce`,
      [
        `join-ticket:${ticket.ticketId}`,
        ticket.ticketId,
        ticket.accountId,
        ticket.serverInstanceId,
        ticket.mode,
        ticket.factionId ?? null,
        ticket.nonce,
        ticket.issuedAt,
        ticket.expiresAt,
        ticket.consumedAt
      ]
    );
    return mapJoinTicketRow(result.rows[0]!);
  },
  consumeJoinTicket: async (input) => database.transaction(async (client) => {
    const result = await client.query<JoinTicketRow>(
      `UPDATE empire_join_tickets
      SET consumed_at = $4::timestamptz,
          status = 'consumed',
          updated_at = now()
      WHERE ticket_id = $1
        AND account_id = $2
        AND server_instance_id = $3
        AND consumed_at IS NULL
        AND expires_at > $4::timestamptz
      RETURNING ticket_id, account_id, server_instance_id, mode, faction_id, issued_at, expires_at, consumed_at, nonce`,
      [input.ticketId, input.accountId, input.serverInstanceId, input.consumedAt]
    );
    if (!result.rows[0]) {
      return null;
    }
    const ticket = mapJoinTicketRow(result.rows[0]);
    const registration = await getOrCreateRegistration(client, {
      accountId: input.accountId,
      serverInstanceId: input.serverInstanceId,
      nowIso: input.consumedAt
    });
    return { ticket, registration };
  }),
  getOrCreateRegistration: async (input) => (
    database.transaction((client) => getOrCreateRegistration(client, input))
  ),
  createSession: async (session) => {
    const result = await database.query<GameplaySessionRow>(
      `INSERT INTO empire_gameplay_sessions (
        id,
        session_id,
        registration_id,
        token_hash,
        account_id,
        player_id,
        server_instance_id,
        version,
        created_at,
        expires_at,
        last_seen_at,
        revoked_at,
        payload
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::timestamptz, $10::timestamptz, $11::timestamptz, $12::timestamptz, '{}'::jsonb)
      ON CONFLICT (session_id) DO UPDATE SET
        updated_at = now()
      RETURNING session_id, registration_id, account_id, player_id, server_instance_id, created_at, expires_at, last_seen_at, revoked_at, version`,
      [
        `gameplay-session:${session.sessionId}`,
        session.sessionId,
        session.registrationId,
        hashToken(session.sessionId),
        session.accountId,
        session.playerId,
        session.serverInstanceId,
        session.version,
        session.createdAt,
        session.expiresAt,
        session.lastSeenAt,
        session.revokedAt
      ]
    );
    return mapGameplaySessionRow(result.rows[0]!);
  },
  getSessionById: async (sessionId) => {
    const result = await database.query<GameplaySessionRow>(
      `SELECT session_id, registration_id, account_id, player_id, server_instance_id, created_at, expires_at, last_seen_at, revoked_at, version
      FROM empire_gameplay_sessions
      WHERE session_id = $1`,
      [sessionId]
    );
    return result.rows[0] ? mapGameplaySessionRow(result.rows[0]) : null;
  },
  touchSession: async (sessionId, lastSeenAt) => {
    const result = await database.query<GameplaySessionRow>(
      `UPDATE empire_gameplay_sessions
      SET last_seen_at = $2::timestamptz,
          version = version + 1,
          updated_at = now()
      WHERE session_id = $1
        AND revoked_at IS NULL
        AND expires_at > $2::timestamptz
      RETURNING session_id, registration_id, account_id, player_id, server_instance_id, created_at, expires_at, last_seen_at, revoked_at, version`,
      [sessionId, lastSeenAt]
    );
    return result.rows[0] ? mapGameplaySessionRow(result.rows[0]) : null;
  },
  revokeSession: async (sessionId, revokedAt) => {
    const result = await database.query<GameplaySessionRow>(
      `UPDATE empire_gameplay_sessions
      SET revoked_at = $2::timestamptz,
          version = version + 1,
          updated_at = now()
      WHERE session_id = $1
        AND revoked_at IS NULL
      RETURNING session_id`,
      [sessionId, revokedAt]
    );
    return (result.rowCount ?? 0) > 0;
  },
  revokePlayerSessions: async (playerId, revokedAt) => {
    const result = await database.query<GameplaySessionRow>(
      `UPDATE empire_gameplay_sessions
      SET revoked_at = $2::timestamptz,
          version = version + 1,
          updated_at = now()
      WHERE player_id = $1
        AND revoked_at IS NULL
      RETURNING session_id`,
      [playerId, revokedAt]
    );
    return result.rowCount ?? 0;
  },
  listRegistrations: async () => {
    const result = await database.query<PlayerRegistrationRow>(
      `SELECT id, account_id, server_instance_id, player_id, status, created_at, version
      FROM empire_player_registrations
      ORDER BY created_at ASC`
    );
    return result.rows.map(mapPlayerRegistrationRow);
  }
});

const getOrCreateRegistration = async (
  client: PostgresQueryable,
  input: { accountId: string; serverInstanceId: string; nowIso: string }
): Promise<PlayerRegistrationRecord> => {
  await ensurePostgresServerInstanceRow(client, input.serverInstanceId, {
    mode: "free",
    status: "lobby"
  });
  const playerId = createServerPlayerId(input.serverInstanceId, input.accountId);
  const result = await client.query<PlayerRegistrationRow>(
    `INSERT INTO empire_player_registrations (
      id,
      server_instance_id,
      player_id,
      account_id,
      session_id,
      payload,
      status,
      version,
      created_at
    ) VALUES ($1, $2, $3, $4, NULL, '{}'::jsonb, 'active', 1, $5::timestamptz)
    ON CONFLICT (server_instance_id, account_id) DO UPDATE SET
      updated_at = now()
    RETURNING id, account_id, server_instance_id, player_id, status, created_at, version`,
    [
      `registration:${randomToken()}`,
      input.serverInstanceId,
      playerId,
      input.accountId,
      input.nowIso
    ]
  );
  return mapPlayerRegistrationRow(result.rows[0]!);
};

const mapPlayerRegistrationRow = (row: PlayerRegistrationRow): PlayerRegistrationRecord => ({
  id: row.id,
  accountId: row.account_id,
  serverInstanceId: row.server_instance_id,
  playerId: row.player_id,
  status: row.status,
  createdAt: toIso(row.created_at),
  version: Number(row.version)
});

const mapJoinTicketRow = (row: JoinTicketRow): JoinTicketRecord => ({
  ticketId: row.ticket_id,
  accountId: row.account_id,
  serverInstanceId: row.server_instance_id,
  mode: row.mode,
  factionId: row.faction_id,
  issuedAt: toIso(row.issued_at),
  expiresAt: toIso(row.expires_at),
  consumedAt: row.consumed_at ? toIso(row.consumed_at) : null,
  nonce: row.nonce
});

const mapGameplaySessionRow = (row: GameplaySessionRow): GameplaySessionRecord => ({
  sessionId: row.session_id,
  registrationId: row.registration_id,
  accountId: row.account_id,
  playerId: row.player_id,
  serverInstanceId: row.server_instance_id,
  createdAt: toIso(row.created_at),
  expiresAt: toIso(row.expires_at),
  lastSeenAt: toIso(row.last_seen_at),
  revokedAt: row.revoked_at ? toIso(row.revoked_at) : null,
  version: Number(row.version)
});

const createServerPlayerId = (serverInstanceId: string, accountId: string): string =>
  `player:${crypto.createHash("sha256").update(`${serverInstanceId}:${accountId}`).digest("hex").slice(0, 24)}`;

const hashToken = (value: string): string =>
  crypto.createHash("sha256").update(value).digest("hex");

const randomToken = (): string =>
  toBase64Url((crypto as unknown as { randomFillSync(target: Uint8Array): Uint8Array }).randomFillSync(new Uint8Array(32)));

const toIso = (value: Date | string): string =>
  value instanceof Date ? value.toISOString() : new Date(value).toISOString();

const toBase64Url = (bytes: Uint8Array): string => {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  let output = "";
  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index] ?? 0;
    const second = bytes[index + 1] ?? 0;
    const third = bytes[index + 2] ?? 0;
    const triplet = (first << 16) | (second << 8) | third;
    output += alphabet[(triplet >> 18) & 63];
    output += alphabet[(triplet >> 12) & 63];
    if (index + 1 < bytes.length) output += alphabet[(triplet >> 6) & 63];
    if (index + 2 < bytes.length) output += alphabet[triplet & 63];
  }
  return output;
};

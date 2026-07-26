import * as crypto from "node:crypto";
import type {
  JoinTicketRecord,
  PlayerRegistrationRecord
} from "../../../auth";
import { createServerPlayerId } from "../../../player-entry/player-entry-policy";
import type { PostgresQueryable } from "./postgres-client";
import { ensurePostgresServerInstanceRow } from "./postgres-server-instance-row";

export interface PlayerRegistrationRow {
  [key: string]: unknown;
  id: string;
  account_id: string;
  server_instance_id: string;
  player_id: string;
  status: "active" | "revoked";
  created_at: Date | string;
  version: string | number;
}

export interface JoinTicketRow {
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

export const savePostgresJoinTicket = async (
  database: PostgresQueryable,
  ticket: JoinTicketRecord
): Promise<JoinTicketRecord> => {
  await ensurePostgresServerInstanceRow(database, ticket.serverInstanceId, {
    mode: ticket.mode,
    status: "lobby"
  });
  const result = await database.query<JoinTicketRow>(
    `INSERT INTO empire_join_tickets (
      id,ticket_id,account_id,server_instance_id,mode,faction_id,nonce,
      issued_at,expires_at,consumed_at,payload
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::timestamptz,$9::timestamptz,$10::timestamptz,'{}'::jsonb)
    ON CONFLICT (ticket_id) DO UPDATE SET updated_at=now()
    RETURNING ticket_id,account_id,server_instance_id,mode,faction_id,issued_at,expires_at,consumed_at,nonce`,
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
};

export const getOrCreatePostgresGameplayRegistration = async (
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
      id,server_instance_id,player_id,account_id,session_id,payload,status,version,created_at
    ) VALUES ($1,$2,$3,$4,NULL,'{}'::jsonb,'active',1,$5::timestamptz)
    ON CONFLICT (server_instance_id,account_id) DO UPDATE SET updated_at=now()
    RETURNING id,account_id,server_instance_id,player_id,status,created_at,version`,
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

export const mapPlayerRegistrationRow = (
  row: PlayerRegistrationRow
): PlayerRegistrationRecord => ({
  id: row.id,
  accountId: row.account_id,
  serverInstanceId: row.server_instance_id,
  playerId: row.player_id,
  status: row.status,
  createdAt: toIso(row.created_at),
  version: Number(row.version)
});

export const mapJoinTicketRow = (row: JoinTicketRow): JoinTicketRecord => ({
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

const randomToken = (): string =>
  toBase64Url((crypto as unknown as {
    randomFillSync(target: Uint8Array): Uint8Array;
  }).randomFillSync(new Uint8Array(32)));

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

import type { JoinTicketRecord } from "../auth";
import type { PostgresDatabase } from "../runtime/persistence/postgres";
import { savePostgresJoinTicket } from "../runtime/persistence/postgres/postgres-gameplay-identity-writes";
import { entryError } from "./player-entry-error";

interface ActiveMembershipTicketRow extends Record<string, unknown> {
  membership_id: string;
  account_id: string;
  server_instance_id: string;
  mode: "free" | "war";
  faction_id: string | null;
  status: string;
}

export const rotatePostgresMembershipJoinTicket = async (
  database: PostgresDatabase,
  input: {
    accountId: string;
    membershipId: string;
    ticket: JoinTicketRecord;
  }
): Promise<JoinTicketRecord> => database.transaction(async (client) => {
  const membership = await client.query<ActiveMembershipTicketRow>(
    `SELECT membership.membership_id,membership.account_id,membership.server_instance_id,
      membership.faction_id,membership.status,server.mode
     FROM empire_server_memberships membership
     JOIN empire_hosted_server_instances server
       ON server.server_instance_id=membership.server_instance_id
     WHERE membership.membership_id=$1
     FOR UPDATE OF membership`,
    [input.membershipId]
  );
  const row = membership.rows[0];
  if (!row || row.account_id !== input.accountId) {
    throw entryError("MEMBERSHIP_NOT_FOUND", "Membership nebyl nalezen.");
  }
  if (row.status !== "active" || !row.faction_id) {
    throw entryError("MEMBERSHIP_NOT_ACTIVE", "Aktivní serverová identita zatím není připravená.");
  }
  if (input.ticket.accountId !== row.account_id
    || input.ticket.serverInstanceId !== row.server_instance_id
    || input.ticket.mode !== row.mode
    || input.ticket.factionId !== row.faction_id) {
    throw new Error("Replacement join ticket does not match the active membership.");
  }

  const saved = await savePostgresJoinTicket(client, input.ticket);
  if (saved.accountId !== input.ticket.accountId
    || saved.serverInstanceId !== input.ticket.serverInstanceId
    || saved.mode !== input.ticket.mode
    || saved.factionId !== input.ticket.factionId
    || saved.nonce !== input.ticket.nonce
    || saved.consumedAt !== null
    || Date.parse(saved.expiresAt) <= Date.parse(saved.issuedAt)) {
    throw new Error("Replacement join ticket conflicts with an unusable persisted ticket.");
  }

  const updated = await client.query(
    `UPDATE empire_server_memberships
     SET join_ticket_id=$2,updated_at=clock_timestamp(),version=version+1
     WHERE membership_id=$1 AND account_id=$3 AND status='active'
     RETURNING membership_id`,
    [input.membershipId, saved.ticketId, input.accountId]
  );
  if ((updated.rowCount ?? 0) !== 1) {
    throw entryError("MEMBERSHIP_NOT_ACTIVE", "Aktivní serverová identita zatím není připravená.");
  }
  return saved;
});

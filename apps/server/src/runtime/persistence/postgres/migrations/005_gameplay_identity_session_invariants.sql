-- Production identity/session invariants.
-- A gameplay player registration is always bound to a server-verified account.
-- Join tickets are scoped to a server instance even though ticket ids remain globally unique.

ALTER TABLE empire_player_registrations
  ALTER COLUMN account_id SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS empire_player_registrations_instance_account_strict_unique
  ON empire_player_registrations (server_instance_id, account_id);

CREATE UNIQUE INDEX IF NOT EXISTS empire_join_tickets_instance_ticket_unique
  ON empire_join_tickets (server_instance_id, ticket_id);

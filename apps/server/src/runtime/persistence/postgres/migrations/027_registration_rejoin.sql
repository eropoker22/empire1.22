-- Keep previous attempts for audit and idempotent retries. Identity remains account/server scoped.
ALTER TABLE empire_server_memberships
  DROP CONSTRAINT empire_server_memberships_server_instance_id_account_id_key,
  DROP CONSTRAINT empire_server_memberships_server_instance_id_player_id_key;

CREATE UNIQUE INDEX empire_server_memberships_current_account_idx
  ON empire_server_memberships (server_instance_id,account_id) WHERE status <> 'left_early';
CREATE UNIQUE INDEX empire_server_memberships_current_player_idx
  ON empire_server_memberships (server_instance_id,player_id) WHERE status <> 'left_early';

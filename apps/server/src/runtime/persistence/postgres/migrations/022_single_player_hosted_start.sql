ALTER TABLE empire_hosted_server_instances
  DROP CONSTRAINT IF EXISTS empire_hosted_registration_minimum_players_check;

UPDATE empire_hosted_server_instances
SET minimum_ready_players_to_start = 1,
    updated_at = GREATEST(updated_at, clock_timestamp())
WHERE minimum_ready_players_to_start <> 1;

ALTER TABLE empire_hosted_server_instances
  ADD CONSTRAINT empire_hosted_registration_minimum_players_check
    CHECK (minimum_ready_players_to_start >= 1);

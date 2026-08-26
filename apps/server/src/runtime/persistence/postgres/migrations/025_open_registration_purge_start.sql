-- Starting a hosted server arms Očista immediately while registration may
-- remain open. The original freeze-pair constraint predated that lifecycle and
-- incorrectly required the armed elimination tick to stay NULL until the
-- registration roster was frozen.
ALTER TABLE empire_hosted_server_instances
  DROP CONSTRAINT IF EXISTS empire_hosted_registration_freeze_pair_check;

ALTER TABLE empire_hosted_server_instances
  ADD CONSTRAINT empire_hosted_registration_freeze_pair_check
    CHECK (
      (
        registration_closed_at IS NULL
        AND registration_baseline_players IS NULL
        AND effective_final_lockdown_trigger IS NULL
        AND (
          effective_first_elimination_tick IS NULL
          OR effective_first_elimination_tick >= 1
        )
      )
      OR (
        registration_closed_at IS NOT NULL
        AND registration_baseline_players IS NOT NULL
        AND effective_final_lockdown_trigger IS NOT NULL
        AND (effective_first_elimination_tick IS NULL OR effective_first_elimination_tick >= 0)
      )
    );

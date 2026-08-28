-- Flexible hosted servers now arm the canonical Očista timing on Start. New
-- rows therefore persist the canonical tick pair, while legacy control rows
-- may still contain the historical NULL/NULL pair and are repaired at runtime.
ALTER TABLE empire_hosted_server_instances
  DROP CONSTRAINT IF EXISTS empire_hosted_registration_canonical_elimination_check;

ALTER TABLE empire_hosted_server_instances
  ADD CONSTRAINT empire_hosted_registration_canonical_elimination_check
    CHECK (
      (
        mode <> 'free'
        OR (
          server_template = 'full'
          AND canonical_first_elimination_tick IS NOT NULL
          AND canonical_tick_rate_ms IS NOT NULL
        )
        OR (
          server_template = 'control'
          AND (
            (
              canonical_first_elimination_tick IS NULL
              AND canonical_tick_rate_ms IS NULL
            )
            OR (
              canonical_first_elimination_tick IS NOT NULL
              AND canonical_tick_rate_ms IS NOT NULL
            )
          )
        )
      )
      AND (
        canonical_first_elimination_tick IS NULL
        OR canonical_first_elimination_tick >= 1
      )
      AND (
        canonical_tick_rate_ms IS NULL
        OR canonical_tick_rate_ms >= 1
      )
    );

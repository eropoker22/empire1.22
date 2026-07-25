UPDATE empire_hosted_server_instances
SET canonical_first_elimination_tick = 2880,
    canonical_tick_rate_ms = 10000,
    effective_first_elimination_tick = CASE
      WHEN effective_first_elimination_tick IS NULL THEN NULL
      ELSE CEIL(effective_first_elimination_tick * 5000.0 / 10000.0)::integer
    END,
    updated_at = now(),
    version = version + 1
WHERE mode = 'free'
  AND server_template = 'full'
  AND status IN ('requested', 'provisioning', 'lobby')
  AND canonical_first_elimination_tick = 5760
  AND canonical_tick_rate_ms = 5000;

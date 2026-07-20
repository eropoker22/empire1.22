ALTER TABLE empire_hosted_server_instances
  ADD COLUMN IF NOT EXISTS runtime_lease_incarnation_id text;

ALTER TABLE empire_hosted_worker_heartbeats
  ADD COLUMN IF NOT EXISTS worker_incarnation_id text;

ALTER TABLE empire_hosted_server_provisioning_jobs
  ADD COLUMN IF NOT EXISTS claimed_by_worker_incarnation_id text;

UPDATE empire_hosted_server_instances
SET runtime_lease_incarnation_id = 'legacy:' || runtime_lease_owner_id
WHERE runtime_lease_owner_id IS NOT NULL
  AND runtime_lease_incarnation_id IS NULL;

UPDATE empire_hosted_worker_heartbeats
SET worker_incarnation_id = 'legacy:' || worker_id
WHERE worker_incarnation_id IS NULL;

UPDATE empire_hosted_server_provisioning_jobs
SET claimed_by_worker_incarnation_id = 'legacy:' || claimed_by_worker_id
WHERE claimed_by_worker_id IS NOT NULL
  AND claimed_by_worker_incarnation_id IS NULL;

ALTER TABLE empire_hosted_worker_heartbeats
  ALTER COLUMN worker_incarnation_id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'empire_hosted_running_lease_incarnation_check'
  ) THEN
    ALTER TABLE empire_hosted_server_instances
      ADD CONSTRAINT empire_hosted_running_lease_incarnation_check
      CHECK (status <> 'running' OR runtime_lease_incarnation_id IS NOT NULL);
  END IF;
END $$;

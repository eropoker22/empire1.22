ALTER TABLE empire_hosted_join_jobs
  ADD COLUMN IF NOT EXISTS claimed_by_worker_incarnation_id text;

ALTER TABLE empire_server_membership_jobs
  ADD COLUMN IF NOT EXISTS claimed_by_worker_incarnation_id text;

UPDATE empire_hosted_join_jobs
SET claimed_by_worker_incarnation_id = worker.worker_incarnation_id
FROM empire_hosted_worker_heartbeats worker
WHERE empire_hosted_join_jobs.claimed_by_worker_id = worker.worker_id
  AND empire_hosted_join_jobs.status = 'claimed'
  AND empire_hosted_join_jobs.claimed_by_worker_incarnation_id IS NULL;

UPDATE empire_hosted_join_jobs
SET claimed_by_worker_incarnation_id = 'legacy:' || claimed_by_worker_id
WHERE claimed_by_worker_id IS NOT NULL
  AND claimed_by_worker_incarnation_id IS NULL;

UPDATE empire_server_membership_jobs
SET claimed_by_worker_incarnation_id = worker.worker_incarnation_id
FROM empire_hosted_worker_heartbeats worker
WHERE empire_server_membership_jobs.claimed_by_worker_id = worker.worker_id
  AND empire_server_membership_jobs.status = 'claimed'
  AND empire_server_membership_jobs.claimed_by_worker_incarnation_id IS NULL;

UPDATE empire_server_membership_jobs
SET claimed_by_worker_incarnation_id = 'legacy:' || claimed_by_worker_id
WHERE claimed_by_worker_id IS NOT NULL
  AND claimed_by_worker_incarnation_id IS NULL;

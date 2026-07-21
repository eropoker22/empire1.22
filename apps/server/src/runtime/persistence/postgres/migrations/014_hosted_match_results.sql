ALTER TABLE empire_server_memberships
  ADD COLUMN IF NOT EXISTS final_rank integer CHECK (final_rank IS NULL OR final_rank > 0),
  ADD COLUMN IF NOT EXISTS final_score double precision CHECK (final_score IS NULL OR final_score >= 0),
  ADD COLUMN IF NOT EXISTS final_score_breakdown jsonb;

CREATE TABLE IF NOT EXISTS empire_hosted_match_results (
  id text PRIMARY KEY,
  match_result_id text NOT NULL UNIQUE,
  server_instance_id text NOT NULL UNIQUE REFERENCES empire_hosted_server_instances (server_instance_id),
  completed_at timestamptz NOT NULL,
  winner_player_id text,
  winner_alliance_id text,
  completion_reason text NOT NULL,
  result_payload jsonb NOT NULL CHECK (jsonb_typeof(result_payload) = 'object'),
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0)
);

CREATE INDEX IF NOT EXISTS empire_hosted_match_results_completed_idx
  ON empire_hosted_match_results (completed_at DESC);

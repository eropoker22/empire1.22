CREATE TABLE IF NOT EXISTS empire_auth_throttle_buckets (
  action_type text NOT NULL CHECK (action_type IN ('register', 'login')),
  dimension text NOT NULL CHECK (dimension IN ('network', 'username')),
  bucket_key_hash text NOT NULL CHECK (length(bucket_key_hash) = 64),
  window_started_at timestamptz NOT NULL,
  attempt_count integer NOT NULL CHECK (attempt_count >= 0),
  blocked_until timestamptz,
  expires_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  PRIMARY KEY (action_type, dimension, bucket_key_hash),
  CHECK (expires_at > window_started_at),
  CHECK (blocked_until IS NULL OR blocked_until > window_started_at)
);

CREATE INDEX IF NOT EXISTS empire_auth_throttle_buckets_cleanup_idx
  ON empire_auth_throttle_buckets (expires_at);

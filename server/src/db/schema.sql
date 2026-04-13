CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Core players
CREATE TABLE IF NOT EXISTS players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  gang_name TEXT NOT NULL,
  gang_structure TEXT NULL,
  gang_color TEXT NULL,
  money BIGINT NOT NULL DEFAULT 0,
  clean_money BIGINT NOT NULL DEFAULT 0,
  dirty_money BIGINT NOT NULL DEFAULT 0,
  influence_points INT NOT NULL DEFAULT 0,
  heat INT NOT NULL DEFAULT 0,
  drugs INT NOT NULL DEFAULT 0,
  drug_neon_dust INT NOT NULL DEFAULT 0,
  drug_pulse_shot INT NOT NULL DEFAULT 0,
  drug_velvet_smoke INT NOT NULL DEFAULT 0,
  drug_ghost_serum INT NOT NULL DEFAULT 0,
  drug_overdrive_x INT NOT NULL DEFAULT 0,
  drug_neon_dust_active_until TIMESTAMP NULL,
  drug_pulse_shot_active_until TIMESTAMP NULL,
  drug_velvet_smoke_active_until TIMESTAMP NULL,
  drug_ghost_serum_active_until TIMESTAMP NULL,
  drug_overdrive_x_active_until TIMESTAMP NULL,
  drug_neon_dust_active_dose INT NOT NULL DEFAULT 0,
  drug_pulse_shot_active_dose INT NOT NULL DEFAULT 0,
  drug_velvet_smoke_active_dose INT NOT NULL DEFAULT 0,
  drug_ghost_serum_active_dose INT NOT NULL DEFAULT 0,
  drug_overdrive_x_active_dose INT NOT NULL DEFAULT 0,
  weapons INT NOT NULL DEFAULT 0,
  defense INT NOT NULL DEFAULT 0,
  materials INT NOT NULL DEFAULT 0,
  data_shards INT NOT NULL DEFAULT 0,
  raid_member_losses INT NOT NULL DEFAULT 0,
  alliance_id UUID NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Alliances
CREATE TABLE IF NOT EXISTS alliances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  owner_player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  description TEXT NOT NULL DEFAULT '',
  icon_key TEXT NOT NULL DEFAULT 'crown_skull',
  bonus_income_pct INT NOT NULL DEFAULT 0,
  bonus_influence_pct INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

ALTER TABLE players
  ADD CONSTRAINT players_alliance_fk
  FOREIGN KEY (alliance_id) REFERENCES alliances(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS alliance_join_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alliance_id UUID NOT NULL REFERENCES alliances(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (alliance_id, player_id)
);

CREATE TABLE IF NOT EXISTS alliance_member_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alliance_id UUID NOT NULL REFERENCES alliances(id) ON DELETE CASCADE,
  target_player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  inviter_player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (alliance_id, target_player_id)
);

CREATE TABLE IF NOT EXISTS alliance_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  read_at TIMESTAMP NULL
);

ALTER TABLE players
  ADD COLUMN IF NOT EXISTS alliance_ready_at TIMESTAMP NULL;

CREATE TABLE IF NOT EXISTS alliance_kick_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alliance_id UUID NOT NULL REFERENCES alliances(id) ON DELETE CASCADE,
  target_player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  started_by_player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMP NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_alliance_kick_votes_open_unique
  ON alliance_kick_votes (alliance_id, target_player_id)
  WHERE status = 'open';

CREATE TABLE IF NOT EXISTS alliance_kick_vote_ballots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vote_id UUID NOT NULL REFERENCES alliance_kick_votes(id) ON DELETE CASCADE,
  voter_player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (vote_id, voter_player_id)
);

CREATE TABLE IF NOT EXISTS alliance_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alliance_id UUID NOT NULL REFERENCES alliances(id) ON DELETE CASCADE,
  actor_player_id UUID NULL REFERENCES players(id) ON DELETE SET NULL,
  target_player_id UUID NULL REFERENCES players(id) ON DELETE SET NULL,
  action_key TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Districts (static map)
CREATE TABLE IF NOT EXISTS districts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  polygon JSONB NOT NULL,
  base_income INT NOT NULL DEFAULT 10,
  owner_player_id UUID NULL REFERENCES players(id) ON DELETE SET NULL,
  influence_level INT NOT NULL DEFAULT 0,
  is_destroyed BOOLEAN NOT NULL DEFAULT FALSE,
  destroyed_at TIMESTAMP NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_districts_owner ON districts(owner_player_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_players_gang_color_unique
  ON players (gang_color)
  WHERE gang_color IS NOT NULL;

-- Combat logs
CREATE TABLE IF NOT EXISTS combat_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attacker_player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  district_id UUID NOT NULL REFERENCES districts(id) ON DELETE CASCADE,
  defender_player_id UUID NULL REFERENCES players(id) ON DELETE SET NULL,
  success BOOLEAN NOT NULL,
  attack_cost INT NOT NULL,
  influence_change INT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Cooldowns
CREATE TABLE IF NOT EXISTS cooldowns (
  player_id UUID PRIMARY KEY REFERENCES players(id) ON DELETE CASCADE,
  next_attack_at TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS attack_target_cooldowns (
  attacker_player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  target_player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  next_attack_at TIMESTAMP NOT NULL,
  PRIMARY KEY (attacker_player_id, target_player_id)
);

-- Round metadata
CREATE TABLE IF NOT EXISTS rounds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at TIMESTAMP NOT NULL,
  ends_at TIMESTAMP NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_rounds_active ON rounds(active);

-- Player upgrades
CREATE TABLE IF NOT EXISTS upgrades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  upgrade_key TEXT NOT NULL,
  level INT NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (player_id, upgrade_key)
);

-- Economy ledger (optional, for auditing)
CREATE TABLE IF NOT EXISTS economy_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  delta BIGINT NOT NULL,
  reason TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS market_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  resource_key TEXT NOT NULL,
  side TEXT NOT NULL CHECK (side IN ('buy', 'sell')),
  quantity INT NOT NULL CHECK (quantity > 0),
  remaining_quantity INT NOT NULL CHECK (remaining_quantity >= 0),
  price_per_unit INT NOT NULL CHECK (price_per_unit > 0),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'filled', 'cancelled')),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_market_orders_book
  ON market_orders (resource_key, side, status, price_per_unit, created_at);

CREATE TABLE IF NOT EXISTS market_trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buy_order_id UUID NULL REFERENCES market_orders(id) ON DELETE SET NULL,
  sell_order_id UUID NULL REFERENCES market_orders(id) ON DELETE SET NULL,
  buyer_player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  seller_player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  resource_key TEXT NOT NULL,
  quantity INT NOT NULL CHECK (quantity > 0),
  price_per_unit INT NOT NULL CHECK (price_per_unit > 0),
  fee_paid INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_market_trades_resource_created
  ON market_trades (resource_key, created_at DESC);

CREATE TABLE IF NOT EXISTS bounties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by_player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  target_player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  target_district_id UUID NULL REFERENCES districts(id) ON DELETE SET NULL,
  objective_type TEXT NOT NULL DEFAULT 'capture_district',
  is_anonymous BOOLEAN NOT NULL DEFAULT TRUE,
  expires_at TIMESTAMP NULL,
  rewards JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'active',
  claimed_by_player_id UUID NULL REFERENCES players(id) ON DELETE SET NULL,
  claimed_at TIMESTAMP NULL,
  contributors JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_value INT NOT NULL DEFAULT 0,
  hunt_mode_active BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bounties_target_active
  ON bounties (target_player_id, status, created_at DESC);

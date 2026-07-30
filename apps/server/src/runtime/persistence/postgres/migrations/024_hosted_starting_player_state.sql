ALTER TABLE empire_hosted_server_instances
  ADD COLUMN IF NOT EXISTS starting_player_state jsonb NOT NULL DEFAULT '{
    "cleanCash": 1500,
    "dirtyCash": 300,
    "population": 0,
    "spySlots": 2,
    "materials": {
      "chemicals": 10,
      "biomass": 6,
      "stim-pack": 0,
      "neon-dust": 0,
      "pulse-shot": 0,
      "velvet-smoke": 0,
      "ghost-serum": 0,
      "overdrive-x": 0,
      "metal-parts": 8,
      "tech-core": 2,
      "combat-module": 0,
      "baseball-bat": 0,
      "pistol": 2,
      "grenade": 0,
      "smg": 1,
      "bazooka": 0,
      "vest": 0,
      "barricades": 0,
      "cameras": 0,
      "defense-tower": 0,
      "alarm": 0
    }
  }'::jsonb;

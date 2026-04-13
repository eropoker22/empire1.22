const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { pool } = require("../config/db");
const { normalizeGameMode } = require("../config/gameModes");
const { ensureMarketSchema } = require("./marketService");
const { ensureMoneySchema } = require("./moneyService");
const { ensureDrugSchema } = require("./drugService");
const { ensureGangColorSchema } = require("./gangColorService");

async function ensurePlayerModeSchema() {
  await pool.query(`
    ALTER TABLE players
      ADD COLUMN IF NOT EXISTS game_mode TEXT NOT NULL DEFAULT 'war'
  `);
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_players_username_game_mode_unique
      ON players (username, game_mode)
  `);
}

async function registerPlayer({ username, password, gangName, gameMode = "war" }) {
  const mode = normalizeGameMode(gameMode);
  await ensureMarketSchema();
  await ensureMoneySchema();
  await ensureDrugSchema();
  await ensureGangColorSchema();
  await ensurePlayerModeSchema();
  const passwordHash = await bcrypt.hash(password, 12);

  const result = await pool.query(
    `INSERT INTO players (
       username, password_hash, gang_name,
       game_mode,
       money, clean_money, dirty_money,
       drugs, drug_neon_dust, drug_pulse_shot, drug_velvet_smoke, drug_ghost_serum, drug_overdrive_x,
       weapons, materials, data_shards
     )
     VALUES ($1, $2, $3, $4, 12000, 12000, 0, 80, 44, 14, 12, 7, 3, 30, 120, 18)
     RETURNING id, username, gang_name, gang_structure, gang_color`,
    [username, passwordHash, gangName, mode]
  );

  const player = result.rows[0];
  return createToken({ ...player, game_mode: mode });
}

async function loginPlayer({ username, password, gameMode = "war" }) {
  const mode = normalizeGameMode(gameMode);
  await ensureGangColorSchema();
  await ensurePlayerModeSchema();
  const result = await pool.query(
    "SELECT id, username, gang_name, gang_structure, gang_color, password_hash, game_mode FROM players WHERE username = $1 AND game_mode = $2",
    [username, mode]
  );

  if (result.rowCount === 0) {
    return null;
  }

  const player = result.rows[0];
  const ok = await bcrypt.compare(password, player.password_hash);
  if (!ok) return null;

  return createToken(player);
}

function createToken(player) {
  return jwt.sign(
    {
      id: player.id,
      username: player.username,
      gangName: player.gang_name,
      structure: player.gang_structure || null,
      gangColor: player.gang_color || null,
      gameMode: normalizeGameMode(player.game_mode || player.gameMode || "war")
    },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
}

module.exports = {
  registerPlayer,
  loginPlayer,
  createToken
};

const { pool } = require("../config/db");
const { getGameModeConfig, GAME_MODES, normalizeGameMode } = require("../config/gameModes");
const { ensureMoneySchema } = require("../services/moneyService");
const { ensureDrugSchema } = require("../services/drugService");
const { ensureDistrictDestructionSchema } = require("../services/districtService");

async function runRoundTick(gameMode = "war") {
  const mode = normalizeGameMode(gameMode);
  const modeConfig = getGameModeConfig(mode);
  await ensureMoneySchema();
  await ensureDrugSchema();
  await ensureDistrictDestructionSchema();
  await pool.query(`
    ALTER TABLE rounds
      ADD COLUMN IF NOT EXISTS game_mode TEXT NOT NULL DEFAULT 'war'
  `);
  const activeRes = await pool.query(
    "SELECT * FROM rounds WHERE active = true AND game_mode = $1 ORDER BY started_at DESC LIMIT 1",
    [mode]
  );
  if (activeRes.rowCount === 0) return;

  const round = activeRes.rows[0];
  if (normalizeGameMode(round.game_mode || "war") !== mode) return;
  const now = new Date();
  if (new Date(round.ends_at) > now) return;

  await pool.query("BEGIN");
  try {
    await pool.query("UPDATE rounds SET active = false WHERE id = $1", [round.id]);

    const startedAt = new Date();
    const endsAt = new Date(startedAt.getTime() + modeConfig.roundDurationHours * 60 * 60 * 1000);
    await pool.query(
      "INSERT INTO rounds (started_at, ends_at, active, game_mode) VALUES ($1, $2, true, $3)",
      [startedAt, endsAt, mode]
    );

    await pool.query(
      "UPDATE districts SET owner_player_id = NULL, influence_level = 0, is_destroyed = false, destroyed_at = NULL WHERE game_mode = $1",
      [mode]
    );
    await pool.query(`
      UPDATE players
         SET money = 0,
             clean_money = 0,
             dirty_money = 0,
             influence_points = 0,
             heat = 0,
             drug_neon_dust_active_until = NULL,
             drug_pulse_shot_active_until = NULL,
             drug_velvet_smoke_active_until = NULL,
             drug_ghost_serum_active_until = NULL,
             drug_overdrive_x_active_until = NULL,
             drug_neon_dust_active_dose = 0,
             drug_pulse_shot_active_dose = 0,
             drug_velvet_smoke_active_dose = 0,
             drug_ghost_serum_active_dose = 0,
             drug_overdrive_x_active_dose = 0
       WHERE game_mode = $1
    `, [mode]);

    await pool.query("COMMIT");
  } catch (err) {
    await pool.query("ROLLBACK");
    throw err;
  }
}

module.exports = { runRoundTick };

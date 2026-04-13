const { pool } = require("../config/db");
const { normalizeGameMode } = require("../config/gameModes");
const { ensureMoneySchema, addDirtyMoney } = require("../services/moneyService");
const {
  ensureDrugSchema,
  getDrugRuntimeFromRow
} = require("../services/drugService");
const { ensureDistrictDestructionSchema } = require("../services/districtService");
const { HEAT_BALANCE } = require("../config/drugs");

async function runIncomeTick(gameMode = "war") {
  const mode = normalizeGameMode(gameMode);
  await ensureMoneySchema();
  await ensureDrugSchema();
  await ensureDistrictDestructionSchema();
  await pool.query(`
    ALTER TABLE players
      ADD COLUMN IF NOT EXISTS game_mode TEXT NOT NULL DEFAULT 'war'
  `);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const earnings = await client.query(
      `SELECT d.owner_player_id AS player_id,
              SUM(d.base_income) AS income,
              COALESCE(a.bonus_income_pct, 0) AS bonus_pct
       FROM districts d
       JOIN players p ON p.id = d.owner_player_id AND p.game_mode = d.game_mode
       LEFT JOIN alliances a ON a.id = p.alliance_id
      WHERE d.owner_player_id IS NOT NULL
        AND COALESCE(d.is_destroyed, false) = false
        AND d.game_mode = $1
      GROUP BY d.owner_player_id, a.bonus_income_pct`
      ,
      [mode]
    );

    for (const row of earnings.rows) {
      const income = Number(row.income);
      const bonusPct = Number(row.bonus_pct || 0);
      const playerRes = await client.query(
        `SELECT heat, drug_neon_dust, drug_pulse_shot, drug_velvet_smoke, drug_ghost_serum, drug_overdrive_x,
                drug_neon_dust_active_until, drug_pulse_shot_active_until, drug_velvet_smoke_active_until, drug_ghost_serum_active_until, drug_overdrive_x_active_until,
                drug_neon_dust_active_dose, drug_pulse_shot_active_dose, drug_velvet_smoke_active_dose, drug_ghost_serum_active_dose, drug_overdrive_x_active_dose
           FROM players
          WHERE id = $1
          FOR UPDATE`,
        [row.player_id]
      );
      if (playerRes.rowCount === 0) {
        continue;
      }

      const drugRuntime = getDrugRuntimeFromRow(playerRes.rows[0]);
      const basePayout = Math.floor(income * (1 + bonusPct / 100));
      const payout = Math.floor(
        basePayout
        * drugRuntime.modifiers.incomeMultiplier
        * drugRuntime.modifiers.dirtyIncomeMultiplier
      );
      await addDirtyMoney(client, row.player_id, payout);
      await client.query(
        "INSERT INTO economy_ledger (player_id, delta, reason) VALUES ($1, $2, $3)",
        [row.player_id, payout, "income_tick"]
      );

      const baseDecay = Math.max(0, Math.floor(Number(HEAT_BALANCE.baseHourlyHeatDecay || 0)));
      const heatGain = Number(drugRuntime.modifiers.hourlyHeatGain || 0);
      const netHeatDelta = Math.floor(heatGain - baseDecay);

      if (netHeatDelta !== 0) {
        await client.query(
          `UPDATE players
              SET heat = GREATEST(0, heat + $1),
                  updated_at = NOW()
            WHERE id = $2`,
          [netHeatDelta, row.player_id]
        );
      }
    }

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { runIncomeTick };

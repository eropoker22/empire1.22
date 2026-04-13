const { pool } = require("../config/db");
const { normalizeGameMode } = require("../config/gameModes");
const {
  ensureMoneySchema,
  addCleanMoney,
  addDirtyMoney
} = require("../services/moneyService");
const { ensureDistrictDestructionSchema } = require("../services/districtService");

const DISTRICT_MINUTE_INCOME_RULES = {
  commercial: {
    clean: 3,
    dirty: 1,
    cleanReason: "commercial_income_tick_clean",
    dirtyReason: "commercial_income_tick_dirty"
  },
  residential: {
    clean: 2,
    dirty: 0.5,
    cleanReason: "residential_income_tick_clean",
    dirtyReason: "residential_income_tick_dirty"
  },
  downtown: {
    clean: 5,
    dirty: 2,
    cleanReason: "downtown_income_tick_clean",
    dirtyReason: "downtown_income_tick_dirty"
  },
  park: {
    clean: 2,
    dirty: 1,
    cleanReason: "park_income_tick_clean",
    dirtyReason: "park_income_tick_dirty"
  },
  industrial: {
    clean: 3,
    dirty: 1,
    cleanReason: "industrial_income_tick_clean",
    dirtyReason: "industrial_income_tick_dirty"
  }
};

async function runParkIncomeTick(gameMode = "war") {
  const mode = normalizeGameMode(gameMode);
  await ensureMoneySchema();
  await ensureDistrictDestructionSchema();
  await pool.query(`
    ALTER TABLE players
      ADD COLUMN IF NOT EXISTS game_mode TEXT NOT NULL DEFAULT 'war'
  `);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const parkOwners = await client.query(
      `SELECT d.owner_player_id AS player_id,
              COUNT(*) FILTER (WHERE LOWER(COALESCE(d.type, '')) = 'commercial') AS commercial_count,
              COUNT(*) FILTER (WHERE LOWER(COALESCE(d.type, '')) = 'residential') AS residential_count,
              COUNT(*) FILTER (WHERE LOWER(COALESCE(d.type, '')) = 'downtown') AS downtown_count,
              COUNT(*) FILTER (WHERE LOWER(COALESCE(d.type, '')) = 'park') AS park_count,
              COUNT(*) FILTER (WHERE LOWER(COALESCE(d.type, '')) = 'industrial') AS industrial_count
         FROM districts d
       WHERE d.owner_player_id IS NOT NULL
          AND COALESCE(d.is_destroyed, false) = false
          AND d.game_mode = $1
        GROUP BY d.owner_player_id`
      ,
      [mode]
    );

    for (const row of parkOwners.rows) {
      const playerMoneyRes = await client.query(
        `SELECT district_income_dirty_remainder
           FROM players
          WHERE id = $1
          FOR UPDATE`,
        [row.player_id]
      );
      const dirtyRemainderStart = Number(playerMoneyRes.rows[0]?.district_income_dirty_remainder || 0);
      let dirtyRemainder = Number.isFinite(dirtyRemainderStart) ? Math.max(0, dirtyRemainderStart) : 0;

      for (const [typeKey, config] of Object.entries(DISTRICT_MINUTE_INCOME_RULES)) {
        const ownedCount = Math.max(0, Math.floor(Number(row[`${typeKey}_count`] || 0)));
        if (ownedCount <= 0) continue;

        const cleanPayout = ownedCount * config.clean;
        const dirtyRaw = ownedCount * config.dirty + dirtyRemainder;
        const dirtyPayout = Math.floor(dirtyRaw);
        dirtyRemainder = Math.max(0, dirtyRaw - dirtyPayout);

        if (cleanPayout > 0) {
          await addCleanMoney(client, row.player_id, cleanPayout);
        }
        if (dirtyPayout > 0) {
          await addDirtyMoney(client, row.player_id, dirtyPayout);
        }

        if (cleanPayout > 0 && dirtyPayout > 0) {
          await client.query(
            "INSERT INTO economy_ledger (player_id, delta, reason) VALUES ($1, $2, $3), ($1, $4, $5)",
            [
              row.player_id,
              cleanPayout,
              config.cleanReason,
              dirtyPayout,
              config.dirtyReason
            ]
          );
        } else if (cleanPayout > 0) {
          await client.query(
            "INSERT INTO economy_ledger (player_id, delta, reason) VALUES ($1, $2, $3)",
            [row.player_id, cleanPayout, config.cleanReason]
          );
        } else if (dirtyPayout > 0) {
          await client.query(
            "INSERT INTO economy_ledger (player_id, delta, reason) VALUES ($1, $2, $3)",
            [row.player_id, dirtyPayout, config.dirtyReason]
          );
        }
      }

      await client.query(
        `UPDATE players
            SET district_income_dirty_remainder = $1,
                updated_at = NOW()
          WHERE id = $2`,
        [dirtyRemainder, row.player_id]
      );
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

module.exports = { runParkIncomeTick };

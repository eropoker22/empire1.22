const { pool } = require("../config/db");
const { ensureMarketSchema } = require("./marketService");
const { ensureMoneySchema, normalizeMoneyRow } = require("./moneyService");
const { ensureDrugSchema, getDrugRuntimeFromRow, serializeDrugStatus } = require("./drugService");

const COMMERCIAL_CLEAN_MONEY_PER_MINUTE = 3;
const COMMERCIAL_DIRTY_MONEY_PER_MINUTE = 1;
const RESIDENTIAL_CLEAN_MONEY_PER_MINUTE = 2;
const RESIDENTIAL_DIRTY_MONEY_PER_MINUTE = 0.5;
const DOWNTOWN_CLEAN_MONEY_PER_MINUTE = 5;
const DOWNTOWN_DIRTY_MONEY_PER_MINUTE = 2;
const PARK_CLEAN_MONEY_PER_MINUTE = 2;
const PARK_DIRTY_MONEY_PER_MINUTE = 1;
const INDUSTRIAL_CLEAN_MONEY_PER_MINUTE = 3;
const INDUSTRIAL_DIRTY_MONEY_PER_MINUTE = 1;
const COMMERCIAL_TOTAL_MONEY_PER_HOUR = (COMMERCIAL_CLEAN_MONEY_PER_MINUTE + COMMERCIAL_DIRTY_MONEY_PER_MINUTE) * 60;
const RESIDENTIAL_TOTAL_MONEY_PER_HOUR = (RESIDENTIAL_CLEAN_MONEY_PER_MINUTE + RESIDENTIAL_DIRTY_MONEY_PER_MINUTE) * 60;
const DOWNTOWN_TOTAL_MONEY_PER_HOUR = (DOWNTOWN_CLEAN_MONEY_PER_MINUTE + DOWNTOWN_DIRTY_MONEY_PER_MINUTE) * 60;
const PARK_TOTAL_MONEY_PER_HOUR = (PARK_CLEAN_MONEY_PER_MINUTE + PARK_DIRTY_MONEY_PER_MINUTE) * 60;
const INDUSTRIAL_TOTAL_MONEY_PER_HOUR = (INDUSTRIAL_CLEAN_MONEY_PER_MINUTE + INDUSTRIAL_DIRTY_MONEY_PER_MINUTE) * 60;

async function getEconomyStatus(playerId) {
  await ensureMarketSchema();
  await ensureMoneySchema();
  await ensureDrugSchema();
  const balanceRes = await pool.query(
    `SELECT money, clean_money, dirty_money, influence_points, alliance_id, heat, drugs,
            weapons, defense, materials, data_shards,
            game_mode,
            drug_neon_dust, drug_pulse_shot, drug_velvet_smoke, drug_ghost_serum, drug_overdrive_x,
            drug_neon_dust_active_until, drug_pulse_shot_active_until, drug_velvet_smoke_active_until, drug_ghost_serum_active_until, drug_overdrive_x_active_until,
            drug_neon_dust_active_dose, drug_pulse_shot_active_dose, drug_velvet_smoke_active_dose, drug_ghost_serum_active_dose, drug_overdrive_x_active_dose
       FROM players
      WHERE id = $1`,
    [playerId]
  );
  const player = balanceRes.rows[0];
  if (!player) {
    const error = new Error("player_not_found");
    error.status = 404;
    throw error;
  }
  const money = normalizeMoneyRow(player);
  const drugRuntime = getDrugRuntimeFromRow(player);
  const drugStatus = serializeDrugStatus(drugRuntime);

  const districtRes = await pool.query(
      `SELECT COALESCE(SUM(base_income), 0) AS income,
            COUNT(*) FILTER (WHERE LOWER(COALESCE(type, '')) = 'commercial') AS commercial_count,
            COUNT(*) FILTER (WHERE LOWER(COALESCE(type, '')) = 'residential') AS residential_count,
            COUNT(*) FILTER (WHERE LOWER(COALESCE(type, '')) = 'downtown') AS downtown_count,
            COUNT(*) FILTER (WHERE LOWER(COALESCE(type, '')) = 'park') AS park_count,
            COUNT(*) FILTER (WHERE LOWER(COALESCE(type, '')) = 'industrial') AS industrial_count
       FROM districts
      WHERE owner_player_id = $1
        AND COALESCE(is_destroyed, false) = false
        AND game_mode = $2`,
    [playerId, player.game_mode || "war"]
  );

  let income = Number(districtRes.rows[0].income);
  const commercialCount = Math.max(0, Math.floor(Number(districtRes.rows[0]?.commercial_count || 0)));
  const residentialCount = Math.max(0, Math.floor(Number(districtRes.rows[0]?.residential_count || 0)));
  const downtownCount = Math.max(0, Math.floor(Number(districtRes.rows[0]?.downtown_count || 0)));
  const parkCount = Math.max(0, Math.floor(Number(districtRes.rows[0]?.park_count || 0)));
  const industrialCount = Math.max(0, Math.floor(Number(districtRes.rows[0]?.industrial_count || 0)));

  if (player.alliance_id) {
    const allianceRes = await pool.query(
      "SELECT bonus_income_pct FROM alliances WHERE id = $1",
      [player.alliance_id]
    );
    const bonusPct = allianceRes.rows[0]?.bonus_income_pct || 0;
    income = Math.floor(income * (1 + bonusPct / 100));
  }

  income = Math.floor(income * drugRuntime.modifiers.incomeMultiplier * drugRuntime.modifiers.dirtyIncomeMultiplier);
  income += commercialCount * COMMERCIAL_TOTAL_MONEY_PER_HOUR;
  income += residentialCount * RESIDENTIAL_TOTAL_MONEY_PER_HOUR;
  income += downtownCount * DOWNTOWN_TOTAL_MONEY_PER_HOUR;
  income += parkCount * PARK_TOTAL_MONEY_PER_HOUR;
  income += industrialCount * INDUSTRIAL_TOTAL_MONEY_PER_HOUR;

  return {
    balance: money.totalMoney,
    cleanMoney: money.cleanMoney,
    dirtyMoney: money.dirtyMoney,
    incomePerHour: income,
    influence: Number(player.influence_points),
    drugs: drugStatus.drugs,
    drugInventory: drugStatus.drugInventory,
    activeDrugs: drugStatus.activeDrugs,
    weapons: Number(player.weapons || 0),
    defense: Number(player.defense || 0),
    materials: Number(player.materials || 0),
    dataShards: Number(player.data_shards || 0),
    heat: Number(player.heat || 0),
    raidRiskPct: drugStatus.raidRiskPct,
    drugModifiers: drugStatus.modifiers
  };
}

module.exports = { getEconomyStatus };

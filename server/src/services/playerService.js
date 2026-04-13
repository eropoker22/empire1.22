const { pool } = require("../config/db");
const { ensureMoneySchema } = require("./moneyService");
const {
  ensureDrugSchema,
  getDrugRuntimeFromRow,
  serializeDrugStatus
} = require("./drugService");
const { ensureGangColorSchema, claimGangColor } = require("./gangColorService");

async function getPlayerProfile(playerId) {
  await ensureMoneySchema();
  await ensureDrugSchema();
  await ensureGangColorSchema();
  const result = await pool.query(
    `SELECT p.id, p.username, p.gang_name, p.money, p.clean_money, p.dirty_money, p.influence_points,
            p.heat, p.drugs,
            p.raid_member_losses,
            p.drug_neon_dust, p.drug_pulse_shot, p.drug_velvet_smoke, p.drug_ghost_serum, p.drug_overdrive_x,
            p.drug_neon_dust_active_until, p.drug_pulse_shot_active_until, p.drug_velvet_smoke_active_until, p.drug_ghost_serum_active_until, p.drug_overdrive_x_active_until,
            p.drug_neon_dust_active_dose, p.drug_pulse_shot_active_dose, p.drug_velvet_smoke_active_dose, p.drug_ghost_serum_active_dose, p.drug_overdrive_x_active_dose,
            p.gang_structure,
            p.gang_color,
            a.name AS alliance_name,
            (SELECT COUNT(*) FROM districts d WHERE d.owner_player_id = p.id) AS district_count
     FROM players p
     LEFT JOIN alliances a ON a.id = p.alliance_id
     WHERE p.id = $1`,
    [playerId]
  );

  const profile = result.rows[0] || null;
  if (!profile) return null;

  const drugRuntime = getDrugRuntimeFromRow(profile);
  const drugStatus = serializeDrugStatus(drugRuntime);

  return {
    ...profile,
    ...drugStatus
  };
}

async function setPlayerStructure(playerId, structure) {
  await ensureGangColorSchema();
  const result = await pool.query(
    "UPDATE players SET gang_structure = $1 WHERE id = $2 RETURNING gang_structure",
    [structure, playerId]
  );
  return result.rows[0]?.gang_structure || null;
}

async function setPlayerGangColor(playerId, color) {
  return claimGangColor({ playerId, color });
}

module.exports = { getPlayerProfile, setPlayerStructure, setPlayerGangColor };

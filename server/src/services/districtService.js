const { pool } = require("../config/db");
const { CityGen } = require("./mapGen");
const { getGameModeConfig, normalizeGameMode } = require("../config/gameModes");
let districtTypeCorrectionsEnsured = false;

function resolveDistrictMapIdFromName(name) {
  const raw = String(name || "").trim();
  if (!raw) return null;
  const match = raw.match(/(\d+)\s*$/);
  if (!match) return null;
  const parsed = Number(match[1]);
  if (!Number.isFinite(parsed)) return null;
  return Math.max(1, Math.floor(parsed));
}

async function ensureDistrictDestructionSchema() {
  await pool.query(`
    ALTER TABLE districts
      ADD COLUMN IF NOT EXISTS game_mode TEXT NOT NULL DEFAULT 'war',
      ADD COLUMN IF NOT EXISTS is_destroyed BOOLEAN NOT NULL DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS destroyed_at TIMESTAMP NULL
  `);
  await pool.query(`
    ALTER TABLE players
      ADD COLUMN IF NOT EXISTS game_mode TEXT NOT NULL DEFAULT 'war'
  `);
}

async function ensureDistricts(gameMode = "war") {
  const mode = normalizeGameMode(gameMode);
  const modeConfig = getGameModeConfig(mode);
  await ensureDistrictDestructionSchema();
  const existing = await pool.query("SELECT COUNT(*) FROM districts WHERE game_mode = $1", [mode]);
  const count = Number(existing.rows[0].count);
  if (count > 0) return;

  const seed = modeConfig.mapSeed;
  const city = CityGen.generate({
    seed,
    width: 1400,
    height: 900,
    districtCount: 130
  });

  const values = [];
  const params = [];
  let idx = 1;

  city.districts.forEach((district) => {
    params.push(district.name, district.type, JSON.stringify(district.polygon), district.income, district.influence, mode);
    values.push(`($${idx}, $${idx + 1}, $${idx + 2}, $${idx + 3}, $${idx + 4}, $${idx + 5})`);
    idx += 6;
  });

  await pool.query(
    `INSERT INTO districts (name, type, polygon, base_income, influence_level, game_mode)
     VALUES ${values.join(",")}`,
    params
  );
}

async function ensureDistrictTypeCorrections() {
  if (districtTypeCorrectionsEnsured) return;
  await pool.query(
    `UPDATE districts
        SET type = 'downtown',
            updated_at = NOW()
      WHERE CAST(substring(name FROM '([0-9]+)$') AS INT) IN (3, 26)
        AND LOWER(COALESCE(type, '')) <> 'downtown'`
  );
  districtTypeCorrectionsEnsured = true;
}

async function listDistricts(gameMode = "war") {
  const mode = normalizeGameMode(gameMode);
  await ensureDistrictDestructionSchema();
  await ensureDistricts(mode);
  await ensureDistrictTypeCorrections();
  const result = await pool.query(
    `SELECT d.id, d.name, d.type, d.base_income, d.influence_level, d.polygon,
            d.owner_player_id, d.is_destroyed, d.destroyed_at,
            p.gang_name AS owner_name,
            p.username AS owner_username,
            a.name AS owner_alliance_name,
            a.icon_key AS owner_alliance_icon_key
     FROM districts d
      LEFT JOIN players p ON p.id = d.owner_player_id AND p.game_mode = d.game_mode
      LEFT JOIN alliances a ON a.id = p.alliance_id
     WHERE d.game_mode = $1
     ORDER BY d.name ASC`,
    [mode]
  );

  return result.rows.map((row) => ({
    id: row.id,
    mapId: resolveDistrictMapIdFromName(row.name),
    name: row.name,
    type: row.type,
    owner: row.owner_name,
    ownerPlayerId: row.owner_player_id || null,
    ownerNick: row.owner_username || null,
    ownerAllianceName: row.owner_alliance_name || null,
    ownerAllianceIconKey: row.owner_alliance_icon_key || null,
    influence: row.influence_level,
    income: row.base_income,
    isDestroyed: Boolean(row.is_destroyed),
    destroyedAt: row.destroyed_at || null,
    polygon: typeof row.polygon === "string" ? JSON.parse(row.polygon) : row.polygon
  }));
}

module.exports = { listDistricts, ensureDistricts, ensureDistrictDestructionSchema };

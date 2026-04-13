const { pool } = require("../config/db");
const { MAX_INFLUENCE } = require("../config/constants");
const { getGameModeConfig, normalizeGameMode } = require("../config/gameModes");
const { ensureMoneySchema, spendPlayerMoney } = require("./moneyService");
const { HEAT_BALANCE } = require("../config/drugs");
const { ensureDistrictDestructionSchema } = require("./districtService");
const {
  ensureDrugSchema,
  getDrugRuntimeFromRow,
  projectHeatGain
} = require("./drugService");

const DISTRICT_DESTROY_CHANCE = 0.08;
const DISTRICT_RAID_LOCK_MS = 2 * 60 * 60 * 1000;
const COMBAT_WEAPON_TIERS = Object.freeze({
  attack: [
    { name: "Baseballová pálka", requiredMembers: 50, power: 10 },
    { name: "Pouliční pistole", requiredMembers: 100, power: 20 },
    { name: "Granát", requiredMembers: 150, power: 30 },
    { name: "Samopal", requiredMembers: 200, power: 40 },
    { name: "Bazuka", requiredMembers: 250, power: 50 }
  ],
  defense: [
    { name: "Neprůstřelná vesta", requiredMembers: 50, power: 10 },
    { name: "Ocelové barikády", requiredMembers: 100, power: 20 },
    { name: "Bezpečnostní kamery", requiredMembers: 150, power: 30 },
    { name: "Automatické kulometné stanoviště", requiredMembers: 200, power: 40 },
    { name: "Alarm", requiredMembers: 250, power: 50 }
  ]
});
const DISTRICT_POPULATION_WEIGHTS = Object.freeze({
  downtown: 3600,
  commercial: 2600,
  residential: 5400,
  industrial: 1900,
  park: 1300
});
let attackTargetCooldownSchemaEnsured = false;
let raidSchemaEnsured = false;
let raidMemberLossSchemaEnsured = false;

async function ensureAttackTargetCooldownSchema(client) {
  if (attackTargetCooldownSchemaEnsured) return;
  await client.query(`
    CREATE TABLE IF NOT EXISTS attack_target_cooldowns (
      attacker_player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
      target_player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
      next_attack_at TIMESTAMP NOT NULL,
      PRIMARY KEY (attacker_player_id, target_player_id)
    )
  `);
  attackTargetCooldownSchemaEnsured = true;
}

async function ensureRaidMemberLossSchema(client) {
  if (raidMemberLossSchemaEnsured) return;
  await client.query(`
    ALTER TABLE players
      ADD COLUMN IF NOT EXISTS raid_member_losses INT NOT NULL DEFAULT 0
  `);
  raidMemberLossSchemaEnsured = true;
}

async function ensureRaidSchema(client) {
  if (raidSchemaEnsured) return;
  await ensureRaidMemberLossSchema(client);
  await client.query(`
    CREATE TABLE IF NOT EXISTS raid_player_cooldowns (
      player_id UUID PRIMARY KEY REFERENCES players(id) ON DELETE CASCADE,
      next_raid_at TIMESTAMP NOT NULL
    )
  `);
  await client.query(`
    CREATE TABLE IF NOT EXISTS district_raid_locks (
      district_id UUID PRIMARY KEY REFERENCES districts(id) ON DELETE CASCADE,
      locked_until TIMESTAMP NOT NULL
    )
  `);
  await client.query(`
    CREATE TABLE IF NOT EXISTS district_raid_stashes (
      district_id UUID PRIMARY KEY REFERENCES districts(id) ON DELETE CASCADE,
      materials INT NOT NULL DEFAULT 0,
      drugs INT NOT NULL DEFAULT 0,
      weapons INT NOT NULL DEFAULT 0,
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
  raidSchemaEnsured = true;
}

async function attackDistrict({ playerId, districtId, gameMode = "war" }) {
  const mode = normalizeGameMode(gameMode);
  const modeConfig = getGameModeConfig(mode);
  await ensureMoneySchema();
  await ensureDrugSchema();
  await ensureDistrictDestructionSchema();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await ensureRaidMemberLossSchema(client);
    await ensureAttackTargetCooldownSchema(client);

    const districtRes = await client.query(
      `SELECT d.id, d.type, d.influence_level, d.owner_player_id, d.is_destroyed,
              p.influence_points AS owner_influence,
              p.alliance_id AS owner_alliance_id,
              p.weapons AS owner_weapons,
              p.defense AS owner_defense,
              p.heat AS owner_heat,
              p.drug_neon_dust AS owner_drug_neon_dust,
              p.drug_pulse_shot AS owner_drug_pulse_shot,
              p.drug_velvet_smoke AS owner_drug_velvet_smoke,
              p.drug_ghost_serum AS owner_drug_ghost_serum,
              p.drug_overdrive_x AS owner_drug_overdrive_x,
              p.drug_neon_dust_active_until AS owner_drug_neon_dust_active_until,
              p.drug_pulse_shot_active_until AS owner_drug_pulse_shot_active_until,
              p.drug_velvet_smoke_active_until AS owner_drug_velvet_smoke_active_until,
              p.drug_ghost_serum_active_until AS owner_drug_ghost_serum_active_until,
              p.drug_overdrive_x_active_until AS owner_drug_overdrive_x_active_until,
              p.drug_neon_dust_active_dose AS owner_drug_neon_dust_active_dose,
              p.drug_pulse_shot_active_dose AS owner_drug_pulse_shot_active_dose,
              p.drug_velvet_smoke_active_dose AS owner_drug_velvet_smoke_active_dose,
              p.drug_ghost_serum_active_dose AS owner_drug_ghost_serum_active_dose,
              p.drug_overdrive_x_active_dose AS owner_drug_overdrive_x_active_dose
       FROM districts d
       LEFT JOIN players p ON p.id = d.owner_player_id
       WHERE d.id = $1
         AND d.game_mode = $2
       FOR UPDATE`,
      [districtId, mode]
    );

    if (districtRes.rowCount === 0) {
      await client.query("ROLLBACK");
      return { ok: false, error: "not_found" };
    }

    const playerRes = await client.query(
      `SELECT clean_money, dirty_money, influence_points, alliance_id, heat, weapons, defense,
              drug_neon_dust, drug_pulse_shot, drug_velvet_smoke, drug_ghost_serum, drug_overdrive_x,
              drug_neon_dust_active_until, drug_pulse_shot_active_until, drug_velvet_smoke_active_until, drug_ghost_serum_active_until, drug_overdrive_x_active_until,
              drug_neon_dust_active_dose, drug_pulse_shot_active_dose, drug_velvet_smoke_active_dose, drug_ghost_serum_active_dose, drug_overdrive_x_active_dose
         FROM players
        WHERE id = $1
        FOR UPDATE`,
      [playerId]
    );

    if (playerRes.rowCount === 0) {
      await client.query("ROLLBACK");
      return { ok: false, error: "not_found" };
    }

    const player = playerRes.rows[0];
    const district = districtRes.rows[0];
    if (district.is_destroyed) {
      await client.query("ROLLBACK");
      return { ok: false, error: "destroyed_district" };
    }
    const attackerDrugs = getDrugRuntimeFromRow(player);
    const defenderDrugs = district.owner_player_id
      ? getDrugRuntimeFromRow(district, { prefix: "owner_" })
      : null;
    const attackerGangMembers = await estimateGangMembers(client, playerId);
    const defenderGangMembers = district.owner_player_id
      ? await estimateGangMembers(client, district.owner_player_id)
      : 0;
    const attackerWeaponTier = resolveCombatWeaponTier("attack", attackerGangMembers);
    const defenderWeaponTier = district.owner_player_id
      && Number(district.owner_defense || 0) > 0
      ? resolveCombatWeaponTier("defense", defenderGangMembers)
      : null;

    if (Number(player.weapons || 0) <= 0) {
      await client.query("ROLLBACK");
      return { ok: false, error: "insufficient_weapons" };
    }
    if (!attackerWeaponTier) {
      await client.query("ROLLBACK");
      return { ok: false, error: "insufficient_members" };
    }

    if (district.owner_player_id === playerId) {
      await client.query("ROLLBACK");
      return { ok: false, error: "own_district" };
    }

    if (player.alliance_id && district.owner_alliance_id && player.alliance_id === district.owner_alliance_id) {
      await client.query("ROLLBACK");
      return { ok: false, error: "allied_district" };
    }

    const targetPlayerId = district.owner_player_id || null;
    if (targetPlayerId) {
      const cooldown = await client.query(
        `SELECT next_attack_at
           FROM attack_target_cooldowns
          WHERE attacker_player_id = $1
            AND target_player_id = $2`,
        [playerId, targetPlayerId]
      );
      if (cooldown.rowCount > 0) {
        const nextAttack = cooldown.rows[0].next_attack_at;
        const now = Date.now();
        const nextAttackMs = nextAttack ? new Date(nextAttack).getTime() : 0;
        if (nextAttackMs > now) {
          await client.query("ROLLBACK");
          return {
            ok: false,
            error: "cooldown",
            cooldownMs: Math.max(0, nextAttackMs - now),
            targetPlayerId
          };
        }
      }
    }

    const mapRes = await client.query(
      "SELECT id, owner_player_id, polygon FROM districts WHERE game_mode = $1",
      [mode]
    );

    const sourceDistrictId = resolveOwnedAdjacentDistrictId({
      districts: mapRes.rows,
      targetDistrictId: district.id,
      playerId
    });

    if (sourceDistrictId == null) {
      await client.query("ROLLBACK");
      return { ok: false, error: "not_adjacent" };
    }

    const attackCost = 20;
    if (Number(player.clean_money || 0) + Number(player.dirty_money || 0) < attackCost) {
      await client.query("ROLLBACK");
      return { ok: false, error: "insufficient_funds" };
    }

    const defenderInfluence = district.owner_influence || 0;
    const attackerInfluence = player.influence_points || 0;

    const defensePenalty = typeDefensePenalty(district.type);
    const attackerPower = Number(attackerDrugs.modifiers.attackPowerMultiplier || 1)
      * (1 + Number(attackerWeaponTier.power || 0) / 100);
    const defenderPower = Number(defenderDrugs?.modifiers?.defensePowerMultiplier || 1)
      * (1 + Number(defenderWeaponTier?.power || 0) / 100);
    const attackScore = attackerPower * (1 + Math.max(0, Number(attackerInfluence || 0)) / 500);
    const defenseScore = defenderPower * (1 + Math.max(0, Number(defenderInfluence || 0)) / 500) * (1 + defensePenalty);

    const catastrophe = Math.random() < DISTRICT_DESTROY_CHANCE;
    let outcomeKey = "failure";
    if (catastrophe) {
      outcomeKey = "catastrophe";
    } else if (attackScore > defenseScore) {
      outcomeKey = Math.random() < 0.7 ? "total_success" : "pyrrhic_victory";
    }

    const attackPowerDisplay = Math.max(1, Math.round(attackScore * 100));
    const defensePowerDisplay = Math.max(1, Math.round(defenseScore * 100));
    const attackStrengthGap = attackPowerDisplay - defensePowerDisplay;

    let newInfluence = district.influence_level;
    let newOwner = district.owner_player_id;
    let destroyed = false;
    let defenderDefenseLossPct = 0;
    let defenderInfluenceLossPct = 0;
    let districtDestroyed = false;

    if (outcomeKey === "total_success") {
      newInfluence = MAX_INFLUENCE;
      newOwner = playerId;
      defenderDefenseLossPct = 100;
      defenderInfluenceLossPct = 100;
    } else if (outcomeKey === "pyrrhic_victory") {
      newInfluence = Math.max(0, Math.floor(Number(district.influence_level || 0) * 0.75));
      defenderDefenseLossPct = 100;
      defenderInfluenceLossPct = 25;
    } else if (outcomeKey === "failure") {
      newInfluence = Math.max(0, Math.floor(Number(district.influence_level || 0) * 0.8));
      defenderDefenseLossPct = 20;
      defenderInfluenceLossPct = 20;
    } else if (outcomeKey === "catastrophe") {
      destroyed = true;
      districtDestroyed = true;
      newInfluence = 0;
      newOwner = null;
      defenderDefenseLossPct = 100;
      defenderInfluenceLossPct = 100;
    }

    if (destroyed) {
      newInfluence = 0;
      newOwner = null;
    }

    if (district.owner_player_id && defenderDefenseLossPct > 0) {
      const defenseLossMultiplier = Math.max(0, 1 - (defenderDefenseLossPct / 100));
      await client.query(
        `UPDATE players
            SET defense = GREATEST(0, FLOOR(defense * $1)::int),
                updated_at = NOW()
          WHERE id = $2`,
        [defenseLossMultiplier, district.owner_player_id]
      );
    }

    await client.query(
      `UPDATE districts
          SET influence_level = $1,
              owner_player_id = $2,
              is_destroyed = $3,
              destroyed_at = CASE WHEN $3 THEN NOW() ELSE NULL END,
              updated_at = NOW()
        WHERE id = $4`,
      [newInfluence, newOwner, destroyed, districtId]
    );

    const influenceChange = Math.floor((10 + Math.random() * 16) * typeInfluenceMultiplier(district.type));
    const baseInfluenceGain = outcomeKey === "total_success"
      ? Math.ceil(influenceChange / 4)
      : Math.floor(influenceChange / 8);
    const influenceGain = Math.max(
      0,
      Math.floor(baseInfluenceGain * Number(attackerDrugs.modifiers.influenceGainMultiplier || 1))
    );
    await spendPlayerMoney(client, { playerId, amount: attackCost, preferDirty: true });
    await client.query(
      "UPDATE players SET influence_points = influence_points + $1 WHERE id = $2",
      [influenceGain, playerId]
    );

    const attackHeatBase = attackerDrugs.activeByKey.overdrive_x?.active
      ? Number(HEAT_BALANCE.overdriveAttackHeatGain || 5)
      : Number(HEAT_BALANCE.baseAttackHeatGain || 2);
    const attackHeatGain = projectHeatGain(attackHeatBase, attackerDrugs);
    if (attackHeatGain > 0) {
      await client.query(
        `UPDATE players
            SET heat = heat + $1,
                updated_at = NOW()
          WHERE id = $2`,
        [attackHeatGain, playerId]
      );
    }

    await client.query(
      `INSERT INTO combat_logs (attacker_player_id, district_id, defender_player_id, success, attack_cost, influence_change)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [playerId, districtId, district.owner_player_id, outcomeKey === "total_success", attackCost, influenceChange]
    );

    if (targetPlayerId) {
      const nextAttackAt = new Date(
        Date.now() + ((modeConfig.attackActionDurationSeconds + modeConfig.attackCooldownSeconds) * 1000)
      );
      await client.query(
        `INSERT INTO attack_target_cooldowns (attacker_player_id, target_player_id, next_attack_at)
         VALUES ($1, $2, $3)
         ON CONFLICT (attacker_player_id, target_player_id)
         DO UPDATE SET next_attack_at = EXCLUDED.next_attack_at`,
        [playerId, targetPlayerId, nextAttackAt]
      );
    }

    await client.query("COMMIT");

    return {
      ok: true,
      success: outcomeKey === "total_success",
      outcomeKey,
      destroyed: districtDestroyed,
      influenceChange,
      heatGain: attackHeatGain,
      sourceDistrictId,
      newOwnerId: newOwner,
      newInfluence,
      attackPower: attackPowerDisplay,
      defensePower: defensePowerDisplay,
      attackerLossPct: outcomeKey === "pyrrhic_victory" ? 50 : (outcomeKey === "failure" || outcomeKey === "catastrophe" ? 100 : 0),
      defenderLossPct: defenderDefenseLossPct,
      districtLossPct: defenderInfluenceLossPct,
      message: formatAttackOutcomeMessage({
        outcomeKey,
        destroyed: districtDestroyed
      })
    };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

function resolveRaidOutcomeByOwner(hasOwner) {
  const cleanChance = hasOwner ? 70 : 78;
  const dirtyChance = hasOwner ? 20 : 18;
  const roll = Math.random() * 100;
  if (roll < cleanChance) return "clean_success";
  if (roll < cleanChance + dirtyChance) return "dirty_fail";
  return "disaster";
}

function clampInt(value) {
  const parsed = Number(value || 0);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.floor(parsed));
}

function calculateRaidLoot(baseLoot, factor = 1) {
  return {
    materials: clampInt(clampInt(baseLoot.materials) * factor),
    drugs: clampInt(clampInt(baseLoot.drugs) * factor),
    weapons: clampInt(clampInt(baseLoot.weapons) * factor)
  };
}

function buildRaidLootLabel(loot) {
  const safeLoot = loot && typeof loot === "object" ? loot : {};
  return {
    materials: clampInt(safeLoot.materials),
    drugs: clampInt(safeLoot.drugs),
    weapons: clampInt(safeLoot.weapons)
  };
}

function resolveOwnedAdjacentDistrictIds({ districts, playerId }) {
  const safeDistricts = Array.isArray(districts) ? districts : [];
  const playerKey = String(playerId || "");
  if (!playerKey) return new Set();
  return new Set(
    safeDistricts
      .filter((district) => String(district?.owner_player_id || "") === playerKey)
      .map((district) => String(district.id))
  );
}

function resolveRaidSourceDistrictId({
  districts,
  targetDistrictId,
  playerId,
  playerAllianceId
}) {
  const safeDistricts = Array.isArray(districts) ? districts : [];
  const targetKey = String(targetDistrictId || "");
  const playerKey = String(playerId || "");
  if (!safeDistricts.length || !targetKey || !playerKey) return null;

  const byId = new Map(safeDistricts.map((district) => [String(district.id), district]));
  if (!byId.has(targetKey)) return null;

  const adjacency = buildDistrictAdjacency(safeDistricts);
  const targetNeighbors = adjacency.get(targetKey);
  if (!targetNeighbors || !targetNeighbors.size) return null;

  const directOwned = Array.from(targetNeighbors)
    .filter((neighborId) => String(byId.get(String(neighborId))?.owner_player_id || "") === playerKey)
    .sort((a, b) => String(a).localeCompare(String(b)));
  if (directOwned.length) return String(directOwned[0]);

  const allianceKey = String(playerAllianceId || "");
  if (!allianceKey) return null;

  const playerOwnedDistrictIds = resolveOwnedAdjacentDistrictIds({ districts: safeDistricts, playerId });
  if (!playerOwnedDistrictIds.size) return null;

  const allyOwners = new Set(
    safeDistricts
      .filter((district) => {
        const districtOwner = String(district?.owner_player_id || "");
        if (!districtOwner || districtOwner === playerKey) return false;
        const districtAlliance = String(district?.owner_alliance_id || "");
        return districtAlliance && districtAlliance === allianceKey;
      })
      .map((district) => String(district.owner_player_id))
  );
  if (!allyOwners.size) return null;

  const qualifiedAllyOwners = new Set();
  allyOwners.forEach((ownerId) => {
    let adjacentCount = 0;
    safeDistricts.forEach((district) => {
      if (String(district?.owner_player_id || "") !== ownerId) return;
      const districtNeighbors = adjacency.get(String(district.id));
      if (!districtNeighbors || !districtNeighbors.size) return;
      const hasPlayerNeighbor = Array.from(districtNeighbors).some((neighborId) => playerOwnedDistrictIds.has(String(neighborId)));
      if (hasPlayerNeighbor) adjacentCount += 1;
    });
    if (adjacentCount >= 2) {
      qualifiedAllyOwners.add(ownerId);
    }
  });

  if (!qualifiedAllyOwners.size) return null;

  const alliedSource = Array.from(targetNeighbors)
    .filter((neighborId) => qualifiedAllyOwners.has(String(byId.get(String(neighborId))?.owner_player_id || "")))
    .sort((a, b) => String(a).localeCompare(String(b)));
  if (!alliedSource.length) return null;
  return String(alliedSource[0]);
}

async function ensureDistrictRaidStash(client, districtId) {
  const current = await client.query(
    `SELECT district_id, materials, drugs, weapons
       FROM district_raid_stashes
      WHERE district_id = $1
      FOR UPDATE`,
    [districtId]
  );
  if (current.rowCount > 0) return current.rows[0];

  const seededMaterials = 120 + Math.floor(Math.random() * 81);
  const seededDrugs = 80 + Math.floor(Math.random() * 61);
  const seededWeapons = 50 + Math.floor(Math.random() * 41);
  const inserted = await client.query(
    `INSERT INTO district_raid_stashes (district_id, materials, drugs, weapons, updated_at)
     VALUES ($1, $2, $3, $4, NOW())
     RETURNING district_id, materials, drugs, weapons`,
    [districtId, seededMaterials, seededDrugs, seededWeapons]
  );
  return inserted.rows[0];
}

async function raidDistrict({ playerId, districtId, gameMode = "war" }) {
  const mode = normalizeGameMode(gameMode);
  const modeConfig = getGameModeConfig(mode);
  await ensureMoneySchema();
  await ensureDistrictDestructionSchema();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await ensureRaidSchema(client);

    const districtRes = await client.query(
      `SELECT d.id, d.owner_player_id, d.is_destroyed,
              p.alliance_id AS owner_alliance_id,
              p.materials AS owner_materials,
              p.drugs AS owner_drugs,
              p.weapons AS owner_weapons
         FROM districts d
         LEFT JOIN players p ON p.id = d.owner_player_id AND p.game_mode = d.game_mode
        WHERE d.id = $1
          AND d.game_mode = $2
        FOR UPDATE`,
      [districtId, mode]
    );
    if (districtRes.rowCount === 0) {
      await client.query("ROLLBACK");
      return { ok: false, error: "not_found" };
    }

    const attackerRes = await client.query(
      `SELECT alliance_id, materials, drugs, weapons
         FROM players
        WHERE id = $1
        FOR UPDATE`,
      [playerId]
    );
    if (attackerRes.rowCount === 0) {
      await client.query("ROLLBACK");
      return { ok: false, error: "not_found" };
    }

    const district = districtRes.rows[0];
    const attacker = attackerRes.rows[0];

    if (district.is_destroyed) {
      await client.query("ROLLBACK");
      return { ok: false, error: "destroyed_district" };
    }

    if (String(district.owner_player_id || "") === String(playerId)) {
      await client.query("ROLLBACK");
      return { ok: false, error: "own_district" };
    }

    if (
      attacker.alliance_id
      && district.owner_alliance_id
      && String(attacker.alliance_id) === String(district.owner_alliance_id)
    ) {
      await client.query("ROLLBACK");
      return { ok: false, error: "allied_district" };
    }

    const nowMs = Date.now();
    const raidCooldownRes = await client.query(
      `SELECT next_raid_at
         FROM raid_player_cooldowns
        WHERE player_id = $1`,
      [playerId]
    );
    if (raidCooldownRes.rowCount > 0) {
      const nextRaidMs = new Date(raidCooldownRes.rows[0].next_raid_at).getTime();
      if (Number.isFinite(nextRaidMs) && nextRaidMs > nowMs) {
        await client.query("ROLLBACK");
        return { ok: false, error: "cooldown", cooldownMs: Math.max(0, nextRaidMs - nowMs) };
      }
    }

    const districtLockRes = await client.query(
      `SELECT locked_until
         FROM district_raid_locks
        WHERE district_id = $1`,
      [districtId]
    );
    if (districtLockRes.rowCount > 0) {
      const lockUntilMs = new Date(districtLockRes.rows[0].locked_until).getTime();
      if (Number.isFinite(lockUntilMs) && lockUntilMs > nowMs) {
        await client.query("ROLLBACK");
        return { ok: false, error: "district_locked", districtLockMs: Math.max(0, lockUntilMs - nowMs) };
      }
    }

    const mapRes = await client.query(
      `SELECT d.id, d.owner_player_id, d.polygon, p.alliance_id AS owner_alliance_id
         FROM districts d
         LEFT JOIN players p ON p.id = d.owner_player_id AND p.game_mode = d.game_mode
        WHERE d.game_mode = $1`,
      [mode]
    );
    const sourceDistrictId = resolveRaidSourceDistrictId({
      districts: mapRes.rows,
      targetDistrictId: district.id,
      playerId,
      playerAllianceId: attacker.alliance_id
    });
    if (sourceDistrictId == null) {
      await client.query("ROLLBACK");
      return { ok: false, error: "not_adjacent" };
    }

    const hasOwner = Boolean(district.owner_player_id);
    const stealPct = 0.02 + Math.random() * 0.04;

    let sourceInventory = {
      materials: clampInt(district.owner_materials),
      drugs: clampInt(district.owner_drugs),
      weapons: clampInt(district.owner_weapons)
    };
    if (!hasOwner) {
      const stash = await ensureDistrictRaidStash(client, district.id);
      sourceInventory = {
        materials: clampInt(stash.materials),
        drugs: clampInt(stash.drugs),
        weapons: clampInt(stash.weapons)
      };
    }

    const baseLoot = {
      materials: Math.min(sourceInventory.materials, Math.max(0, Math.floor(sourceInventory.materials * stealPct))),
      drugs: Math.min(sourceInventory.drugs, Math.max(0, Math.floor(sourceInventory.drugs * stealPct))),
      weapons: Math.min(sourceInventory.weapons, Math.max(0, Math.floor(sourceInventory.weapons * stealPct)))
    };

    const outcomeKey = resolveRaidOutcomeByOwner(hasOwner);
    const gangLossPct = outcomeKey === "dirty_fail" ? 2.5 : (outcomeKey === "disaster" ? 5 : 0);
    const currentGangMembers = await estimateGangMembers(client, playerId);
    const gangLoss = Math.max(0, Math.floor(currentGangMembers * gangLossPct / 100));
    const dirtyLootMultiplier = (20 + Math.floor(Math.random() * 11)) / 100;
    const gainedLoot = outcomeKey === "clean_success"
      ? calculateRaidLoot(baseLoot, 1)
      : (outcomeKey === "dirty_fail" ? calculateRaidLoot(baseLoot, dirtyLootMultiplier) : { materials: 0, drugs: 0, weapons: 0 });

    if (hasOwner) {
      await client.query(
        `UPDATE players
            SET materials = GREATEST(0, materials - $1),
                drugs = GREATEST(0, drugs - $2),
                weapons = GREATEST(0, weapons - $3),
                updated_at = NOW()
          WHERE id = $4`,
        [baseLoot.materials, baseLoot.drugs, baseLoot.weapons, district.owner_player_id]
      );
    } else {
      await client.query(
        `UPDATE district_raid_stashes
            SET materials = GREATEST(0, materials - $1),
                drugs = GREATEST(0, drugs - $2),
                weapons = GREATEST(0, weapons - $3),
                updated_at = NOW()
          WHERE district_id = $4`,
        [baseLoot.materials, baseLoot.drugs, baseLoot.weapons, district.id]
      );
    }

    if (gainedLoot.materials > 0 || gainedLoot.drugs > 0 || gainedLoot.weapons > 0) {
      await client.query(
        `UPDATE players
            SET materials = materials + $1,
                drugs = drugs + $2,
                weapons = weapons + $3,
                updated_at = NOW()
          WHERE id = $4`,
        [gainedLoot.materials, gainedLoot.drugs, gainedLoot.weapons, playerId]
      );
    }

    if (gangLoss > 0) {
      await client.query(
        `UPDATE players
            SET raid_member_losses = GREATEST(0, raid_member_losses + $1),
                updated_at = NOW()
          WHERE id = $2`,
        [gangLoss, playerId]
      );
    }

    const postActionCooldownMs = outcomeKey === "clean_success"
      ? (modeConfig.raidCooldownSeconds * 1000)
      : (outcomeKey === "dirty_fail" ? Math.round(modeConfig.raidCooldownSeconds * 1.2 * 1000) : Math.round(modeConfig.raidCooldownSeconds * 1.5 * 1000));
    const nextRaidAt = new Date(nowMs + (modeConfig.raidActionDurationSeconds * 1000) + postActionCooldownMs);
    const districtLockUntil = new Date(nowMs + DISTRICT_RAID_LOCK_MS);

    await client.query(
      `INSERT INTO raid_player_cooldowns (player_id, next_raid_at)
       VALUES ($1, $2)
       ON CONFLICT (player_id)
       DO UPDATE SET next_raid_at = EXCLUDED.next_raid_at`,
      [playerId, nextRaidAt]
    );
    await client.query(
      `INSERT INTO district_raid_locks (district_id, locked_until)
       VALUES ($1, $2)
       ON CONFLICT (district_id)
       DO UPDATE SET locked_until = EXCLUDED.locked_until`,
      [district.id, districtLockUntil]
    );

    await client.query("COMMIT");

    return {
      ok: true,
      outcomeKey,
      loot: buildRaidLootLabel(gainedLoot),
      gangLoss,
      targetAlerted: hasOwner && outcomeKey === "disaster",
      sourceDistrictId,
      durationMs: modeConfig.raidActionDurationSeconds * 1000,
      cooldownMs: (modeConfig.raidActionDurationSeconds * 1000) + postActionCooldownMs,
      postActionCooldownMs,
      districtLockMs: DISTRICT_RAID_LOCK_MS
    };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

function formatAttackOutcomeMessage({ outcomeKey, destroyed }) {
  if (destroyed || outcomeKey === "catastrophe") {
    return "Všechno shořelo do prdele. Baráky, lidi, zásoby. Jen popel a smrad. Tady už není co brát, jen prázdná díra.";
  }
  if (outcomeKey === "total_success") {
    return "Rozjebali jste je na kusy. District je tvůj. Kdo tam ještě dýchá, už maká pro tebe nebo chcípne do rána.";
  }
  if (outcomeKey === "pyrrhic_victory") {
    return "Sejmul jsi jejich obranu, ale tvoji lidi šli do sraček s nima. Půlka chcípla, zbraně v hajzlu. District pořád stojí ale sotva.";
  }
  return "Totální průser. Vběhli jste tam jak idioti a nechali tam krev i výbavu. Oni taky něco ztratili, ale ty jsi ten, co dostal přes držku.";
}

async function estimateGangMembers(client, playerId) {
  const districtResult = await client.query(
    "SELECT type FROM districts WHERE owner_player_id = $1",
    [playerId]
  );
  const baseMembers = districtResult.rows.reduce(
    (sum, row) => sum + (DISTRICT_POPULATION_WEIGHTS[String(row.type || "").trim().toLowerCase()] || 2200),
    0
  );
  const playerResult = await client.query(
    "SELECT raid_member_losses FROM players WHERE id = $1",
    [playerId]
  );
  const persistentLosses = Math.max(0, Math.floor(Number(playerResult.rows[0]?.raid_member_losses || 0)));
  return Math.max(0, baseMembers - persistentLosses);
}

function resolveCombatWeaponTier(category, gangMembers) {
  const tiers = COMBAT_WEAPON_TIERS[category] || [];
  const eligible = tiers.filter((tier) => Number(gangMembers || 0) >= Number(tier.requiredMembers || 0));
  return eligible.length ? eligible[eligible.length - 1] : null;
}

function typeDefensePenalty(type) {
  switch (type) {
    case "park":
      return 0.1;
    case "residential":
      return 0.05;
    case "downtown":
      return -0.05;
    case "commercial":
      return -0.02;
    case "industrial":
    default:
      return 0;
  }
}

function typeInfluenceMultiplier(type) {
  switch (type) {
    case "downtown":
      return 1.2;
    case "commercial":
      return 1.1;
    case "industrial":
      return 1.0;
    case "residential":
      return 0.95;
    case "park":
    default:
      return 0.85;
  }
}

function isAttackTargetAdjacentToOwnedDistrict({ districts, targetDistrictId, playerId }) {
  return resolveOwnedAdjacentDistrictId({ districts, targetDistrictId, playerId }) != null;
}

function resolveOwnedAdjacentDistrictId({ districts, targetDistrictId, playerId }) {
  const safeDistricts = Array.isArray(districts) ? districts : [];
  if (!safeDistricts.length || !targetDistrictId || !playerId) return null;

  const targetKey = String(targetDistrictId);
  const playerKey = String(playerId);
  const districtsById = new Map(
    safeDistricts.map((district) => [String(district.id), district])
  );
  if (!districtsById.has(targetKey)) return null;

  const adjacency = buildDistrictAdjacency(safeDistricts);
  const neighbors = adjacency.get(targetKey);
  if (!neighbors || !neighbors.size) return null;

  const ownedNeighbors = [];

  for (const neighborKey of neighbors) {
    const neighbor = districtsById.get(neighborKey);
    if (!neighbor) continue;
    if (String(neighbor.owner_player_id) === playerKey) {
      ownedNeighbors.push(neighbor.id);
    }
  }

  if (!ownedNeighbors.length) return null;

  const numericOwned = ownedNeighbors
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value));
  if (numericOwned.length) {
    numericOwned.sort((a, b) => a - b);
    return numericOwned[0];
  }
  return String(ownedNeighbors[0]);
}

function buildDistrictAdjacency(districts) {
  const adjacency = new Map();
  const edgeOwners = new Map();

  (districts || []).forEach((district) => {
    const districtKey = String(district.id);
    if (!adjacency.has(districtKey)) {
      adjacency.set(districtKey, new Set());
    }

    const polygon = normalizePolygonPoints(district.polygon);
    if (polygon.length < 2) return;

    for (let i = 0; i < polygon.length; i += 1) {
      const from = polygon[i];
      const to = polygon[(i + 1) % polygon.length];
      const edgeKey = normalizeEdgeKey(from, to);
      if (!edgeOwners.has(edgeKey)) {
        edgeOwners.set(edgeKey, []);
      }
      edgeOwners.get(edgeKey).push(districtKey);
    }
  });

  edgeOwners.forEach((owners) => {
    const uniqueOwners = Array.from(new Set(owners));
    for (let i = 0; i < uniqueOwners.length; i += 1) {
      for (let j = i + 1; j < uniqueOwners.length; j += 1) {
        const a = uniqueOwners[i];
        const b = uniqueOwners[j];
        adjacency.get(a)?.add(b);
        adjacency.get(b)?.add(a);
      }
    }
  });

  return adjacency;
}

function normalizePolygonPoints(polygon) {
  if (!Array.isArray(polygon)) return [];
  return polygon
    .map((point) => {
      if (Array.isArray(point)) {
        return [Number(point[0] || 0), Number(point[1] || 0)];
      }
      if (point && typeof point === "object") {
        return [Number(point.x || 0), Number(point.y || 0)];
      }
      return null;
    })
    .filter(Boolean);
}

function normalizeEdgeKey(from, to) {
  const a = normalizePointKey(from);
  const b = normalizePointKey(to);
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

function normalizePointKey(point) {
  const x = Number(point?.[0] || 0).toFixed(3);
  const y = Number(point?.[1] || 0).toFixed(3);
  return `${x},${y}`;
}

module.exports = { attackDistrict, raidDistrict };

const { pool } = require("../config/db");
const { normalizeGameMode } = require("../config/gameModes");
const { normalizeDrugKey, DRUG_DEFINITIONS } = require("../config/drugs");

const HUNT_MODE_THRESHOLD = 10000;
const DRUG_UNIT_VALUE = 350;
const MATERIAL_UNIT_VALUE = 275;
const VALID_STATUSES = new Set(["active", "expired", "completed"]);
const VALID_TYPES = new Set(["capture_district", "successful_attack", "destroy_units"]);

let bountySchemaEnsured = false;

function clampWholeNumber(value) {
  return Math.max(0, Math.floor(Number(value) || 0));
}

function createServiceError(code, status = 400) {
  const error = new Error(code);
  error.code = code;
  error.status = status;
  return error;
}

function calculateBountyTotalValue(rewardCash, rewardDrugs, rewardMaterials) {
  return clampWholeNumber(rewardCash)
    + clampWholeNumber(rewardDrugs) * DRUG_UNIT_VALUE
    + clampWholeNumber(rewardMaterials) * MATERIAL_UNIT_VALUE;
}

function isHuntModeActive(totalValue) {
  return clampWholeNumber(totalValue) >= HUNT_MODE_THRESHOLD;
}

function mapBountyType(type) {
  const normalized = String(type || "").trim().toLowerCase();
  if (VALID_TYPES.has(normalized)) return normalized;
  if (normalized === "occupy-sector") return "capture_district";
  return "capture_district";
}

function serializeRewards({
  rewardCash = 0,
  rewardDrugs = 0,
  rewardMaterials = 0,
  rewardDrugType = "neonDust",
  rewardMaterialType = "metalParts"
}) {
  const safeRewards = [];
  if (clampWholeNumber(rewardCash) > 0) {
    safeRewards.push({
      key: "clean_cash",
      label: "Cash",
      amount: clampWholeNumber(rewardCash)
    });
  }
  if (clampWholeNumber(rewardDrugs) > 0) {
    const normalizedDrugKey = normalizeDrugKey(rewardDrugType);
    const drugMeta = normalizedDrugKey ? DRUG_DEFINITIONS[normalizedDrugKey] : null;
    safeRewards.push({
      key: `drug:${drugMeta?.apiKey || "neonDust"}`,
      label: drugMeta?.label || "Drogy",
      amount: clampWholeNumber(rewardDrugs)
    });
  }
  if (clampWholeNumber(rewardMaterials) > 0) {
    safeRewards.push({
      key: `materials:${String(rewardMaterialType || "metalParts").trim() || "metalParts"}`,
      label: String(rewardMaterialType || "Materiály").trim() || "Materiály",
      amount: clampWholeNumber(rewardMaterials)
    });
  }
  return safeRewards;
}

function parseRewards(rewards) {
  const safeRewards = Array.isArray(rewards) ? rewards : [];
  const parsed = {
    rewardCash: 0,
    rewardDrugs: 0,
    rewardMaterials: 0,
    rewardDrugType: "neonDust",
    rewardMaterialType: "metalParts",
    rewards: []
  };

  safeRewards.forEach((entry) => {
    const key = String(entry?.key || "").trim();
    const label = String(entry?.label || "").trim();
    const amount = clampWholeNumber(entry?.amount);
    if (!key || amount <= 0) return;

    parsed.rewards.push({ key, label, amount });
    if (key === "clean_cash") {
      parsed.rewardCash += amount;
      return;
    }
    if (key.startsWith("drug:")) {
      parsed.rewardDrugs += amount;
      parsed.rewardDrugType = key.slice("drug:".length) || parsed.rewardDrugType;
      return;
    }
    if (key.startsWith("materials:")) {
      parsed.rewardMaterials += amount;
      parsed.rewardMaterialType = key.slice("materials:".length) || parsed.rewardMaterialType;
      return;
    }
  });

  return parsed;
}

async function ensureBountySchema() {
  if (bountySchemaEnsured) return;
  await pool.query(`
    ALTER TABLE players
      ADD COLUMN IF NOT EXISTS game_mode TEXT NOT NULL DEFAULT 'war'
  `);
  await pool.query(`
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
    )
  `);
  await pool.query(`ALTER TABLE bounties ADD COLUMN IF NOT EXISTS contributors JSONB NOT NULL DEFAULT '[]'::jsonb`);
  await pool.query(`ALTER TABLE bounties ADD COLUMN IF NOT EXISTS total_value INT NOT NULL DEFAULT 0`);
  await pool.query(`ALTER TABLE bounties ADD COLUMN IF NOT EXISTS hunt_mode_active BOOLEAN NOT NULL DEFAULT FALSE`);
  await pool.query(`
    UPDATE bounties
       SET status = 'completed'
     WHERE status = 'claimed'
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_bounties_target_active
      ON bounties (target_player_id, status, created_at DESC)
  `);
  bountySchemaEnsured = true;
}

async function expireBounties(client = pool) {
  await ensureBountySchema();
  await client.query(`
    UPDATE bounties
       SET status = 'expired'
     WHERE status = 'active'
       AND expires_at IS NOT NULL
       AND expires_at <= NOW()
  `);
}

function mapBountyRow(row) {
  const rewards = parseRewards(row.rewards);
  const totalValue = clampWholeNumber(row.total_value || calculateBountyTotalValue(
    rewards.rewardCash,
    rewards.rewardDrugs,
    rewards.rewardMaterials
  ));

  return {
    id: row.id,
    targetPlayerId: row.target_player_id,
    targetName: row.target_username,
    targetAllianceTag: row.target_alliance_name || "Bez aliance",
    issuerPlayerId: row.created_by_player_id,
    issuerName: row.created_by_username,
    districtId: row.target_district_id,
    districtName: row.target_district_name || null,
    isAnonymous: Boolean(row.is_anonymous),
    rewardCash: rewards.rewardCash,
    rewardDrugs: rewards.rewardDrugs,
    rewardMaterials: rewards.rewardMaterials,
    rewardDrugType: rewards.rewardDrugType,
    rewardMaterialType: rewards.rewardMaterialType,
    totalValue,
    bountyType: mapBountyType(row.objective_type),
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    status: VALID_STATUSES.has(String(row.status || "").trim()) ? row.status : "active",
    contributors: Array.isArray(row.contributors) ? row.contributors : [],
    claimedBy: row.claimed_by_player_id || null,
    claimedByName: row.claimed_by_username || null,
    claimedAt: row.claimed_at,
    huntModeActive: Boolean(row.hunt_mode_active || isHuntModeActive(totalValue))
  };
}

async function listBounties(gameMode = "war") {
  const mode = normalizeGameMode(gameMode);
  await ensureBountySchema();
  await expireBounties();
  const result = await pool.query(`
    SELECT b.id,
           b.created_by_player_id,
           b.target_player_id,
           b.target_district_id,
           b.objective_type,
           b.is_anonymous,
           b.expires_at,
           b.rewards,
           b.status,
           b.claimed_by_player_id,
           b.claimed_at,
           b.contributors,
           b.total_value,
           b.hunt_mode_active,
           b.created_at,
           creator.username AS created_by_username,
           target.username AS target_username,
           target_alliance.name AS target_alliance_name,
           claimant.username AS claimed_by_username,
           district.name AS target_district_name
      FROM bounties b
      INNER JOIN players creator ON creator.id = b.created_by_player_id AND creator.game_mode = $1
      INNER JOIN players target ON target.id = b.target_player_id AND target.game_mode = $1
      LEFT JOIN alliances target_alliance ON target_alliance.id = target.alliance_id
      LEFT JOIN players claimant ON claimant.id = b.claimed_by_player_id AND claimant.game_mode = $1
      LEFT JOIN districts district ON district.id = b.target_district_id AND district.game_mode = $1
     WHERE creator.game_mode = $1
     ORDER BY
       CASE WHEN b.status = 'active' THEN 0 ELSE 1 END ASC,
       b.created_at DESC
  `, [mode]);
  return result.rows.map(mapBountyRow);
}

function normalizeContributors(contributors) {
  return (Array.isArray(contributors) ? contributors : [])
    .map((entry) => ({
      playerId: String(entry?.playerId || "").trim(),
      contributionDamage: Math.max(0, Number(entry?.contributionDamage || 0)),
      contributionScore: Math.max(0, Number(entry?.contributionScore || 0))
    }))
    .filter((entry) => entry.playerId);
}

function registerContribution(contributors, playerId, contributionValue) {
  const safePlayerId = String(playerId || "").trim();
  const safeContribution = Math.max(0, Number(contributionValue || 0));
  const next = normalizeContributors(contributors);
  if (!safePlayerId || safeContribution <= 0) return next;
  const existing = next.find((entry) => entry.playerId === safePlayerId);
  if (existing) {
    existing.contributionDamage += safeContribution;
    existing.contributionScore += safeContribution;
  } else {
    next.push({
      playerId: safePlayerId,
      contributionDamage: safeContribution,
      contributionScore: safeContribution
    });
  }
  return next;
}

function distributeByRatio(totalAmount, recipientEntries, valueKey) {
  const amount = clampWholeNumber(totalAmount);
  const safeEntries = (Array.isArray(recipientEntries) ? recipientEntries : [])
    .map((entry) => ({
      playerId: String(entry?.playerId || "").trim(),
      value: Math.max(0, Number(entry?.[valueKey] || 0))
    }))
    .filter((entry) => entry.playerId && entry.value > 0);

  if (amount <= 0 || !safeEntries.length) return [];
  const totalWeight = safeEntries.reduce((sum, entry) => sum + entry.value, 0);
  if (totalWeight <= 0) return [];

  let allocated = 0;
  const result = safeEntries.map((entry) => {
    const nextAmount = Math.floor((amount * entry.value) / totalWeight);
    allocated += nextAmount;
    return { playerId: entry.playerId, amount: nextAmount };
  });

  let remainder = amount - allocated;
  let index = 0;
  while (remainder > 0 && result.length) {
    result[index % result.length].amount += 1;
    remainder -= 1;
    index += 1;
  }

  return result.filter((entry) => entry.amount > 0);
}

function buildRewardDistributions(bounty, claimerId, contributors) {
  const safeContributors = normalizeContributors(contributors);
  if (!safeContributors.find((entry) => entry.playerId === claimerId)) {
    safeContributors.push({ playerId: claimerId, contributionDamage: 1, contributionScore: 1 });
  }

  if (bounty.bountyType === "capture_district") {
    const others = safeContributors.filter((entry) => entry.playerId !== claimerId);
    const claimerShareCash = Math.floor(bounty.rewardCash * 0.5);
    const claimerShareDrugs = Math.floor(bounty.rewardDrugs * 0.5);
    const claimerShareMaterials = Math.floor(bounty.rewardMaterials * 0.5);

    if (!others.length) {
      return {
        cash: [{ playerId: claimerId, amount: bounty.rewardCash }],
        drugs: [{ playerId: claimerId, amount: bounty.rewardDrugs }],
        materials: [{ playerId: claimerId, amount: bounty.rewardMaterials }]
      };
    }

    return {
      cash: [{ playerId: claimerId, amount: claimerShareCash }].concat(distributeByRatio(bounty.rewardCash - claimerShareCash, others, "contributionScore")),
      drugs: [{ playerId: claimerId, amount: claimerShareDrugs }].concat(distributeByRatio(bounty.rewardDrugs - claimerShareDrugs, others, "contributionScore")),
      materials: [{ playerId: claimerId, amount: claimerShareMaterials }].concat(distributeByRatio(bounty.rewardMaterials - claimerShareMaterials, others, "contributionScore"))
    };
  }

  if (bounty.bountyType === "successful_attack") {
    return {
      cash: distributeByRatio(bounty.rewardCash, safeContributors, "contributionDamage"),
      drugs: distributeByRatio(bounty.rewardDrugs, safeContributors, "contributionDamage"),
      materials: distributeByRatio(bounty.rewardMaterials, safeContributors, "contributionDamage")
    };
  }

  return {
    cash: distributeByRatio(bounty.rewardCash, safeContributors, "contributionScore"),
    drugs: distributeByRatio(bounty.rewardDrugs, safeContributors, "contributionScore"),
    materials: distributeByRatio(bounty.rewardMaterials, safeContributors, "contributionScore")
  };
}

async function applyPlayerPayout(client, playerId, payout) {
  const cleanMoney = clampWholeNumber(payout?.cash);
  const materials = clampWholeNumber(payout?.materials);
  const drugs = clampWholeNumber(payout?.drugs);
  const normalizedDrugKey = drugs > 0 ? normalizeDrugKey(payout?.drugType) : null;
  const drugColumn = normalizedDrugKey ? DRUG_DEFINITIONS[normalizedDrugKey].inventoryColumn : null;

  if (cleanMoney <= 0 && materials <= 0 && drugs <= 0) return;

  const updates = [];
  const params = [playerId];
  let index = 2;

  if (cleanMoney > 0) {
    updates.push(`clean_money = clean_money + $${index}`);
    updates.push(`money = money + $${index}`);
    params.push(cleanMoney);
    index += 1;
  }
  if (materials > 0) {
    updates.push(`materials = materials + $${index}`);
    params.push(materials);
    index += 1;
  }
  if (drugs > 0 && drugColumn) {
    updates.push(`${drugColumn} = ${drugColumn} + $${index}`);
    updates.push(`drugs = drugs + $${index}`);
    params.push(drugs);
    index += 1;
  }

  if (!updates.length) return;

  await client.query(
    `UPDATE players
        SET ${updates.join(", ")}
      WHERE id = $1`,
    params
  );
}

async function createBounty({
  playerId,
  targetUsername,
  targetDistrictId = null,
  rewardCash = 0,
  rewardDrugs = 0,
  rewardMaterials = 0,
  rewardDrugType = "neonDust",
  rewardMaterialType = "metalParts",
  bountyType = "capture_district",
  isAnonymous = true,
  durationHours = 12,
  gameMode = "war"
}) {
  const mode = normalizeGameMode(gameMode);
  await ensureBountySchema();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const actorRes = await client.query(
      `SELECT id, username, alliance_id, clean_money, materials,
              drug_neon_dust, drug_pulse_shot, drug_velvet_smoke, drug_ghost_serum, drug_overdrive_x
         FROM players
        WHERE id = $1
          AND game_mode = $2
        FOR UPDATE`,
      [playerId, mode]
    );
    const actor = actorRes.rows[0];
    if (!actor) throw createServiceError("missing_actor", 404);

    const targetRes = await client.query(
      `SELECT id, username, alliance_id
         FROM players
        WHERE LOWER(username) = LOWER($1)
          AND game_mode = $2
        FOR UPDATE`,
      [String(targetUsername || "").trim(), mode]
    );
    const target = targetRes.rows[0];
    if (!target) throw createServiceError("missing_target", 404);
    if (String(target.id) === String(playerId)) throw createServiceError("self_target", 400);
    if (actor.alliance_id && target.alliance_id && String(actor.alliance_id) === String(target.alliance_id)) {
      throw createServiceError("allied_target", 400);
    }

    let safeDistrictId = null;
    if (targetDistrictId) {
      const districtRes = await client.query(
        `SELECT id
           FROM districts
          WHERE id = $1
            AND owner_player_id = $2
            AND game_mode = $3`,
        [targetDistrictId, target.id, mode]
      );
      if (!districtRes.rows[0]?.id) throw createServiceError("invalid_target_district", 400);
      safeDistrictId = districtRes.rows[0].id;
    }

    const safeRewardCash = clampWholeNumber(rewardCash);
    const safeRewardDrugs = clampWholeNumber(rewardDrugs);
    const safeRewardMaterials = clampWholeNumber(rewardMaterials);
    const normalizedDrugKey = safeRewardDrugs > 0 ? normalizeDrugKey(rewardDrugType) : null;
    if (safeRewardDrugs > 0 && !normalizedDrugKey) throw createServiceError("invalid_reward_drug_type", 400);

    const totalValue = calculateBountyTotalValue(safeRewardCash, safeRewardDrugs, safeRewardMaterials);
    if (totalValue <= 0) throw createServiceError("missing_rewards", 400);

    const safeDurationHours = clampWholeNumber(durationHours);
    if (![6, 12, 24].includes(safeDurationHours)) throw createServiceError("invalid_duration", 400);

    const safeBountyType = mapBountyType(bountyType);
    if (!VALID_TYPES.has(safeBountyType)) throw createServiceError("invalid_bounty_type", 400);

    const duplicateRes = await client.query(
      `SELECT id
         FROM bounties
        WHERE created_by_player_id = $1
          AND target_player_id = $2
          AND objective_type = $3
          AND created_at > NOW() - INTERVAL '30 minutes'
        LIMIT 1`,
      [playerId, target.id, safeBountyType]
    );
    if (duplicateRes.rows.length) throw createServiceError("bounty_cooldown_active", 400);

    if (Number(actor.clean_money || 0) < safeRewardCash) throw createServiceError("insufficient_clean_cash", 400);
    if (Number(actor.materials || 0) < safeRewardMaterials) throw createServiceError("insufficient_materials", 400);
    if (safeRewardDrugs > 0) {
      const drugColumn = DRUG_DEFINITIONS[normalizedDrugKey].inventoryColumn;
      if (Number(actor[drugColumn] || 0) < safeRewardDrugs) throw createServiceError("insufficient_drugs", 400);
    }

    const rewardPayload = serializeRewards({
      rewardCash: safeRewardCash,
      rewardDrugs: safeRewardDrugs,
      rewardMaterials: safeRewardMaterials,
      rewardDrugType: DRUG_DEFINITIONS[normalizedDrugKey]?.apiKey || rewardDrugType,
      rewardMaterialType
    });

    const updateParts = [
      `clean_money = clean_money - $2`,
      `money = money - $2`,
      `materials = materials - $3`
    ];
    const updateParams = [playerId, safeRewardCash, safeRewardMaterials];
    if (safeRewardDrugs > 0) {
      const drugColumn = DRUG_DEFINITIONS[normalizedDrugKey].inventoryColumn;
      updateParts.push(`${drugColumn} = ${drugColumn} - $4`);
      updateParts.push(`drugs = drugs - $4`);
      updateParams.push(safeRewardDrugs);
    }
    await client.query(
      `UPDATE players
          SET ${updateParts.join(", ")}
        WHERE id = $1`,
      updateParams
    );

    const expiresAt = new Date(Date.now() + safeDurationHours * 60 * 60 * 1000);
    const insertRes = await client.query(
      `INSERT INTO bounties (
         created_by_player_id,
         target_player_id,
         target_district_id,
         objective_type,
         is_anonymous,
         expires_at,
         rewards,
         status,
         contributors,
         total_value,
         hunt_mode_active
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, 'active', '[]'::jsonb, $8, $9)
       RETURNING id`,
      [
        playerId,
        target.id,
        safeDistrictId,
        safeBountyType,
        Boolean(isAnonymous),
        expiresAt,
        JSON.stringify(rewardPayload),
        totalValue,
        isHuntModeActive(totalValue)
      ]
    );

    await client.query("COMMIT");
    return insertRes.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function resolveBounties({
  playerId,
  targetUsername,
  districtId = null,
  resolutionType = "occupation",
  contributionValue = 0,
  attackSucceeded = false,
  capturedDistrict = false,
  gameMode = "war"
}) {
  const mode = normalizeGameMode(gameMode);
  await ensureBountySchema();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await expireBounties(client);

    const targetRes = await client.query(
      `SELECT id
         FROM players
        WHERE LOWER(username) = LOWER($1)
          AND game_mode = $2`,
      [String(targetUsername || "").trim(), mode]
    );
    const target = targetRes.rows[0];
    if (!target?.id) {
      await client.query("COMMIT");
      return { claimed: [], payouts: [] };
    }

    const bountiesRes = await client.query(
      `SELECT *
         FROM bounties
        WHERE status = 'active'
          AND target_player_id = $1
          AND (target_district_id IS NULL OR target_district_id = $2)
        FOR UPDATE`,
      [target.id, districtId || null]
    );

    const completed = [];

    for (const row of bountiesRes.rows) {
      const bounty = mapBountyRow({
        ...row,
        target_username: targetUsername,
        target_alliance_name: "Bez aliance",
        created_by_username: "",
        claimed_by_username: "",
        target_district_name: null
      });

      const nextContributors = registerContribution(row.contributors, playerId, contributionValue);
      const isOccupation = String(resolutionType || "").trim() === "occupation";
      const shouldComplete =
        (bounty.bountyType === "capture_district" && (isOccupation || capturedDistrict))
        || (bounty.bountyType === "successful_attack" && !isOccupation && attackSucceeded)
        || (bounty.bountyType === "destroy_units" && !isOccupation && Number(contributionValue || 0) > 0);

      if (!shouldComplete) {
        await client.query(
          `UPDATE bounties
              SET contributors = $2::jsonb
            WHERE id = $1`,
          [row.id, JSON.stringify(nextContributors)]
        );
        continue;
      }

      const distributions = buildRewardDistributions(bounty, playerId, nextContributors);
      const payoutByPlayer = new Map();

      distributions.cash.forEach((entry) => {
        if (!payoutByPlayer.has(entry.playerId)) {
          payoutByPlayer.set(entry.playerId, {
            cash: 0,
            drugs: 0,
            materials: 0,
            drugType: bounty.rewardDrugType,
            materialType: bounty.rewardMaterialType
          });
        }
        payoutByPlayer.get(entry.playerId).cash += clampWholeNumber(entry.amount);
      });
      distributions.drugs.forEach((entry) => {
        if (!payoutByPlayer.has(entry.playerId)) {
          payoutByPlayer.set(entry.playerId, {
            cash: 0,
            drugs: 0,
            materials: 0,
            drugType: bounty.rewardDrugType,
            materialType: bounty.rewardMaterialType
          });
        }
        payoutByPlayer.get(entry.playerId).drugs += clampWholeNumber(entry.amount);
      });
      distributions.materials.forEach((entry) => {
        if (!payoutByPlayer.has(entry.playerId)) {
          payoutByPlayer.set(entry.playerId, {
            cash: 0,
            drugs: 0,
            materials: 0,
            drugType: bounty.rewardDrugType,
            materialType: bounty.rewardMaterialType
          });
        }
        payoutByPlayer.get(entry.playerId).materials += clampWholeNumber(entry.amount);
      });

      for (const [recipientId, payout] of payoutByPlayer.entries()) {
        await applyPlayerPayout(client, recipientId, payout);
      }

      await client.query(
        `UPDATE bounties
            SET status = 'completed',
                claimed_by_player_id = $2,
                claimed_at = NOW(),
                contributors = $3::jsonb
          WHERE id = $1`,
        [row.id, playerId, JSON.stringify(nextContributors)]
      );

      completed.push({
        bountyId: row.id,
        claimedBy: playerId,
        payout: payoutByPlayer.get(playerId) || {
          cash: 0,
          drugs: 0,
          materials: 0,
          drugType: bounty.rewardDrugType,
          materialType: bounty.rewardMaterialType
        }
      });
    }

    await client.query("COMMIT");
    return { claimed: completed };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function claimBountiesForOccupation({ playerId, targetUsername, districtId, gameMode = "war" }) {
  return resolveBounties({
    playerId,
    targetUsername,
    districtId,
    gameMode,
    resolutionType: "occupation",
    contributionValue: 100,
    capturedDistrict: true,
    attackSucceeded: true
  });
}

module.exports = {
  ensureBountySchema,
  listBounties,
  createBounty,
  resolveBounties,
  claimBountiesForOccupation,
  calculateBountyTotalValue,
  isHuntModeActive
};

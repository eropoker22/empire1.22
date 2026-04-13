const { pool } = require("../config/db");

let moneySchemaReady = false;

async function ensureMoneySchema() {
  if (moneySchemaReady) return;
  await pool.query(`
    ALTER TABLE players
      ADD COLUMN IF NOT EXISTS game_mode TEXT NOT NULL DEFAULT 'war',
      ADD COLUMN IF NOT EXISTS clean_money BIGINT NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS dirty_money BIGINT NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS district_income_dirty_remainder NUMERIC(10,2) NOT NULL DEFAULT 0
  `);
  await pool.query(`
    UPDATE players
       SET clean_money = COALESCE(clean_money, 0) + GREATEST(COALESCE(money, 0) - (COALESCE(clean_money, 0) + COALESCE(dirty_money, 0)), 0),
           dirty_money = COALESCE(dirty_money, 0),
           money = COALESCE(clean_money, 0) + COALESCE(dirty_money, 0) + GREATEST(COALESCE(money, 0) - (COALESCE(clean_money, 0) + COALESCE(dirty_money, 0)), 0)
  `);
  moneySchemaReady = true;
}

function normalizeMoneyRow(row) {
  const legacyMoney = Number(row?.money || 0);
  const cleanMoney = Number(row?.clean_money || 0);
  const dirtyMoney = Number(row?.dirty_money || 0);
  const totalMoney = cleanMoney + dirtyMoney || legacyMoney;
  return { cleanMoney, dirtyMoney, totalMoney };
}

function assertPositiveAmount(amount) {
  if (!Number.isInteger(amount) || amount < 0) {
    const error = new Error("invalid_money_amount");
    error.status = 400;
    throw error;
  }
}

async function spendPlayerMoney(client, { playerId, amount, preferDirty = false }) {
  assertPositiveAmount(amount);
  if (amount === 0) return { spentClean: 0, spentDirty: 0, cleanMoney: 0, dirtyMoney: 0, totalMoney: 0 };

  const playerRes = await client.query(
    `SELECT clean_money, dirty_money
       FROM players
      WHERE id = $1
      FOR UPDATE`,
    [playerId]
  );
  const row = playerRes.rows[0];
  if (!row) {
    const error = new Error("player_not_found");
    error.status = 404;
    throw error;
  }

  let cleanMoney = Number(row.clean_money || 0);
  let dirtyMoney = Number(row.dirty_money || 0);
  const totalMoney = cleanMoney + dirtyMoney;

  if (totalMoney < amount) {
    const error = new Error("insufficient_funds");
    error.status = 400;
    throw error;
  }

  let remaining = amount;
  let spentClean = 0;
  let spentDirty = 0;

  if (preferDirty) {
    spentDirty = Math.min(dirtyMoney, remaining);
    dirtyMoney -= spentDirty;
    remaining -= spentDirty;
    spentClean = remaining;
    cleanMoney -= spentClean;
  } else {
    spentClean = Math.min(cleanMoney, remaining);
    cleanMoney -= spentClean;
    remaining -= spentClean;
    spentDirty = remaining;
    dirtyMoney -= spentDirty;
  }

  await client.query(
    `UPDATE players
        SET clean_money = $1,
            dirty_money = $2,
            money = $3,
            updated_at = NOW()
      WHERE id = $4`,
    [cleanMoney, dirtyMoney, cleanMoney + dirtyMoney, playerId]
  );

  return {
    spentClean,
    spentDirty,
    cleanMoney,
    dirtyMoney,
    totalMoney: cleanMoney + dirtyMoney
  };
}

async function addCleanMoney(client, playerId, amount) {
  assertPositiveAmount(amount);
  await client.query(
    `UPDATE players
        SET clean_money = clean_money + $1,
            money = clean_money + dirty_money + $1,
            updated_at = NOW()
      WHERE id = $2`,
    [amount, playerId]
  );
}

async function addDirtyMoney(client, playerId, amount) {
  assertPositiveAmount(amount);
  await client.query(
    `UPDATE players
        SET dirty_money = dirty_money + $1,
            money = clean_money + dirty_money + $1,
            updated_at = NOW()
      WHERE id = $2`,
    [amount, playerId]
  );
}

module.exports = {
  ensureMoneySchema,
  normalizeMoneyRow,
  spendPlayerMoney,
  addCleanMoney,
  addDirtyMoney
};

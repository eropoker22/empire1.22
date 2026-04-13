const { pool } = require("../config/db");
const { normalizeGameMode } = require("../config/gameModes");
const {
  ensureMoneySchema,
  normalizeMoneyRow,
  spendPlayerMoney,
  addCleanMoney,
  addDirtyMoney
} = require("./moneyService");
const {
  ensureDrugSchema,
  getDrugInventoryFromRow,
  sumDrugInventory,
  toApiDrugInventory
} = require("./drugService");
const { DRUG_RESOURCE_COLUMN_MAP } = require("../config/drugs");
const MARKET_FEE_BPS = 500;

const RESOURCE_COLUMNS = {
  ...DRUG_RESOURCE_COLUMN_MAP,
  drugs: "drugs",
  weapons: "weapons",
  materials: "materials",
  data_shards: "data_shards"
};

let marketSchemaReady = false;

async function ensureMarketSchema() {
  if (marketSchemaReady) return;
  await ensureDrugSchema();
  await ensureMoneySchema();
  await pool.query(`
    ALTER TABLE players
      ADD COLUMN IF NOT EXISTS drugs INT NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS weapons INT NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS defense INT NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS materials INT NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS data_shards INT NOT NULL DEFAULT 0
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS market_orders (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
      resource_key TEXT NOT NULL,
      side TEXT NOT NULL CHECK (side IN ('buy', 'sell')),
      quantity INT NOT NULL CHECK (quantity > 0),
      remaining_quantity INT NOT NULL CHECK (remaining_quantity >= 0),
      price_per_unit INT NOT NULL CHECK (price_per_unit > 0),
      status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'filled', 'cancelled')),
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_market_orders_book
      ON market_orders (resource_key, side, status, price_per_unit, created_at)
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS market_trades (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      buy_order_id UUID NULL REFERENCES market_orders(id) ON DELETE SET NULL,
      sell_order_id UUID NULL REFERENCES market_orders(id) ON DELETE SET NULL,
      buyer_player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
      seller_player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
      resource_key TEXT NOT NULL,
      quantity INT NOT NULL CHECK (quantity > 0),
      price_per_unit INT NOT NULL CHECK (price_per_unit > 0),
      fee_paid INT NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_market_trades_resource_created
      ON market_trades (resource_key, created_at DESC)
  `);
  marketSchemaReady = true;
}

function assertValidResource(resourceKey) {
  if (!RESOURCE_COLUMNS[resourceKey]) {
    const error = new Error("invalid_resource");
    error.status = 400;
    throw error;
  }
}

function assertPositiveInt(value, field) {
  if (!Number.isInteger(value) || value <= 0) {
    const error = new Error(`invalid_${field}`);
    error.status = 400;
    throw error;
  }
}

function isSpecificDrugResource(resourceKey) {
  return Boolean(DRUG_RESOURCE_COLUMN_MAP[resourceKey]);
}

async function getMarketState(playerId, gameMode = "war") {
  const mode = normalizeGameMode(gameMode);
  await ensureMarketSchema();

  const balancesRes = await pool.query(
    `SELECT money, clean_money, dirty_money, weapons, materials, data_shards,
            drug_neon_dust, drug_pulse_shot, drug_velvet_smoke, drug_ghost_serum, drug_overdrive_x
       FROM players
      WHERE id = $1`,
    [playerId]
  );

  const orderBookRes = await pool.query(
    `SELECT mo.id, mo.resource_key, mo.side, mo.remaining_quantity, mo.price_per_unit,
            mo.created_at, p.username
       FROM market_orders mo
       JOIN players p ON p.id = mo.player_id AND p.game_mode = $1
      WHERE mo.status = 'open'
      ORDER BY mo.resource_key ASC,
               CASE WHEN mo.side = 'buy' THEN 0 ELSE 1 END ASC,
               CASE WHEN mo.side = 'buy' THEN mo.price_per_unit END DESC,
               CASE WHEN mo.side = 'sell' THEN mo.price_per_unit END ASC,
               mo.created_at ASC
      LIMIT 120`,
    [mode]
  );

  const myOrdersRes = await pool.query(
    `SELECT id, resource_key, side, quantity, remaining_quantity, price_per_unit, status, created_at
       FROM market_orders
      WHERE player_id = $1
        AND status = 'open'
      ORDER BY created_at DESC
      LIMIT 40`,
    [playerId]
  );

  const recentTradesRes = await pool.query(
    `SELECT mt.resource_key, mt.quantity, mt.price_per_unit, mt.fee_paid, mt.created_at
       FROM market_trades mt
       INNER JOIN players buyer ON buyer.id = mt.buyer_player_id AND buyer.game_mode = $1
       INNER JOIN players seller ON seller.id = mt.seller_player_id AND seller.game_mode = $1
      ORDER BY mt.created_at DESC
      LIMIT 40`,
    [mode]
  );

  const balances = balancesRes.rows[0] || {};
  const money = normalizeMoneyRow(balances);
  const drugInventory = getDrugInventoryFromRow(balances);
  const drugInventoryApi = toApiDrugInventory(drugInventory);
  const totalDrugs = sumDrugInventory(drugInventory);

  return {
    balances: {
      money: money.totalMoney,
      cleanMoney: money.cleanMoney,
      dirtyMoney: money.dirtyMoney,
      drugs: totalDrugs,
      drugInventory: drugInventoryApi,
      ...drugInventoryApi,
      weapons: Number(balances.weapons || 0),
      materials: Number(balances.materials || 0),
      dataShards: Number(balances.data_shards || 0)
    },
    orderBook: orderBookRes.rows.map((row) => ({
      id: row.id,
      resourceKey: row.resource_key,
      side: row.side,
      remainingQuantity: Number(row.remaining_quantity),
      pricePerUnit: Number(row.price_per_unit),
      username: row.username,
      createdAt: row.created_at
    })),
    myOrders: myOrdersRes.rows.map((row) => ({
      id: row.id,
      resourceKey: row.resource_key,
      side: row.side,
      quantity: Number(row.quantity),
      remainingQuantity: Number(row.remaining_quantity),
      pricePerUnit: Number(row.price_per_unit),
      status: row.status,
      createdAt: row.created_at
    })),
    recentTrades: recentTradesRes.rows.map((row) => ({
      resourceKey: row.resource_key,
      quantity: Number(row.quantity),
      pricePerUnit: Number(row.price_per_unit),
      feePaid: Number(row.fee_paid),
      createdAt: row.created_at
    })),
    marketFeePct: MARKET_FEE_BPS / 100
  };
}

async function createMarketOrder({ playerId, resourceKey, side, quantity, pricePerUnit }) {
  await ensureMarketSchema();
  assertValidResource(resourceKey);
  if (!["buy", "sell"].includes(side)) {
    const error = new Error("invalid_side");
    error.status = 400;
    throw error;
  }
  assertPositiveInt(quantity, "quantity");
  assertPositiveInt(pricePerUnit, "price");

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await reserveOrderEscrow(client, { playerId, resourceKey, side, quantity, pricePerUnit });

    const insertRes = await client.query(
      `INSERT INTO market_orders (player_id, resource_key, side, quantity, remaining_quantity, price_per_unit)
       VALUES ($1, $2, $3, $4, $4, $5)
       RETURNING id, player_id, resource_key, side, quantity, remaining_quantity, price_per_unit, status, created_at`,
      [playerId, resourceKey, side, quantity, pricePerUnit]
    );

    const order = insertRes.rows[0];
    await matchOrder(client, order);

    await client.query("COMMIT");
    return { ok: true };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function cancelMarketOrder({ playerId, orderId }) {
  await ensureMarketSchema();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const orderRes = await client.query(
      `SELECT id, player_id, resource_key, side, remaining_quantity, price_per_unit, status
         FROM market_orders
        WHERE id = $1
        FOR UPDATE`,
      [orderId]
    );
    const order = orderRes.rows[0];
    if (!order || order.player_id !== playerId) {
      const error = new Error("order_not_found");
      error.status = 404;
      throw error;
    }
    if (order.status !== "open") {
      const error = new Error("order_not_open");
      error.status = 400;
      throw error;
    }

    await refundOrderEscrow(client, order);
    await client.query(
      `UPDATE market_orders
          SET remaining_quantity = 0,
              status = 'cancelled',
              updated_at = NOW()
        WHERE id = $1`,
      [orderId]
    );

    await client.query("COMMIT");
    return { ok: true };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function reserveOrderEscrow(client, { playerId, resourceKey, side, quantity, pricePerUnit }) {
  const resourceColumn = RESOURCE_COLUMNS[resourceKey];
  const playerRes = await client.query(
    `SELECT clean_money, dirty_money, ${resourceColumn} AS resource
       FROM players
      WHERE id = $1
      FOR UPDATE`,
    [playerId]
  );
  const player = playerRes.rows[0];
  if (!player) {
    const error = new Error("player_not_found");
    error.status = 404;
    throw error;
  }

  if (side === "sell") {
    if (Number(player.resource) < quantity) {
      const error = new Error("insufficient_resource");
      error.status = 400;
      throw error;
    }
    const legacyDrugSync = isSpecificDrugResource(resourceKey)
      ? ", drugs = GREATEST(0, COALESCE(drugs, 0) - $1)"
      : "";
    await client.query(
      `UPDATE players
          SET ${resourceColumn} = ${resourceColumn} - $1,
              updated_at = NOW()
              ${legacyDrugSync}
        WHERE id = $2`,
      [quantity, playerId]
    );
    return;
  }

  const escrowCost = quantity * pricePerUnit;
  if (Number(player.clean_money || 0) + Number(player.dirty_money || 0) < escrowCost) {
    const error = new Error("insufficient_money");
    error.status = 400;
    throw error;
  }
  await spendPlayerMoney(client, { playerId, amount: escrowCost, preferDirty: false });
}

async function refundOrderEscrow(client, order) {
  const remainingQuantity = Number(order.remaining_quantity || 0);
  if (remainingQuantity <= 0) return;

  if (order.side === "sell") {
    const resourceColumn = RESOURCE_COLUMNS[order.resource_key];
    const legacyDrugSync = isSpecificDrugResource(order.resource_key)
      ? ", drugs = COALESCE(drugs, 0) + $1"
      : "";
    await client.query(
      `UPDATE players
          SET ${resourceColumn} = ${resourceColumn} + $1,
              updated_at = NOW()
              ${legacyDrugSync}
        WHERE id = $2`,
      [remainingQuantity, order.player_id]
    );
    return;
  }

  await addCleanMoney(client, order.player_id, remainingQuantity * Number(order.price_per_unit));
}

async function matchOrder(client, order) {
  let activeOrder = {
    ...order,
    remaining_quantity: Number(order.remaining_quantity),
    price_per_unit: Number(order.price_per_unit)
  };

  while (activeOrder.remaining_quantity > 0) {
    const counterRes = await client.query(
      activeOrder.side === "buy"
        ? `SELECT id, player_id, resource_key, side, remaining_quantity, price_per_unit, created_at
             FROM market_orders
            WHERE resource_key = $1
              AND side = 'sell'
              AND status = 'open'
              AND remaining_quantity > 0
              AND price_per_unit <= $2
              AND player_id <> $3
            ORDER BY price_per_unit ASC, created_at ASC
            LIMIT 1
            FOR UPDATE SKIP LOCKED`
        : `SELECT id, player_id, resource_key, side, remaining_quantity, price_per_unit, created_at
             FROM market_orders
            WHERE resource_key = $1
              AND side = 'buy'
              AND status = 'open'
              AND remaining_quantity > 0
              AND price_per_unit >= $2
              AND player_id <> $3
            ORDER BY price_per_unit DESC, created_at ASC
            LIMIT 1
            FOR UPDATE SKIP LOCKED`,
      [activeOrder.resource_key, activeOrder.price_per_unit, activeOrder.player_id]
    );

    const counter = counterRes.rows[0];
    if (!counter) break;

    const tradeQuantity = Math.min(
      activeOrder.remaining_quantity,
      Number(counter.remaining_quantity)
    );
    const executionPrice = Number(counter.price_per_unit);
    const buyerId = activeOrder.side === "buy" ? activeOrder.player_id : counter.player_id;
    const sellerId = activeOrder.side === "sell" ? activeOrder.player_id : counter.player_id;
    const resourceColumn = RESOURCE_COLUMNS[activeOrder.resource_key];
    const grossValue = tradeQuantity * executionPrice;
    const feePaid = Math.floor((grossValue * MARKET_FEE_BPS) / 10000);
    const sellerNet = grossValue - feePaid;
    const buyOrderId = activeOrder.side === "buy" ? activeOrder.id : counter.id;
    const sellOrderId = activeOrder.side === "sell" ? activeOrder.id : counter.id;

    const buyerLegacyDrugSync = isSpecificDrugResource(activeOrder.resource_key)
      ? ", drugs = COALESCE(drugs, 0) + $1"
      : "";

    await client.query(
      `UPDATE players
          SET ${resourceColumn} = ${resourceColumn} + $1,
              updated_at = NOW()
              ${buyerLegacyDrugSync}
        WHERE id = $2`,
      [tradeQuantity, buyerId]
    );
    await addDirtyMoney(client, sellerId, sellerNet);
    await client.query(
      `INSERT INTO economy_ledger (player_id, delta, reason)
       VALUES ($1, $2, $3)`,
      [sellerId, sellerNet, `market_trade_sell:${activeOrder.resource_key}`]
    );
    await client.query(
      `INSERT INTO market_trades (
         buy_order_id, sell_order_id, buyer_player_id, seller_player_id,
         resource_key, quantity, price_per_unit, fee_paid
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [buyOrderId, sellOrderId, buyerId, sellerId, activeOrder.resource_key, tradeQuantity, executionPrice, feePaid]
    );

    if (activeOrder.side === "buy" && activeOrder.price_per_unit > executionPrice) {
      await addCleanMoney(
        client,
        activeOrder.player_id,
        tradeQuantity * (activeOrder.price_per_unit - executionPrice)
      );
    }

    activeOrder.remaining_quantity -= tradeQuantity;
    const counterRemaining = Number(counter.remaining_quantity) - tradeQuantity;

    await client.query(
      `UPDATE market_orders
          SET remaining_quantity = $1,
              status = CASE WHEN $1 = 0 THEN 'filled' ELSE 'open' END,
              updated_at = NOW()
        WHERE id = $2`,
      [activeOrder.remaining_quantity, activeOrder.id]
    );
    await client.query(
      `UPDATE market_orders
          SET remaining_quantity = $1,
              status = CASE WHEN $1 = 0 THEN 'filled' ELSE 'open' END,
              updated_at = NOW()
        WHERE id = $2`,
      [counterRemaining, counter.id]
    );
  }
}

module.exports = {
  ensureMarketSchema,
  getMarketState,
  createMarketOrder,
  cancelMarketOrder,
  MARKET_FEE_BPS
};

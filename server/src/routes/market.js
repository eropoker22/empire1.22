const express = require("express");
const { auth } = require("../middleware/auth");
const {
  getMarketState,
  createMarketOrder,
  cancelMarketOrder
} = require("../services/marketService");
const { getRoomRegistry } = require("../ws/wsServer");
const { broadcastMarketUpdate } = require("../ws/wsHandlers");

const router = express.Router();

router.get("/", auth, async (req, res) => {
  try {
    const market = await getMarketState(req.user.id, req.gameMode);
    res.json(market);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message || "market_failed" });
  }
});

router.post("/orders", auth, async (req, res) => {
  try {
    const { resourceKey, side, quantity, pricePerUnit } = req.body || {};
    const result = await createMarketOrder({
      playerId: req.user.id,
      resourceKey,
      side,
      quantity: Number(quantity),
      pricePerUnit: Number(pricePerUnit)
    });
    broadcastMarketUpdate({
      rooms: getRoomRegistry(),
      gameMode: req.gameMode,
      update: { resourceKey, ts: Date.now() }
    });
    res.json(result);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message || "create_order_failed" });
  }
});

router.post("/orders/:id/cancel", auth, async (req, res) => {
  try {
    const result = await cancelMarketOrder({
      playerId: req.user.id,
      orderId: req.params.id
    });
    broadcastMarketUpdate({
      rooms: getRoomRegistry(),
      gameMode: req.gameMode,
      update: { orderId: req.params.id, ts: Date.now() }
    });
    res.json(result);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message || "cancel_order_failed" });
  }
});

module.exports = router;

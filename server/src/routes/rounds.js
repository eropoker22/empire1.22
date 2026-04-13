const express = require("express");
const { getRoundStatus } = require("../services/roundService");

const router = express.Router();

router.get("/status", async (req, res) => {
  const status = await getRoundStatus(req.gameMode);
  res.json(status);
});

module.exports = router;

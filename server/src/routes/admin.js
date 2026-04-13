const express = require("express");
const { getAdminDashboardPayload } = require("../services/adminDashboardService");

const router = express.Router();

router.get("/dashboard", async (req, res) => {
  try {
    const source = req.query?.source || "auto";
    const payload = await getAdminDashboardPayload({
      gameMode: req.gameMode,
      source
    });
    return res.json(payload);
  } catch (error) {
    return res.status(500).json({ error: "admin_dashboard_failed" });
  }
});

module.exports = router;

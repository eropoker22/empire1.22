const express = require("express");
const { auth } = require("../middleware/auth");
const { getPlayerProfile, setPlayerStructure, setPlayerGangColor } = require("../services/playerService");
const { createToken } = require("../services/authService");

const router = express.Router();

router.get("/me", auth, async (req, res) => {
  const profile = await getPlayerProfile(req.user.id);
  if (!profile) return res.status(404).json({ error: "not_found" });

  res.json({
    id: profile.id,
    username: profile.username,
    gangName: profile.gang_name,
    structure: profile.gang_structure || null,
    gangColor: profile.gang_color || null,
    money: Number(profile.clean_money || 0) + Number(profile.dirty_money || 0),
    cleanMoney: Number(profile.clean_money || 0),
    dirtyMoney: Number(profile.dirty_money || 0),
    influence: Number(profile.influence_points),
    raidMemberLosses: Math.max(0, Math.floor(Number(profile.raid_member_losses || 0))),
    heat: Number(profile.heat || 0),
    drugs: Number(profile.drugs || 0),
    drugInventory: profile.drugInventory || {},
    activeDrugs: profile.activeDrugs || {},
    alliance: profile.alliance_name,
    districts: Number(profile.district_count)
  });
});

router.post("/structure", auth, async (req, res) => {
  const { structure } = req.body || {};
  if (!structure) return res.status(400).json({ error: "missing_structure" });

  const saved = await setPlayerStructure(req.user.id, structure);
  const profile = await getPlayerProfile(req.user.id);
  const token = createToken({ ...profile, game_mode: req.user.gameMode || req.gameMode || "war" });
  res.json({ structure: saved, token });
});

router.post("/gang-color", auth, async (req, res) => {
  const { color } = req.body || {};
  const result = await setPlayerGangColor(req.user.id, color);
  if (!result?.ok) {
    if (result?.error === "invalid_color") return res.status(400).json({ error: "invalid_color" });
    if (result?.error === "gang_color_taken") return res.status(409).json({ error: "gang_color_taken" });
    if (result?.error === "not_found") return res.status(404).json({ error: "not_found" });
    return res.status(400).json({ error: "gang_color_update_failed" });
  }
  const profile = await getPlayerProfile(req.user.id);
  const token = createToken({ ...profile, game_mode: req.user.gameMode || req.gameMode || "war" });
  res.json({ gangColor: result.gangColor, token });
});

module.exports = router;

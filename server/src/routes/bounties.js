const express = require("express");
const { auth } = require("../middleware/auth");
const {
  listBounties,
  createBounty,
  resolveBounties,
  claimBountiesForOccupation
} = require("../services/bountyService");

const router = express.Router();

router.get("/", auth, async (req, res) => {
  try {
    const bounties = await listBounties(req.gameMode);
    return res.json({ ok: true, bounties });
  } catch (error) {
    return res.status(500).json({ error: "bounties_fetch_failed" });
  }
});

router.post("/", auth, async (req, res) => {
  const payload = req.body || {};
  const targetUsername = String(payload.targetUsername || "").trim();

  if (!targetUsername) {
    return res.status(400).json({ error: "missing_target" });
  }

  try {
    await createBounty({
      playerId: req.user.id,
      gameMode: req.gameMode,
      targetUsername,
      targetDistrictId: payload.targetDistrictId || null,
      rewardCash: payload.rewardCash,
      rewardDrugs: payload.rewardDrugs,
      rewardMaterials: payload.rewardMaterials,
      rewardDrugType: payload.rewardDrugType,
      rewardMaterialType: payload.rewardMaterialType,
      bountyType: payload.bountyType,
      isAnonymous: payload.isAnonymous,
      durationHours: payload.durationHours
    });
    const bounties = await listBounties(req.gameMode);
    return res.json({ ok: true, bounties });
  } catch (error) {
    const code = String(error?.code || "");
    if (code === "missing_target") return res.status(404).json({ error: code });
    if (["self_target", "allied_target", "invalid_target_district", "missing_rewards", "invalid_duration", "invalid_bounty_type", "invalid_reward_drug_type", "bounty_cooldown_active", "insufficient_clean_cash", "insufficient_drugs", "insufficient_materials"].includes(code)) {
      return res.status(error.status || 400).json({ error: code });
    }
    return res.status(500).json({ error: "bounty_create_failed" });
  }
});

router.post("/resolve", auth, async (req, res) => {
  const payload = req.body || {};
  const targetUsername = String(payload.targetUsername || "").trim();

  if (!targetUsername) {
    return res.status(400).json({ error: "missing_target" });
  }

  try {
    const result = await resolveBounties({
      playerId: req.user.id,
      gameMode: req.gameMode,
      targetUsername,
      districtId: payload.districtId || null,
      resolutionType: payload.resolutionType || "attack",
      contributionValue: payload.contributionValue,
      attackSucceeded: payload.attackSucceeded,
      capturedDistrict: payload.capturedDistrict
    });
    const bounties = await listBounties(req.gameMode);
    return res.json({
      ok: true,
      claimed: result.claimed || [],
      bounties
    });
  } catch (error) {
    return res.status(error.status || 500).json({ error: error.code || "bounty_resolve_failed" });
  }
});

router.post("/claim", auth, async (req, res) => {
  const { targetUsername, districtId = null } = req.body || {};
  if (!targetUsername) return res.status(400).json({ error: "missing_target" });

  try {
    const result = await claimBountiesForOccupation({
      playerId: req.user.id,
      gameMode: req.gameMode,
      targetUsername,
      districtId
    });
    const bounties = await listBounties();
    return res.json({
      ok: true,
      claimed: result.claimed || [],
      bounties
    });
  } catch (error) {
    return res.status(error.status || 500).json({ error: error.code || "bounty_claim_failed" });
  }
});

module.exports = router;

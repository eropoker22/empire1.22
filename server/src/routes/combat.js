const express = require("express");
const { auth } = require("../middleware/auth");
const { attackDistrict, raidDistrict } = require("../services/combatService");
const { listDistricts } = require("../services/districtService");
const { getRoomRegistry } = require("../ws/wsServer");
const { broadcastMapUpdate } = require("../ws/wsHandlers");

const router = express.Router();
const ATTACK_MARKER_DURATION_MS = 8 * 60 * 1000;
const RAID_MARKER_DURATION_MS = 8 * 60 * 1000;

router.post("/attack", auth, async (req, res) => {
  const { districtId } = req.body || {};
  if (!districtId) return res.status(400).json({ error: "missing_district" });

  try {
    const result = await attackDistrict({ playerId: req.user.id, districtId, gameMode: req.gameMode });
    if (!result.ok) {
      return res.status(400).json({
        error: result.error,
        cooldownMs: Number(result.cooldownMs || 0) > 0 ? Math.floor(Number(result.cooldownMs)) : 0,
        targetPlayerId: result.targetPlayerId ?? null
      });
    }
    const responsePayload = {
      message: result.message || (result.destroyed
        ? "District destroyed. It is now neutral and unusable."
        : (result.success ? "Attack succeeded." : "Attack failed.")),
      success: result.success,
      outcomeKey: result.outcomeKey || (result.destroyed ? "catastrophe" : (result.success ? "total_success" : "failure")),
      destroyed: Boolean(result.destroyed),
      influenceChange: result.influenceChange,
      heatGain: result.heatGain || 0,
      sourceDistrictId: result.sourceDistrictId ?? null,
      attackPower: result.attackPower || 0,
      defensePower: result.defensePower || 0,
      attackerLossPct: result.attackerLossPct || 0,
      defenderLossPct: result.defenderLossPct || 0,
      districtLossPct: result.districtLossPct || 0,
      newOwnerId: result.newOwnerId ?? null,
      newInfluence: result.newInfluence ?? null
    };

    res.json(responsePayload);

    void (async () => {
      try {
        const districts = await listDistricts(req.gameMode);
        broadcastMapUpdate({
          rooms: getRoomRegistry(),
          gameMode: req.gameMode,
          update: {
            districts,
            attackEvent: {
              targetDistrictId: districtId,
              sourceDistrictId: result.sourceDistrictId ?? null,
              durationMs: ATTACK_MARKER_DURATION_MS,
              source: "combat"
            }
          }
        });
      } catch (broadcastError) {
        console.error("Combat map broadcast failed", broadcastError);
      }
    })();
    return;
  } catch (err) {
    return res.status(500).json({ error: "attack_failed" });
  }
});

router.post("/raid", auth, async (req, res) => {
  const { districtId } = req.body || {};
  if (!districtId) return res.status(400).json({ error: "missing_district" });

  try {
    const result = await raidDistrict({ playerId: req.user.id, districtId, gameMode: req.gameMode });
    if (!result.ok) {
      return res.status(400).json({
        error: result.error,
        cooldownMs: Number(result.cooldownMs || 0) > 0 ? Math.floor(Number(result.cooldownMs)) : 0,
        districtLockMs: Number(result.districtLockMs || 0) > 0 ? Math.floor(Number(result.districtLockMs)) : 0
      });
    }

    const responsePayload = {
      outcomeKey: result.outcomeKey || "disaster",
      loot: result.loot || {},
      gangLoss: result.gangLoss || 0,
      targetAlerted: Boolean(result.targetAlerted),
      sourceDistrictId: result.sourceDistrictId ?? null,
      durationMs: Math.max(0, Math.floor(Number(result.durationMs || 0))),
      cooldownMs: Math.max(0, Math.floor(Number(result.cooldownMs || 0))),
      postActionCooldownMs: Math.max(0, Math.floor(Number(result.postActionCooldownMs || 0))),
      districtLockMs: Math.max(0, Math.floor(Number(result.districtLockMs || 0)))
    };
    res.json(responsePayload);

    void (async () => {
      try {
        const districts = await listDistricts(req.gameMode);
        broadcastMapUpdate({
          rooms: getRoomRegistry(),
          gameMode: req.gameMode,
          update: {
            districts,
            raidEvent: {
              targetDistrictId: districtId,
              sourceDistrictId: result.sourceDistrictId ?? null,
              durationMs: RAID_MARKER_DURATION_MS,
              source: "combat-raid"
            }
          }
        });
      } catch (broadcastError) {
        console.error("Raid map broadcast failed", broadcastError);
      }
    })();
    return;
  } catch (err) {
    return res.status(500).json({ error: "raid_failed" });
  }
});

module.exports = router;

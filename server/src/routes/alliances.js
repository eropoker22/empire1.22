const express = require("express");
const { auth } = require("../middleware/auth");
const {
  consumeAllianceNotifications,
  getAlliance,
  getAllianceIncomingInvites,
  createAlliance,
  joinAlliance,
  requestAllianceInvite,
  respondToAllianceInvite,
  sendAllianceInvite,
  respondToAllianceMemberInvite,
  markAllianceMemberReady,
  removeAllianceMember,
  startAllianceKickVote,
  castAllianceKickVote,
  leaveAlliance,
  listAlliances
} = require("../services/allianceService");

const router = express.Router();

router.get("/mine", auth, async (req, res) => {
  const alliance = await getAlliance(req.user.id);
  const incomingInvites = await getAllianceIncomingInvites(req.user.id);
  const notifications = await consumeAllianceNotifications(req.user.id);
  res.json({ alliance, incomingInvites, notifications });
});

router.get("/", auth, async (req, res) => {
  const alliances = await listAlliances(req.user.id, req.gameMode);
  res.json({ alliances });
});

router.post("/create", auth, async (req, res) => {
  const { name, description, iconKey } = req.body || {};
  if (!name) return res.status(400).json({ error: "missing_name" });

  try {
    const alliance = await createAlliance({ playerId: req.user.id, name, description, iconKey });
    res.json({ alliance });
  } catch (err) {
    res.status(400).json({ error: "create_failed" });
  }
});

router.post("/join", auth, async (req, res) => {
  const { allianceId } = req.body || {};
  if (!allianceId) return res.status(400).json({ error: "missing_alliance" });

  try {
    await joinAlliance({ playerId: req.user.id, allianceId });
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.code || "join_failed" });
  }
});

router.post("/invitations/request", auth, async (req, res) => {
  const { allianceId } = req.body || {};
  if (!allianceId) return res.status(400).json({ error: "missing_alliance" });

  try {
    const request = await requestAllianceInvite({ playerId: req.user.id, allianceId });
    res.json({ request });
  } catch (err) {
    res.status(400).json({ error: err.code || "request_failed" });
  }
});

router.post("/invitations/:requestId/respond", auth, async (req, res) => {
  const requestId = req.params.requestId;
  const accept = Boolean(req.body?.accept);
  if (!requestId) return res.status(400).json({ error: "missing_request" });

  try {
    const result = await respondToAllianceInvite({
      ownerPlayerId: req.user.id,
      requestId,
      accept
    });
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.code || "respond_failed" });
  }
});

router.post("/management/invite", auth, async (req, res) => {
  const username = String(req.body?.username || "").trim();
  if (!username) return res.status(400).json({ error: "missing_player" });

  try {
    const invite = await sendAllianceInvite({ ownerPlayerId: req.user.id, username });
    res.json({ invite });
  } catch (err) {
    res.status(400).json({ error: err.code || "invite_failed" });
  }
});

router.post("/member-invites/:inviteId/respond", auth, async (req, res) => {
  const inviteId = req.params.inviteId;
  const accept = Boolean(req.body?.accept);
  if (!inviteId) return res.status(400).json({ error: "missing_invite" });

  try {
    const result = await respondToAllianceMemberInvite({
      playerId: req.user.id,
      inviteId,
      accept
    });
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.code || "respond_failed" });
  }
});

router.post("/ready", auth, async (req, res) => {
  try {
    const result = await markAllianceMemberReady(req.user.id);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.code || "ready_failed" });
  }
});

router.post("/members/:memberId/remove", auth, async (req, res) => {
  try {
    const result = await removeAllianceMember({
      ownerPlayerId: req.user.id,
      memberPlayerId: req.params.memberId
    });
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.code || "remove_failed" });
  }
});

router.post("/kick-votes/start", auth, async (req, res) => {
  const targetPlayerId = req.body?.targetPlayerId;
  if (!targetPlayerId) return res.status(400).json({ error: "missing_member" });
  try {
    const result = await startAllianceKickVote({
      playerId: req.user.id,
      targetPlayerId
    });
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.code || "vote_start_failed" });
  }
});

router.post("/kick-votes/:voteId/cast", auth, async (req, res) => {
  try {
    const result = await castAllianceKickVote({
      playerId: req.user.id,
      voteId: req.params.voteId
    });
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.code || "vote_cast_failed" });
  }
});

router.post("/leave", auth, async (req, res) => {
  await leaveAlliance(req.user.id);
  res.json({ ok: true });
});

module.exports = router;

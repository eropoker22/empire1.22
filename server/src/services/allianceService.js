const { pool } = require("../config/db");
const ALLIANCE_MAX_MEMBERS = 4;
const ALLIANCE_READY_WINDOW_HOURS = 6;

async function ensureAllianceSchema() {
  await pool.query(`
    ALTER TABLE alliances
      ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT '',
      ADD COLUMN IF NOT EXISTS icon_key TEXT NOT NULL DEFAULT 'crown_skull'
  `);
  await pool.query(`
    ALTER TABLE players
      ADD COLUMN IF NOT EXISTS game_mode TEXT NOT NULL DEFAULT 'war'
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS alliance_join_requests (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      alliance_id UUID NOT NULL REFERENCES alliances(id) ON DELETE CASCADE,
      player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      UNIQUE (alliance_id, player_id)
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS alliance_member_invites (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      alliance_id UUID NOT NULL REFERENCES alliances(id) ON DELETE CASCADE,
      target_player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
      inviter_player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      UNIQUE (alliance_id, target_player_id)
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS alliance_notifications (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
      kind TEXT NOT NULL,
      message TEXT NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      read_at TIMESTAMP NULL
    )
  `);
  await pool.query(`
    ALTER TABLE players
      ADD COLUMN IF NOT EXISTS alliance_ready_at TIMESTAMP NULL
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS alliance_kick_votes (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      alliance_id UUID NOT NULL REFERENCES alliances(id) ON DELETE CASCADE,
      target_player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
      started_by_player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'open',
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      resolved_at TIMESTAMP NULL
    )
  `);
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_alliance_kick_votes_open_unique
      ON alliance_kick_votes (alliance_id, target_player_id)
      WHERE status = 'open'
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS alliance_kick_vote_ballots (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      vote_id UUID NOT NULL REFERENCES alliance_kick_votes(id) ON DELETE CASCADE,
      voter_player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      UNIQUE (vote_id, voter_player_id)
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS alliance_audit_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      alliance_id UUID NOT NULL REFERENCES alliances(id) ON DELETE CASCADE,
      actor_player_id UUID NULL REFERENCES players(id) ON DELETE SET NULL,
      target_player_id UUID NULL REFERENCES players(id) ON DELETE SET NULL,
      action_key TEXT NOT NULL,
      message TEXT NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
}

function computeAllianceReadyState(readyAt, now = Date.now()) {
  const readyTimestamp = readyAt ? new Date(readyAt).getTime() : 0;
  const windowMs = ALLIANCE_READY_WINDOW_HOURS * 60 * 60 * 1000;
  const dueAt = readyTimestamp ? readyTimestamp + windowMs : 0;
  return {
    readyAt: readyAt || null,
    readyDueAt: dueAt ? new Date(dueAt).toISOString() : null,
    isReadyWindowActive: Boolean(dueAt && dueAt > now),
    isReadyOverdue: !dueAt || dueAt <= now
  };
}

async function getAllianceContextForPlayer(playerId) {
  await ensureAllianceSchema();
  const res = await pool.query(
    `SELECT p.id AS player_id, p.alliance_id, p.alliance_ready_at,
            a.id AS alliance_id_resolved, a.owner_player_id, a.name
       FROM players p
       LEFT JOIN alliances a ON a.id = p.alliance_id
      WHERE p.id = $1`,
    [playerId]
  );
  return res.rows[0] || null;
}

async function createAllianceNotification(playerId, kind, message) {
  await pool.query(
    `INSERT INTO alliance_notifications (player_id, kind, message)
     VALUES ($1, $2, $3)`,
    [playerId, kind, message]
  );
}

async function appendAllianceAuditLog({ allianceId, actorPlayerId = null, targetPlayerId = null, actionKey, message }) {
  await pool.query(
    `INSERT INTO alliance_audit_logs (alliance_id, actor_player_id, target_player_id, action_key, message)
     VALUES ($1, $2, $3, $4, $5)`,
    [allianceId, actorPlayerId, targetPlayerId, actionKey, message]
  );
}

async function consumeAllianceNotifications(playerId) {
  await ensureAllianceSchema();
  const res = await pool.query(
    `SELECT id, kind, message, created_at
       FROM alliance_notifications
      WHERE player_id = $1
        AND read_at IS NULL
      ORDER BY created_at ASC`,
    [playerId]
  );
  if (res.rowCount) {
    await pool.query(
      `UPDATE alliance_notifications
          SET read_at = NOW()
        WHERE player_id = $1
          AND read_at IS NULL`,
      [playerId]
    );
  }
  return res.rows;
}

async function getAllianceIncomingInvites(playerId) {
  await ensureAllianceSchema();
  const res = await pool.query(
    `SELECT i.id, i.alliance_id, i.created_at, a.name AS alliance_name, a.icon_key, a.description,
            p.username AS inviter_username, p.gang_name AS inviter_gang_name
       FROM alliance_member_invites i
       INNER JOIN alliances a ON a.id = i.alliance_id
       INNER JOIN players p ON p.id = i.inviter_player_id
      WHERE i.target_player_id = $1
      ORDER BY i.created_at ASC`,
    [playerId]
  );
  return res.rows;
}

async function getAlliance(playerId) {
  await ensureAllianceSchema();
  const now = Date.now();
  const res = await pool.query(
    `SELECT a.id, a.name, a.owner_player_id, a.description, a.icon_key, a.bonus_income_pct, a.bonus_influence_pct
     FROM players p
     LEFT JOIN alliances a ON a.id = p.alliance_id
     WHERE p.id = $1`,
    [playerId]
  );
  const alliance = res.rows[0] || null;
  if (!alliance || !alliance.id) return null;

  const membersRes = await pool.query(
    `SELECT id, username, gang_name, gang_structure, gang_color, alliance_ready_at
       FROM players
      WHERE alliance_id = $1
      ORDER BY username ASC`,
    [alliance.id]
  );

  let pendingRequests = [];
  if (String(alliance.owner_player_id || "") === String(playerId || "")) {
    const pendingRes = await pool.query(
      `SELECT r.id, r.player_id, r.created_at, p.username, p.gang_name
         FROM alliance_join_requests r
         INNER JOIN players p ON p.id = r.player_id
        WHERE r.alliance_id = $1
        ORDER BY r.created_at ASC`,
      [alliance.id]
    );
    pendingRequests = pendingRes.rows;
  }

  const outgoingInvitesRes = await pool.query(
    `SELECT i.id, i.target_player_id, i.created_at, p.username, p.gang_name
       FROM alliance_member_invites i
       INNER JOIN players p ON p.id = i.target_player_id
      WHERE i.alliance_id = $1
      ORDER BY i.created_at ASC`,
    [alliance.id]
  );

  const openVotesRes = await pool.query(
    `SELECT v.id, v.target_player_id, v.started_by_player_id, v.created_at,
            target.username AS target_username, target.gang_name AS target_gang_name,
            COUNT(b.id)::int AS yes_votes
       FROM alliance_kick_votes v
       INNER JOIN players target ON target.id = v.target_player_id
       LEFT JOIN alliance_kick_vote_ballots b ON b.vote_id = v.id
      WHERE v.alliance_id = $1
        AND v.status = 'open'
      GROUP BY v.id, target.username, target.gang_name
      ORDER BY v.created_at ASC`,
    [alliance.id]
  );
  const auditRes = await pool.query(
    `SELECT id, action_key, message, created_at
       FROM alliance_audit_logs
      WHERE alliance_id = $1
      ORDER BY created_at DESC
      LIMIT 20`,
    [alliance.id]
  );

  const memberCount = membersRes.rowCount;
  const members = membersRes.rows.map((member) => ({
    ...member,
    role: String(member.id) === String(alliance.owner_player_id) ? "leader" : "member",
    ...computeAllianceReadyState(member.alliance_ready_at, now)
  }));

  const kickVotes = openVotesRes.rows.map((vote) => {
    const eligibleVoters = Math.max(memberCount - 1, 0);
    return {
      ...vote,
      eligible_voters: eligibleVoters,
      required_votes: Math.floor(eligibleVoters / 2) + 1
    };
  });

  return {
    ...alliance,
    current_player_role: String(alliance.owner_player_id) === String(playerId) ? "leader" : "member",
    current_player_ready: computeAllianceReadyState(
      membersRes.rows.find((member) => String(member.id) === String(playerId))?.alliance_ready_at,
      now
    ),
    members,
    member_count: memberCount,
    pending_requests: pendingRequests,
    outgoing_invites: outgoingInvitesRes.rows,
    kick_votes: kickVotes,
    audit_logs: auditRes.rows
  };
}

async function createAlliance({ playerId, name, description = "", iconKey = "crown_skull" }) {
  await ensureAllianceSchema();
  const res = await pool.query(
    `INSERT INTO alliances (name, owner_player_id, description, icon_key)
     VALUES ($1, $2, $3, $4)
     RETURNING id, name, description, icon_key, bonus_income_pct, bonus_influence_pct`,
    [name, playerId, String(description || "").trim(), String(iconKey || "crown_skull").trim() || "crown_skull"]
  );

  await pool.query(
    "UPDATE players SET alliance_id = $1 WHERE id = $2",
    [res.rows[0].id, playerId]
  );

  return res.rows[0];
}

async function joinAlliance({ playerId, allianceId }) {
  await ensureAllianceSchema();
  const allianceRes = await pool.query(
    `SELECT a.id, COUNT(p.id)::int AS member_count
       FROM alliances a
       LEFT JOIN players p ON p.alliance_id = a.id
      WHERE a.id = $1
      GROUP BY a.id`,
    [allianceId]
  );
  const alliance = allianceRes.rows[0] || null;
  if (!alliance?.id) {
    const error = new Error("missing_alliance");
    error.code = "missing_alliance";
    throw error;
  }
  if (Number(alliance.member_count || 0) >= ALLIANCE_MAX_MEMBERS) {
    const error = new Error("alliance_full");
    error.code = "alliance_full";
    throw error;
  }
  await pool.query(
    "UPDATE players SET alliance_id = $1, alliance_ready_at = NOW() WHERE id = $2",
    [allianceId, playerId]
  );
}

async function requestAllianceInvite({ playerId, allianceId }) {
  await ensureAllianceSchema();
  const playerRes = await pool.query(
    "SELECT alliance_id FROM players WHERE id = $1",
    [playerId]
  );
  if (playerRes.rows[0]?.alliance_id) {
    const error = new Error("already_in_alliance");
    error.code = "already_in_alliance";
    throw error;
  }

  const allianceRes = await pool.query(
    `SELECT a.id, a.owner_player_id, COUNT(p.id)::int AS member_count
       FROM alliances a
       LEFT JOIN players p ON p.alliance_id = a.id
      WHERE a.id = $1
      GROUP BY a.id`,
    [allianceId]
  );
  const alliance = allianceRes.rows[0] || null;
  if (!alliance?.id) {
    const error = new Error("missing_alliance");
    error.code = "missing_alliance";
    throw error;
  }
  if (String(alliance.owner_player_id || "") === String(playerId || "")) {
    const error = new Error("cannot_invite_self");
    error.code = "cannot_invite_self";
    throw error;
  }
  if (Number(alliance.member_count || 0) >= ALLIANCE_MAX_MEMBERS) {
    const error = new Error("alliance_full");
    error.code = "alliance_full";
    throw error;
  }

  try {
    const res = await pool.query(
      `INSERT INTO alliance_join_requests (alliance_id, player_id)
       VALUES ($1, $2)
       RETURNING id, alliance_id, player_id, created_at`,
      [allianceId, playerId]
    );
    const ownerRes = await pool.query(
      "SELECT owner_player_id, name FROM alliances WHERE id = $1",
      [allianceId]
    );
    const owner = ownerRes.rows[0];
    if (owner?.owner_player_id) {
      await createAllianceNotification(
        owner.owner_player_id,
        "join_request",
        "Do tve aliance prisla nova zadost o vstup."
      );
    }
    await appendAllianceAuditLog({
      allianceId,
      actorPlayerId: playerId,
      actionKey: "join_request_sent",
      message: "Byla odeslana zadost o vstup do aliance."
    });
    return res.rows[0];
  } catch {
    const error = new Error("request_pending");
    error.code = "request_pending";
    throw error;
  }
}

async function respondToAllianceInvite({ ownerPlayerId, requestId, accept }) {
  await ensureAllianceSchema();
  const reqRes = await pool.query(
    `SELECT r.id, r.alliance_id, r.player_id, a.owner_player_id
       FROM alliance_join_requests r
       INNER JOIN alliances a ON a.id = r.alliance_id
      WHERE r.id = $1`,
    [requestId]
  );
  const request = reqRes.rows[0] || null;
  if (!request?.id) {
    const error = new Error("missing_request");
    error.code = "missing_request";
    throw error;
  }
  if (String(request.owner_player_id || "") !== String(ownerPlayerId || "")) {
    const error = new Error("not_alliance_owner");
    error.code = "not_alliance_owner";
    throw error;
  }

  if (accept) {
    const allianceRes = await pool.query(
      `SELECT COUNT(p.id)::int AS member_count
         FROM alliances a
         LEFT JOIN players p ON p.alliance_id = a.id
        WHERE a.id = $1
        GROUP BY a.id`,
      [request.alliance_id]
    );
    if (Number(allianceRes.rows[0]?.member_count || 0) >= ALLIANCE_MAX_MEMBERS) {
      const error = new Error("alliance_full");
      error.code = "alliance_full";
      throw error;
    }
    await pool.query(
      "UPDATE players SET alliance_id = $1, alliance_ready_at = NOW() WHERE id = $2",
      [request.alliance_id, request.player_id]
    );
    await pool.query(
      "DELETE FROM alliance_join_requests WHERE player_id = $1",
      [request.player_id]
    );
    await createAllianceNotification(
      request.player_id,
      "join_request_accepted",
      "Tva zadost o vstup do aliance byla prijata."
    );
    await appendAllianceAuditLog({
      allianceId: request.alliance_id,
      actorPlayerId: ownerPlayerId,
      targetPlayerId: request.player_id,
      actionKey: "join_request_accepted",
      message: "Leader prijal zadost o vstup do aliance."
    });
    return { ok: true, status: "accepted" };
  }

  await pool.query(
    "DELETE FROM alliance_join_requests WHERE id = $1",
    [request.id]
  );
  await createAllianceNotification(
    request.player_id,
    "join_request_rejected",
    "Tva zadost o vstup do aliance byla odmitnuta."
  );
  await appendAllianceAuditLog({
    allianceId: request.alliance_id,
    actorPlayerId: ownerPlayerId,
    targetPlayerId: request.player_id,
    actionKey: "join_request_rejected",
    message: "Leader odmitl zadost o vstup do aliance."
  });
  return { ok: true, status: "rejected" };
}

async function sendAllianceInvite({ ownerPlayerId, username }) {
  await ensureAllianceSchema();
  const ownerAllianceRes = await pool.query(
    `SELECT a.id, a.name, a.owner_player_id, COUNT(p.id)::int AS member_count
       FROM alliances a
       INNER JOIN players owner ON owner.alliance_id = a.id
       LEFT JOIN players p ON p.alliance_id = a.id
      WHERE owner.id = $1
      GROUP BY a.id`,
    [ownerPlayerId]
  );
  const alliance = ownerAllianceRes.rows[0] || null;
  if (!alliance?.id) {
    const error = new Error("no_active_alliance");
    error.code = "no_active_alliance";
    throw error;
  }
  if (String(alliance.owner_player_id || "") !== String(ownerPlayerId || "")) {
    const error = new Error("not_alliance_owner");
    error.code = "not_alliance_owner";
    throw error;
  }
  if (Number(alliance.member_count || 0) >= ALLIANCE_MAX_MEMBERS) {
    const error = new Error("alliance_full");
    error.code = "alliance_full";
    throw error;
  }

  const playerRes = await pool.query(
    `SELECT id, alliance_id, username
       FROM players
      WHERE LOWER(username) = LOWER($1)
      LIMIT 1`,
    [username]
  );
  const target = playerRes.rows[0] || null;
  if (!target?.id) {
    const error = new Error("missing_player");
    error.code = "missing_player";
    throw error;
  }
  if (String(target.id) === String(ownerPlayerId || "")) {
    const error = new Error("cannot_invite_self");
    error.code = "cannot_invite_self";
    throw error;
  }
  if (target.alliance_id) {
    const error = new Error("player_has_alliance");
    error.code = "player_has_alliance";
    throw error;
  }

  try {
    const res = await pool.query(
      `INSERT INTO alliance_member_invites (alliance_id, target_player_id, inviter_player_id)
       VALUES ($1, $2, $3)
       RETURNING id, alliance_id, target_player_id, inviter_player_id, created_at`,
      [alliance.id, target.id, ownerPlayerId]
    );
    await createAllianceNotification(
      target.id,
      "alliance_invite",
      `Prisla ti pozvanka do aliance ${alliance.name}.`
    );
    await appendAllianceAuditLog({
      allianceId: alliance.id,
      actorPlayerId: ownerPlayerId,
      targetPlayerId: target.id,
      actionKey: "member_invite_sent",
      message: "Byla odeslana prima pozvanka do aliance."
    });
    return res.rows[0];
  } catch {
    const error = new Error("invite_pending");
    error.code = "invite_pending";
    throw error;
  }
}

async function respondToAllianceMemberInvite({ playerId, inviteId, accept }) {
  await ensureAllianceSchema();
  const inviteRes = await pool.query(
    `SELECT i.id, i.alliance_id, i.target_player_id, i.inviter_player_id, a.name AS alliance_name
       FROM alliance_member_invites i
       INNER JOIN alliances a ON a.id = i.alliance_id
      WHERE i.id = $1`,
    [inviteId]
  );
  const invite = inviteRes.rows[0] || null;
  if (!invite?.id) {
    const error = new Error("missing_invite");
    error.code = "missing_invite";
    throw error;
  }
  if (String(invite.target_player_id || "") !== String(playerId || "")) {
    const error = new Error("not_invite_target");
    error.code = "not_invite_target";
    throw error;
  }

  if (accept) {
    const playerRes = await pool.query(
      "SELECT alliance_id, username FROM players WHERE id = $1",
      [playerId]
    );
    if (playerRes.rows[0]?.alliance_id) {
      const error = new Error("already_in_alliance");
      error.code = "already_in_alliance";
      throw error;
    }
    const allianceRes = await pool.query(
      `SELECT COUNT(p.id)::int AS member_count
         FROM alliances a
         LEFT JOIN players p ON p.alliance_id = a.id
        WHERE a.id = $1
        GROUP BY a.id`,
      [invite.alliance_id]
    );
    if (Number(allianceRes.rows[0]?.member_count || 0) >= ALLIANCE_MAX_MEMBERS) {
      const error = new Error("alliance_full");
      error.code = "alliance_full";
      throw error;
    }
    await pool.query(
      "UPDATE players SET alliance_id = $1, alliance_ready_at = NOW() WHERE id = $2",
      [invite.alliance_id, playerId]
    );
    await pool.query(
      "DELETE FROM alliance_member_invites WHERE target_player_id = $1",
      [playerId]
    );
    await createAllianceNotification(
      invite.inviter_player_id,
      "invite_accepted",
      "Hrac prijal tvoji pozvanku do aliance."
    );
    await appendAllianceAuditLog({
      allianceId: invite.alliance_id,
      actorPlayerId: playerId,
      targetPlayerId: invite.target_player_id,
      actionKey: "member_invite_accepted",
      message: "Hrac prijal primou pozvanku do aliance."
    });
    return { ok: true, status: "accepted" };
  }

  await pool.query(
    "DELETE FROM alliance_member_invites WHERE id = $1",
    [invite.id]
  );
  await createAllianceNotification(
    invite.inviter_player_id,
    "invite_rejected",
    "Hrac odmitl tvoji pozvanku do aliance."
  );
  await appendAllianceAuditLog({
    allianceId: invite.alliance_id,
    actorPlayerId: playerId,
    targetPlayerId: invite.target_player_id,
    actionKey: "member_invite_rejected",
    message: "Hrac odmitl primou pozvanku do aliance."
  });
  return { ok: true, status: "rejected" };
}

async function markAllianceMemberReady(playerId) {
  await ensureAllianceSchema();
  const context = await getAllianceContextForPlayer(playerId);
  if (!context?.alliance_id) {
    const error = new Error("no_active_alliance");
    error.code = "no_active_alliance";
    throw error;
  }
  await pool.query(
    "UPDATE players SET alliance_ready_at = NOW() WHERE id = $1",
    [playerId]
  );
  await appendAllianceAuditLog({
    allianceId: context.alliance_id,
    actorPlayerId: playerId,
    targetPlayerId: playerId,
    actionKey: "member_ready",
    message: "Clen aliance potvrdil READY."
  });
  return { ok: true };
}

async function removeAllianceMember({ ownerPlayerId, memberPlayerId }) {
  await ensureAllianceSchema();
  const context = await getAllianceContextForPlayer(ownerPlayerId);
  if (!context?.alliance_id) {
    const error = new Error("no_active_alliance");
    error.code = "no_active_alliance";
    throw error;
  }
  if (String(context.owner_player_id || "") !== String(ownerPlayerId || "")) {
    const error = new Error("not_alliance_owner");
    error.code = "not_alliance_owner";
    throw error;
  }
  if (String(memberPlayerId || "") === String(ownerPlayerId || "")) {
    const error = new Error("cannot_remove_leader");
    error.code = "cannot_remove_leader";
    throw error;
  }
  const memberRes = await pool.query(
    "SELECT id, alliance_id, username FROM players WHERE id = $1",
    [memberPlayerId]
  );
  const member = memberRes.rows[0] || null;
  if (!member?.id || String(member.alliance_id || "") !== String(context.alliance_id || "")) {
    const error = new Error("missing_member");
    error.code = "missing_member";
    throw error;
  }
  await pool.query(
    "UPDATE players SET alliance_id = NULL, alliance_ready_at = NULL WHERE id = $1",
    [memberPlayerId]
  );
  await pool.query(
    "DELETE FROM alliance_kick_votes WHERE target_player_id = $1",
    [memberPlayerId]
  );
  await createAllianceNotification(
    memberPlayerId,
    "removed_from_alliance",
    "Byl jsi vyhozen z aliance."
  );
  await appendAllianceAuditLog({
    allianceId: context.alliance_id,
    actorPlayerId: ownerPlayerId,
    targetPlayerId: memberPlayerId,
    actionKey: "member_removed",
    message: "Leader vyhodil clena z aliance."
  });
  return { ok: true };
}

async function evaluateAllianceKickVote(voteId) {
  const voteRes = await pool.query(
    `SELECT v.id, v.alliance_id, v.target_player_id, target.username AS target_username,
            COUNT(ballots.id)::int AS yes_votes,
            COUNT(members.id)::int AS member_count
       FROM alliance_kick_votes v
       INNER JOIN players target ON target.id = v.target_player_id
       LEFT JOIN alliance_kick_vote_ballots ballots ON ballots.vote_id = v.id
       LEFT JOIN players members ON members.alliance_id = v.alliance_id
      WHERE v.id = $1
        AND v.status = 'open'
      GROUP BY v.id, target.username`,
    [voteId]
  );
  const vote = voteRes.rows[0] || null;
  if (!vote?.id) return { resolved: false };

  const eligibleVoters = Math.max(Number(vote.member_count || 0) - 1, 0);
  const requiredVotes = Math.floor(eligibleVoters / 2) + 1;
  if (Number(vote.yes_votes || 0) >= requiredVotes) {
    await pool.query(
      "UPDATE players SET alliance_id = NULL, alliance_ready_at = NULL WHERE id = $1",
      [vote.target_player_id]
    );
    await pool.query(
      "UPDATE alliance_kick_votes SET status = 'passed', resolved_at = NOW() WHERE id = $1",
      [vote.id]
    );
    await createAllianceNotification(
      vote.target_player_id,
      "kick_vote_passed",
      "Aliance odhlasovala tvoje vyhozeni."
    );
    await appendAllianceAuditLog({
      allianceId: vote.alliance_id,
      targetPlayerId: vote.target_player_id,
      actionKey: "kick_vote_passed",
      message: "Aliance odhlasovala vyhozeni clena."
    });
    return { resolved: true, status: "passed" };
  }
  return { resolved: false };
}

async function startAllianceKickVote({ playerId, targetPlayerId }) {
  await ensureAllianceSchema();
  const context = await getAllianceContextForPlayer(playerId);
  if (!context?.alliance_id) {
    const error = new Error("no_active_alliance");
    error.code = "no_active_alliance";
    throw error;
  }
  if (String(playerId || "") === String(targetPlayerId || "")) {
    const error = new Error("cannot_vote_self");
    error.code = "cannot_vote_self";
    throw error;
  }
  const targetRes = await pool.query(
    "SELECT id, alliance_id, username, alliance_ready_at FROM players WHERE id = $1",
    [targetPlayerId]
  );
  const target = targetRes.rows[0] || null;
  if (!target?.id || String(target.alliance_id || "") !== String(context.alliance_id || "")) {
    const error = new Error("missing_member");
    error.code = "missing_member";
    throw error;
  }
  if (String(target.id) === String(context.owner_player_id || "")) {
    const error = new Error("cannot_remove_leader");
    error.code = "cannot_remove_leader";
    throw error;
  }
  if (!computeAllianceReadyState(target.alliance_ready_at).isReadyOverdue) {
    const error = new Error("member_ready_active");
    error.code = "member_ready_active";
    throw error;
  }
  try {
    const voteRes = await pool.query(
      `INSERT INTO alliance_kick_votes (alliance_id, target_player_id, started_by_player_id)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [context.alliance_id, targetPlayerId, playerId]
    );
    const voteId = voteRes.rows[0].id;
    await pool.query(
      `INSERT INTO alliance_kick_vote_ballots (vote_id, voter_player_id)
       VALUES ($1, $2)`,
      [voteId, playerId]
    );
    await appendAllianceAuditLog({
      allianceId: context.alliance_id,
      actorPlayerId: playerId,
      targetPlayerId,
      actionKey: "kick_vote_started",
      message: "Bylo zahajeno hlasovani o vyhozeni clena."
    });
    await evaluateAllianceKickVote(voteId);
    return { ok: true, voteId };
  } catch {
    const error = new Error("vote_already_open");
    error.code = "vote_already_open";
    throw error;
  }
}

async function castAllianceKickVote({ playerId, voteId }) {
  await ensureAllianceSchema();
  const voteRes = await pool.query(
    `SELECT v.id, v.alliance_id, v.target_player_id, v.status
       FROM alliance_kick_votes v
       INNER JOIN players p ON p.alliance_id = v.alliance_id
      WHERE v.id = $1
        AND p.id = $2
      LIMIT 1`,
    [voteId, playerId]
  );
  const vote = voteRes.rows[0] || null;
  if (!vote?.id || vote.status !== "open") {
    const error = new Error("missing_vote");
    error.code = "missing_vote";
    throw error;
  }
  if (String(vote.target_player_id || "") === String(playerId || "")) {
    const error = new Error("cannot_vote_target");
    error.code = "cannot_vote_target";
    throw error;
  }
  try {
    await pool.query(
      `INSERT INTO alliance_kick_vote_ballots (vote_id, voter_player_id)
       VALUES ($1, $2)`,
      [voteId, playerId]
    );
  } catch {
    const error = new Error("vote_already_cast");
    error.code = "vote_already_cast";
    throw error;
  }
  await appendAllianceAuditLog({
    allianceId: vote.alliance_id,
    actorPlayerId: playerId,
    targetPlayerId: vote.target_player_id,
    actionKey: "kick_vote_cast",
    message: "Clen hlasoval pro vyhozeni."
  });
  return evaluateAllianceKickVote(voteId);
}

async function leaveAlliance(playerId) {
  await ensureAllianceSchema();
  await pool.query("UPDATE players SET alliance_id = NULL WHERE id = $1", [playerId]);
}

async function listAlliances(playerId = null, gameMode = "war") {
  await ensureAllianceSchema();
  const { normalizeGameMode } = require("../config/gameModes");
  const mode = normalizeGameMode(gameMode);
  const res = await pool.query(
    `SELECT a.id, a.name, a.owner_player_id, a.description, a.icon_key, a.bonus_income_pct, a.bonus_influence_pct,
            COUNT(p.id)::int AS member_count,
            EXISTS (
              SELECT 1
                FROM alliance_join_requests r
               WHERE r.alliance_id = a.id
                 AND r.player_id = $1
            ) AS has_pending_request
       FROM alliances a
       LEFT JOIN players p ON p.alliance_id = a.id
       INNER JOIN players owner ON owner.id = a.owner_player_id AND owner.game_mode = $2
      GROUP BY a.id
      ORDER BY member_count DESC, a.name ASC`,
    [playerId, mode]
  );
  return res.rows;
}

module.exports = {
  ensureAllianceSchema,
  consumeAllianceNotifications,
  getAlliance,
  getAllianceIncomingInvites,
  createAlliance,
  joinAlliance,
  requestAllianceInvite,
  respondToAllianceInvite,
  sendAllianceInvite,
  respondToAllianceMemberInvite,
  leaveAlliance,
  listAlliances
};

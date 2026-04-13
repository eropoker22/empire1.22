const { pool } = require("../config/db");
const { getGameModeConfig } = require("../config/gameModes");

const MOCK_SERVER_TEMPLATES = {
  war: [
    { id: "war-eu-1", name: "WAR-EU-1", status: "live", maxPlayers: 3000 },
    { id: "war-eu-2", name: "WAR-EU-2", status: "locked", maxPlayers: 3000 },
    { id: "war-us-1", name: "WAR-US-1", status: "maintenance", maxPlayers: 3000 }
  ],
  free: [
    { id: "free-eu-1", name: "FREE-EU-1", status: "live", maxPlayers: 3000 },
    { id: "free-eu-2", name: "FREE-EU-2", status: "live", maxPlayers: 3000 },
    { id: "free-us-1", name: "FREE-US-1", status: "maintenance", maxPlayers: 3000 }
  ]
};

async function ensurePlayerModeSchema() {
  await pool.query(`
    ALTER TABLE players
      ADD COLUMN IF NOT EXISTS game_mode TEXT NOT NULL DEFAULT 'war'
  `);
}

function toNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function pct(part, total) {
  if (!total) return 0;
  return Math.round((toNumber(part) / toNumber(total)) * 100);
}

function buildMockPayload(gameMode) {
  const templates = MOCK_SERVER_TEMPLATES[gameMode] || MOCK_SERVER_TEMPLATES.war;
  const now = new Date();
  const players = templates.flatMap((server, index) => (
    Array.from({ length: 6 }).map((_, offset) => {
      const idNum = (index + 1) * 100 + offset + 1;
      const heat = 40 + (index * 35) + (offset * 11);
      const reports = offset % 3;
      return {
        id: `P-${gameMode.toUpperCase()}-${idNum}`,
        nickname: `${gameMode}-player-${idNum}`,
        server: server.id,
        faction: ["Mafián", "Kartel", "Hackeři", "Motorkářský gang", "Pouliční gang", "Soukromá armáda"][offset % 6],
        alliance: `Alliance-${index + 1}`,
        districts: 35 + (offset * 9),
        cleanCash: 250000 + (offset * 32000),
        dirtyCash: 120000 + (offset * 18000),
        heat,
        online: offset % 2 === 0,
        lastActivity: offset % 2 === 0 ? "před 12s" : "před 8m",
        reports,
        suspicion: heat >= 250 || reports >= 4 ? "critical" : heat >= 120 || reports >= 2 ? "warning" : "none",
        profile: `Rank ${22 + offset} • Mock profil hráče.`,
        economy: `Clean +$${(42 + offset) * 1000}/h • Dirty +$${(21 + offset) * 1000}/h.`,
        districtInfo: "Test district line.",
        production: "Test production pipeline.",
        attacks: `${12 + offset} útoků / 24h.`,
        spyOps: `${4 + offset} špehování / 24h.`,
        heatHistory: `${Math.max(0, heat - 60)} → ${heat} dnes.`,
        lastLogs: "Mock audit log entry."
      };
    })
  ));

  const alliances = templates.map((server, index) => ({
    name: `Alliance-${index + 1}`,
    server: server.id,
    members: 16 + (index * 4),
    districts: 120 + (index * 27),
    dominance: 42 + (index * 12),
    power: 122000 + (index * 34000),
    cashFlow: `$${260 + (index * 70)}k/h`,
    conflicts: 3 + index,
    founded: "2026-03-01",
    status: index === 1 ? "High dominance alert" : "Stable"
  }));

  const dashboardByServer = {};
  templates.forEach((server, index) => {
    const basePlayers = 950 + (index * 370);
    const playersTrend = Array.from({ length: 12 }).map((_, trendIdx) => basePlayers + (trendIdx * (32 + index * 4)));
    const attacks24h = Array.from({ length: 12 }).map((_, trendIdx) => 16 + (trendIdx * (4 + index)));
    const clean = 4200000 + (index * 1400000);
    const dirty = 2200000 + (index * 900000);
    dashboardByServer[server.id] = {
      meta: {
        serverName: server.name,
        status: server.status.toUpperCase(),
        uptime: `${4 + index}d ${8 + index}h ${(10 + index) % 60}m`
      },
      playersTrend,
      attacks24h,
      clean,
      dirty,
      heat: [540 + index * 90, 290 + index * 64, 130 + index * 38, 62 + index * 22, 21 + index * 7],
      police: [6 + index * 2, 20 + index * 8, 12 + index * 3, 4 + index],
      alerts: [
        { severity: "critical", title: `${server.name}: Attack spike`, detail: "Nárůst útoků na clusteru districtů." },
        { severity: "warning", title: `${server.name}: Heat trend`, detail: "Heat tier 150+ stoupá posledních 30 minut." }
      ]
    };
  });

  return {
    source: "mock",
    mode: gameMode,
    generatedAt: now.toISOString(),
    defaultServerId: templates[0].id,
    servers: templates.map((server, index) => ({
      ...server,
      type: gameMode,
      players: dashboardByServer[server.id].playersTrend.at(-1) || 0,
      sessionLength: `${index + 1}d ${(8 + index).toString().padStart(2, "0")}h`,
      dominance: 41 + (index * 11),
      leader: alliances[index]?.name || "-"
    })),
    players,
    alliances,
    dashboardByServer
  };
}

function formatRelativeActivity(updatedAt) {
  if (!updatedAt) return "neznámá aktivita";
  const diffMs = Date.now() - new Date(updatedAt).getTime();
  const diffSec = Math.max(0, Math.floor(diffMs / 1000));
  if (diffSec < 60) return `před ${diffSec}s`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `před ${diffMin}m`;
  const diffHour = Math.floor(diffMin / 60);
  return `před ${diffHour}h`;
}

function splitAcrossServers(total, serverCount, minFloor = 0) {
  const count = Math.max(1, toNumber(serverCount, 1));
  const base = Math.floor(total / count);
  const result = Array.from({ length: count }).map(() => Math.max(minFloor, base));
  let used = result.reduce((acc, value) => acc + value, 0);
  let idx = 0;
  while (used < total) {
    result[idx % count] += 1;
    used += 1;
    idx += 1;
  }
  return result;
}

async function buildLivePayload(gameMode) {
  await ensurePlayerModeSchema();

  const modeConfig = getGameModeConfig(gameMode);
  const modeServers = (MOCK_SERVER_TEMPLATES[gameMode] || []).map((server, index) => ({
    ...server,
    fallbackName: modeConfig.servers[index]?.name || server.name
  }));

  const [playersAggRes, attacksRes, heatRes, alliancesRes, playersRes, alliancesBoardRes] = await Promise.all([
    pool.query(
      `SELECT COUNT(*)::int AS total_players,
              COALESCE(SUM(clean_money), 0)::bigint AS clean_total,
              COALESCE(SUM(dirty_money), 0)::bigint AS dirty_total
       FROM players
       WHERE game_mode = $1`,
      [gameMode]
    ),
    pool.query(
      `SELECT date_trunc('hour', c.created_at) AS hour_bucket,
              COUNT(*)::int AS attacks_count
         FROM combat_logs c
         JOIN players p ON p.id = c.attacker_player_id
        WHERE p.game_mode = $1
          AND c.created_at >= NOW() - INTERVAL '24 hours'
        GROUP BY hour_bucket
        ORDER BY hour_bucket ASC`,
      [gameMode]
    ),
    pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE heat < 25)::int AS tier_0_24,
         COUNT(*) FILTER (WHERE heat >= 25 AND heat < 75)::int AS tier_25_74,
         COUNT(*) FILTER (WHERE heat >= 75 AND heat < 150)::int AS tier_75_149,
         COUNT(*) FILTER (WHERE heat >= 150 AND heat < 300)::int AS tier_150_299,
         COUNT(*) FILTER (WHERE heat >= 300)::int AS tier_300_plus
       FROM players
       WHERE game_mode = $1`,
      [gameMode]
    ),
    pool.query(
      `SELECT a.id, a.name, a.created_at,
              COUNT(p.id)::int AS members,
              COALESCE(SUM(p.clean_money + p.dirty_money), 0)::bigint AS total_money
         FROM alliances a
         LEFT JOIN players p ON p.alliance_id = a.id AND p.game_mode = $1
        GROUP BY a.id, a.name, a.created_at
        ORDER BY members DESC, total_money DESC
        LIMIT 24`,
      [gameMode]
    ),
    pool.query(
      `SELECT p.id, p.username, p.gang_name, p.clean_money, p.dirty_money, p.heat, p.updated_at,
              COALESCE(a.name, 'Bez aliance') AS alliance_name,
              COALESCE((SELECT COUNT(*) FROM districts d WHERE d.owner_player_id = p.id), 0)::int AS district_count,
              COALESCE((SELECT COUNT(*) FROM bounties b WHERE b.target_player_id = p.id AND b.status = 'active'), 0)::int AS report_count
         FROM players p
         LEFT JOIN alliances a ON a.id = p.alliance_id
        WHERE p.game_mode = $1
        ORDER BY district_count DESC, (p.clean_money + p.dirty_money) DESC
        LIMIT 120`,
      [gameMode]
    ),
    pool.query(
      `SELECT a.id, a.name, a.created_at,
              COUNT(p.id)::int AS members,
              COALESCE(SUM(p.clean_money + p.dirty_money), 0)::bigint AS total_money,
              COALESCE(SUM(CASE WHEN d.owner_player_id IS NOT NULL THEN 1 ELSE 0 END), 0)::int AS district_count
         FROM alliances a
         LEFT JOIN players p ON p.alliance_id = a.id AND p.game_mode = $1
         LEFT JOIN districts d ON d.owner_player_id = p.id
        GROUP BY a.id, a.name, a.created_at
        ORDER BY district_count DESC, members DESC
        LIMIT 16`,
      [gameMode]
    )
  ]);

  const playersAgg = playersAggRes.rows[0] || {};
  const totalPlayers = toNumber(playersAgg.total_players, 0);
  const cleanTotal = toNumber(playersAgg.clean_total, 0);
  const dirtyTotal = toNumber(playersAgg.dirty_total, 0);

  const templates = modeServers.length ? modeServers : (MOCK_SERVER_TEMPLATES[gameMode] || MOCK_SERVER_TEMPLATES.war);
  const splitPlayers = splitAcrossServers(totalPlayers, templates.length, 0);

  const topAllianceName = alliancesRes.rows[0]?.name || "-";
  const topAllianceMembers = toNumber(alliancesRes.rows[0]?.members, 0);
  const servers = templates.map((template, index) => {
    const playersCount = splitPlayers[index] || 0;
    const maxPlayers = toNumber(template.maxPlayers, 3000);
    const dominance = Math.min(96, Math.max(0, pct(playersCount, Math.max(maxPlayers, 1))));
    return {
      id: template.id,
      name: template.name || template.fallbackName || `SERVER-${index + 1}`,
      type: gameMode,
      status: playersCount === 0 ? "maintenance" : template.status || "live",
      players: playersCount,
      maxPlayers,
      sessionLength: gameMode === "free" ? `${20 + index * 5}m` : `${1 + index}d ${10 + index}h`,
      dominance,
      leader: topAllianceMembers > 0 ? topAllianceName : "-"
    };
  });

  const attackByHour = new Map(attacksRes.rows.map((row) => [new Date(row.hour_bucket).toISOString(), toNumber(row.attacks_count, 0)]));
  const last24h = Array.from({ length: 24 }).map((_, idx) => {
    const date = new Date(Date.now() - (23 - idx) * 60 * 60 * 1000);
    date.setMinutes(0, 0, 0);
    return date.toISOString();
  });
  const attacks24h = last24h.map((key) => attackByHour.get(key) || 0);
  const playersTrend = splitAcrossServers(totalPlayers, 12).map((value, idx) => Math.max(0, value + (idx * Math.max(1, Math.round(totalPlayers * 0.01)))));

  const heatRow = heatRes.rows[0] || {};
  const heat = [
    toNumber(heatRow.tier_0_24, 0),
    toNumber(heatRow.tier_25_74, 0),
    toNumber(heatRow.tier_75_149, 0),
    toNumber(heatRow.tier_150_299, 0),
    toNumber(heatRow.tier_300_plus, 0)
  ];
  const police = [
    toNumber(Math.round(heat[3] * 0.18 + heat[4] * 0.45), 0),
    toNumber(Math.round(attacks24h.slice(-6).reduce((acc, x) => acc + x, 0) * 0.4), 0),
    toNumber(Math.round((dirtyTotal / 100000) * 0.07), 0),
    toNumber(Math.round((alliancesBoardRes.rows.length || 1) * 1.5), 0)
  ];

  const alerts = [];
  if (attacks24h.slice(-3).reduce((acc, x) => acc + x, 0) >= 40) {
    alerts.push({ severity: "critical", title: "Attack spike", detail: "Výrazný nárůst útoků za poslední 3 hodiny." });
  }
  if (heat[4] >= 10) {
    alerts.push({ severity: "critical", title: "Heat 300+ trend", detail: `${heat[4]} hráčů překročilo tier 300+.` });
  }
  if (dirtyTotal > cleanTotal) {
    alerts.push({ severity: "warning", title: "Dirty cash dominance", detail: "Dirty cash převyšuje clean cash flow." });
  }
  if (!alerts.length) {
    alerts.push({ severity: "warning", title: "Stabilní stav", detail: "Aktuálně bez kritických incidentů." });
  }

  const players = playersRes.rows.map((row, index) => {
    const reports = toNumber(row.report_count, 0);
    const heatValue = toNumber(row.heat, 0);
    const suspicion = heatValue >= 300 || reports >= 4 ? "critical" : heatValue >= 150 || reports >= 2 ? "warning" : "none";
    const server = servers[index % servers.length]?.id || servers[0]?.id || `${gameMode}-eu-1`;
    return {
      id: row.id,
      nickname: row.username,
      server,
      faction: row.gang_name || "Bez frakce",
      alliance: row.alliance_name || "Bez aliance",
      districts: toNumber(row.district_count, 0),
      cleanCash: toNumber(row.clean_money, 0),
      dirtyCash: toNumber(row.dirty_money, 0),
      heat: heatValue,
      online: (Date.now() - new Date(row.updated_at).getTime()) < (5 * 60 * 1000),
      lastActivity: formatRelativeActivity(row.updated_at),
      reports,
      suspicion,
      profile: `Profil ${row.username}`,
      economy: `Clean +$${Math.max(1, Math.round(toNumber(row.clean_money, 0) * 0.01))}/h • Dirty +$${Math.max(1, Math.round(toNumber(row.dirty_money, 0) * 0.01))}/h.`,
      districtInfo: `${toNumber(row.district_count, 0)} districtů pod kontrolou.`,
      production: "Live snapshot z DB.",
      attacks: `${reports + Math.max(1, Math.round(heatValue / 30))} útoků / 24h.`,
      spyOps: `${Math.max(0, Math.round(heatValue / 80))} špehování / 24h.`,
      heatHistory: `${Math.max(0, heatValue - 35)} → ${heatValue} dnes.`,
      lastLogs: `Aktualizace ${formatRelativeActivity(row.updated_at)}`
    };
  });

  const allDistrictsInAlliances = alliancesBoardRes.rows.reduce((acc, row) => acc + toNumber(row.district_count, 0), 0);
  const alliances = alliancesBoardRes.rows.map((row, index) => {
    const dominance = allDistrictsInAlliances > 0
      ? pct(toNumber(row.district_count, 0), allDistrictsInAlliances)
      : pct(toNumber(row.members, 0), Math.max(1, totalPlayers));
    const server = servers[index % servers.length]?.id || servers[0]?.id || `${gameMode}-eu-1`;
    return {
      name: row.name,
      server,
      members: toNumber(row.members, 0),
      districts: toNumber(row.district_count, 0),
      dominance,
      power: toNumber(row.total_money, 0),
      cashFlow: `$${Math.max(0, Math.round(toNumber(row.total_money, 0) * 0.02)).toLocaleString("cs-CZ")}/h`,
      conflicts: Math.max(0, Math.round(dominance / 7)),
      founded: row.created_at ? new Date(row.created_at).toISOString().slice(0, 10) : "N/A",
      status: dominance >= 70 ? "High dominance alert" : "Stable"
    };
  });

  const dashboardByServer = {};
  servers.forEach((server, index) => {
    const skew = Math.max(0.75, 1 - (index * 0.12));
    dashboardByServer[server.id] = {
      meta: {
        serverName: server.name,
        status: String(server.status || "maintenance").toUpperCase(),
        uptime: gameMode === "free" ? `${1 + index}d ${5 + index}h` : `${8 + index}d ${10 + index}h`
      },
      playersTrend: playersTrend.map((value) => Math.max(0, Math.round(value * skew))),
      attacks24h: attacks24h.slice(-12).map((value) => Math.max(0, Math.round(value * skew))),
      clean: Math.round(cleanTotal * skew),
      dirty: Math.round(dirtyTotal * skew),
      heat: heat.map((value) => Math.max(0, Math.round(value * skew))),
      police: police.map((value) => Math.max(0, Math.round(value * skew))),
      alerts
    };
  });

  return {
    source: "live",
    mode: gameMode,
    generatedAt: new Date().toISOString(),
    defaultServerId: servers[0]?.id || `${gameMode}-eu-1`,
    servers,
    players,
    alliances,
    dashboardByServer
  };
}

async function getAdminDashboardPayload({ gameMode, source = "auto" }) {
  const normalizedSource = ["auto", "live", "mock"].includes(String(source).toLowerCase())
    ? String(source).toLowerCase()
    : "auto";

  if (normalizedSource === "mock") {
    return buildMockPayload(gameMode);
  }

  if (normalizedSource === "live") {
    return buildLivePayload(gameMode);
  }

  try {
    return await buildLivePayload(gameMode);
  } catch (error) {
    const fallback = buildMockPayload(gameMode);
    return {
      ...fallback,
      source: "mock",
      liveError: "Live data unavailable, fallback to mock"
    };
  }
}

module.exports = {
  getAdminDashboardPayload
};

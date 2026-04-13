const { pool } = require("../config/db");
const { getGameModeConfig, normalizeGameMode } = require("../config/gameModes");

const PHASE_KEYS = Object.freeze(["day", "night"]);

function resolveRoundPhase(startedAtValue, phaseDurationMs, nowValue = Date.now()) {
  const startedAtMs = new Date(startedAtValue).getTime();
  const nowMs = Number.isFinite(Number(nowValue)) ? Number(nowValue) : Date.now();
  const elapsedMs = Math.max(0, nowMs - startedAtMs);
  const phaseIndex = Math.floor(elapsedMs / phaseDurationMs);
  const phaseKey = PHASE_KEYS[phaseIndex % PHASE_KEYS.length] || "day";
  const phaseLabel = phaseKey === "day" ? "DEN" : "NOC";
  const phaseStartedAtMs = startedAtMs + phaseIndex * phaseDurationMs;
  const phaseEndsAtMs = phaseStartedAtMs + phaseDurationMs;
  const currentGameDay = Math.floor(elapsedMs / (phaseDurationMs * 2)) + 1;
  return {
    phaseKey,
    phaseLabel,
    phaseStartedAt: new Date(phaseStartedAtMs),
    phaseEndsAt: new Date(phaseEndsAtMs),
    currentGameDay
  };
}

function resolveRoundClock(startedAtValue, gameMinutesPerRealMinute, gameClockStartHour, nowValue = Date.now()) {
  const startedAtMs = new Date(startedAtValue).getTime();
  const nowMs = Number.isFinite(Number(nowValue)) ? Number(nowValue) : Date.now();
  const elapsedMs = Math.max(0, nowMs - startedAtMs);
  const elapsedGameMinutes = Math.floor((elapsedMs / (60 * 1000)) * gameMinutesPerRealMinute);
  const totalMinutes = gameClockStartHour * 60 + elapsedGameMinutes;
  const minutesInDay = ((totalMinutes % 1440) + 1440) % 1440;
  const hours = Math.floor(minutesInDay / 60);
  const minutes = minutesInDay % 60;
  return {
    minutesInDay,
    hours,
    minutes,
    label: `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`
  };
}

async function ensureRoundSchema() {
  await pool.query(`
    ALTER TABLE rounds
      ADD COLUMN IF NOT EXISTS game_mode TEXT NOT NULL DEFAULT 'war'
  `);
}

async function getOrCreateActiveRound(gameMode = "war") {
  const mode = normalizeGameMode(gameMode);
  const modeConfig = getGameModeConfig(mode);
  await ensureRoundSchema();
  const res = await pool.query("SELECT * FROM rounds WHERE active = true AND game_mode = $1 ORDER BY started_at DESC LIMIT 1", [mode]);
  if (res.rowCount > 0) return res.rows[0];

  const startedAt = new Date();
  const endsAt = new Date(startedAt.getTime() + modeConfig.roundDurationHours * 60 * 60 * 1000);
  const insert = await pool.query(
    "INSERT INTO rounds (started_at, ends_at, active, game_mode) VALUES ($1, $2, true, $3) RETURNING *",
    [startedAt, endsAt, mode]
  );

  return insert.rows[0];
}

async function getRoundStatus(gameMode = "war") {
  const mode = normalizeGameMode(gameMode);
  const modeConfig = getGameModeConfig(mode);
  const round = await getOrCreateActiveRound(mode);
  const now = new Date();
  const endsAt = new Date(round.ends_at);
  const msLeft = Math.max(0, endsAt - now);
  const daysRemaining = Math.ceil(msLeft / (24 * 60 * 60 * 1000));
  const hoursRemaining = Math.ceil(msLeft / (60 * 60 * 1000));
  const phaseDurationMs = modeConfig.phaseDurationHours * 60 * 60 * 1000;
  const phase = resolveRoundPhase(round.started_at, phaseDurationMs, now.getTime());
  const clock = resolveRoundClock(round.started_at, modeConfig.gameDaysPerRealDay, modeConfig.gameClockStartHour, now.getTime());
  const totalGameDays = Math.max(1, Math.round(modeConfig.roundDurationDays * modeConfig.gameDaysPerRealDay));
  const roundRemainingLabel = modeConfig.roundDurationHours < 24
    ? `${hoursRemaining}h`
    : `${daysRemaining}d`;

  return {
    roundStartedAt: round.started_at,
    roundEndsAt: round.ends_at,
    daysRemaining,
    hoursRemaining,
    roundRemainingLabel,
    currentPhaseKey: phase.phaseKey,
    currentPhaseLabel: phase.phaseLabel,
    currentSubPhaseKey: null,
    currentSubPhaseLabel: null,
    phaseEndsAt: phase.phaseEndsAt,
    phaseDurationMs,
    currentGameDay: Math.min(totalGameDays, phase.currentGameDay),
    totalGameDays,
    currentGameTimeLabel: clock.label,
    currentGameMinutesInDay: clock.minutesInDay,
    gameClockStartHour: modeConfig.gameClockStartHour,
    gameMinutesPerRealMinute: modeConfig.gameDaysPerRealDay,
    gameMode: mode
  };
}

module.exports = { getRoundStatus, getOrCreateActiveRound };

const GAME_MODES = Object.freeze({
  war: Object.freeze({
    key: "war",
    label: "WAR",
    displayName: "Placená verze",
    routeSlug: "war",
    roundDurationDays: 10,
    roundDurationHours: 240,
    incomeTickMinutes: 60,
    attackCooldownSeconds: 30,
    attackActionDurationSeconds: 20,
    raidCooldownSeconds: 30,
    raidActionDurationSeconds: 20,
    mapSeed: "empire-city-war-v1",
    phaseDurationHours: 4,
    gameDaysPerRealDay: 3,
    gameClockStartHour: 6,
    maxInfluence: 100,
    maxPlayers: 200,
    loginAccent: "#22d3ee",
    loginAccentAlt: "#f472b6",
    loginSurface: "rgba(12, 18, 32, 0.7)",
    loginSurfaceStrong: "rgba(7, 8, 15, 0.94)",
    servers: [
      { key: "war-alpha", name: "Iron Crown", subtitle: "Stabilní war server pro hlavní progres.", capacity: 180 },
      { key: "war-bravo", name: "Black Neon", subtitle: "Vyšší tlak, víc konfliktů a rychlejší akce.", capacity: 220 },
      { key: "war-charlie", name: "Grave District", subtitle: "Server pro tvrdší ekonomickou válku.", capacity: 200 }
    ]
  }),
  free: Object.freeze({
    key: "free",
    label: "FREE",
    displayName: "Zrychlená free verze",
    routeSlug: "free",
    roundDurationDays: 0.08333333333333333,
    roundDurationHours: 2,
    incomeTickMinutes: 15,
    attackCooldownSeconds: 8,
    attackActionDurationSeconds: 10,
    raidCooldownSeconds: 8,
    raidActionDurationSeconds: 10,
    mapSeed: "empire-city-free-v1",
    phaseDurationHours: 0.25,
    gameDaysPerRealDay: 12,
    gameClockStartHour: 8,
    maxInfluence: 100,
    maxPlayers: 20,
    loginAccent: "#fb7185",
    loginAccentAlt: "#f59e0b",
    loginSurface: "rgba(30, 13, 18, 0.74)",
    loginSurfaceStrong: "rgba(18, 8, 12, 0.96)",
    servers: [
      { key: "free-alpha", name: "Spark One", subtitle: "Rychlý free server pro první session.", capacity: 20 },
      { key: "free-bravo", name: "Red Rush", subtitle: "Krátké kola, rychlý rozjezd a ostřejší tempo.", capacity: 20 },
      { key: "free-charlie", name: "Neon Trial", subtitle: "Testovací free server pro odlehčenou hru.", capacity: 20 }
    ]
  })
});

function normalizeGameMode(mode) {
  const raw = String(mode || "").trim().toLowerCase();
  return Object.prototype.hasOwnProperty.call(GAME_MODES, raw) ? raw : "war";
}

function getGameModeConfig(mode) {
  return GAME_MODES[normalizeGameMode(mode)] || GAME_MODES.war;
}

module.exports = {
  GAME_MODES,
  getGameModeConfig,
  normalizeGameMode
};

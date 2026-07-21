export const LEADERBOARD_DEMO_PLAYERS = Object.freeze([
  Object.freeze({
    id: "demo-boss",
    name: "DemoBoss",
    gangName: "Neon Demo Crew",
    faction: "Mafie",
    alliance: "",
    districts: 8,
    cleanMoney: 82000,
    dirtyMoney: 116000,
    influence: 590,
    wanted: 260,
    successfulAttacks: 18,
    successfulDefenses: 11,
    robberies: 16,
    unitsKilled: 430,
    unitsLost: 215,
    buildingsOwned: 21,
    lastRank: 3,
    currentRank: 3,
    lastActiveMinutes: 0,
    isCurrentPlayer: true,
    serverId: "demo:free",
    serverLabel: "DEV DEMO",
    mode: "free"
  }),
  Object.freeze({
    id: "demo-rival-one",
    name: "Demo Rival 1",
    gangName: "Chrome Preview",
    faction: "Hackeři",
    alliance: "Test Pact",
    districts: 12,
    cleanMoney: 136000,
    dirtyMoney: 178000,
    influence: 880,
    wanted: 410,
    successfulAttacks: 28,
    successfulDefenses: 17,
    robberies: 22,
    unitsKilled: 710,
    unitsLost: 290,
    buildingsOwned: 32,
    lastRank: 1,
    currentRank: 1,
    lastActiveMinutes: 4,
    serverId: "demo:free",
    serverLabel: "DEV DEMO",
    mode: "free"
  }),
  Object.freeze({
    id: "demo-rival-two",
    name: "Demo Rival 2",
    gangName: "Iron Preview",
    faction: "Soukromá armáda",
    alliance: "Test Pact",
    districts: 10,
    cleanMoney: 104000,
    dirtyMoney: 122000,
    influence: 760,
    wanted: 330,
    successfulAttacks: 23,
    successfulDefenses: 24,
    robberies: 12,
    unitsKilled: 580,
    unitsLost: 240,
    buildingsOwned: 27,
    lastRank: 2,
    currentRank: 2,
    lastActiveMinutes: 8,
    serverId: "demo:free",
    serverLabel: "DEV DEMO",
    mode: "free"
  })
]);

export const calculateDemoEmpireScore = (player = {}) => Math.round(
  (number(player.districts) * 2500)
  + (number(player.influence) * 1.2)
  + (number(player.cleanMoney) * 0.015)
  + (number(player.dirtyMoney) * 0.01)
  + (number(player.buildingsOwned) * 350)
  + (number(player.successfulAttacks) * 420)
  + (number(player.successfulDefenses) * 260)
  + (number(player.robberies) * 180)
  + (number(player.unitsKilled) * 12)
  - (number(player.unitsLost) * 6)
  - (Math.max(0, number(player.wanted) - 500) * 3)
);

const number = (value) => Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0;

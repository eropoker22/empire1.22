export const MARKET_PLAYER_DEMO_SELLERS = Object.freeze([
  Object.freeze({ id: "seller:neon-fox", name: "Neon Fox" }),
  Object.freeze({ id: "seller:chrome-crew", name: "Chrome Crew" }),
  Object.freeze({ id: "seller:zero-lab", name: "Zero Lab" }),
  Object.freeze({ id: "seller:byte-runners", name: "Byte Runners" }),
  Object.freeze({ id: "seller:scarlet-yard", name: "Scarlet Yard" })
]);

export const DEV_ONLY_POLICE_INTERVAL_MS = 30_000;
export const DEV_ONLY_DESTROYED_DISTRICT_ID = 8;

export const START_PHASE_RESOURCE_SIMULATION = Object.freeze({
  cleanPerMinuteByDistrictType: Object.freeze({
    resident: 5,
    industrial: 10,
    park: 20,
    economy: 40,
    downtown: 50
  }),
  influencePerMinute: 1
});

export const START_PHASE_OWNER_COORDINATES = [
  [0, 1], [0, 6], [0, 11], [0, 16], [0, 21],
  [1, 3], [1, 9], [1, 15],
  [2, 1], [2, 7], [2, 18],
  [3, 4], [3, 18],
  [4, 2], [4, 20],
  [5, 5], [5, 11], [5, 17],
  [6, 7], [6, 15]
];

export const START_PHASE_PLAYER_COLORS = [
  "#ef4444",
  "#3b82f6",
  "#22c55e",
  "#eab308",
  "#f97316",
  "#8b5cf6",
  "#ec4899",
  "#14b8a6",
  "#06b6d4",
  "#a21caf",
  "#7f1d1d",
  "#6b8e23",
  "#84cc16",
  "#a7f3d0",
  "#fa8072",
  "#ff7f50",
  "#ffd700",
  "#c0c0c0",
  "#f5f5dc",
  "#8b4513",
  "#111111",
  "#ffffff",
  "#9ca3af",
  "#4f46e5",
  "#0f52ba",
  "#50c878",
  "#dc143c",
  "#e6e6fa",
  "#ffdab9",
  "#36454f"
];

export const START_PHASE_PLAYER_NAMES = [
  "NeonRaven",
  "GhostByte",
  "ViperHex",
  "BlazeZero",
  "KnoxFlux",
  "JaxCircuit",
  "ShadowGrid",
  "MaddoxChrome",
  "AxelPulse",
  "ReaperNova",
  "DrakeVoid",
  "StrykerWave",
  "ZaneCipher",
  "HunterGlitch",
  "PhoenixRay",
  "RykerStatic",
  "DexVector",
  "ColtNeon",
  "AceSignal",
  "OnyxDrive"
];

export const CURRENT_PLAYER_ID = 1;

export const LAUNCH_PLAYER_FACTION_ORDER = Object.freeze([
  "mafian",
  "kartel",
  "kult",
  "tajna-organizace",
  "hackeri",
  "motorkarsky-gang",
  "soukroma-armada",
  "korporace"
]);

export const LAUNCH_PLAYER_AVATAR_BY_FACTION_ID = Object.freeze({
  mafian: "../img/avatars/Mafia/2854d1df-0f7c-4fe4-aa85-7a70dfe299db.jpg",
  kartel: "../img/avatars/Kartel/0f3d68b6-79b0-4bdd-9856-2491cd66cb78.jpg",
  kult: "../img/avatars/kult/5f1bbe02-e437-43b6-b9ed-c453e34ca622.jpg",
  "tajna-organizace": "../img/avatars/Tajnaorganizace/0099fc13-4774-459a-b1a9-ea507a6c0526.jpg",
  hackeri: "../img/avatars/Hacker/379f566a-18b8-457e-83ee-ee9ee114cb7a.jpg",
  "motorkarsky-gang": "../img/avatars/Motogang/grok_image_1773621173474.jpg",
  "soukroma-armada": "../img/avatars/SoukromaArmada/17912d57-dfc8-49fc-9a90-44121c298975.jpg",
  korporace: "../img/avatars/Korporat/094f576f-646f-4ec9-9786-63019d07cdfe.jpg"
});

export const DEMO_SCENARIOS = Object.freeze({
  launch: Object.freeze({
    id: "launch",
    gamePhase: "launch",
    currentPlayerId: CURRENT_PLAYER_ID,
    ownerCoordinates: START_PHASE_OWNER_COORDINATES,
    playerColors: START_PHASE_PLAYER_COLORS,
    playerNames: START_PHASE_PLAYER_NAMES,
    factionOrder: LAUNCH_PLAYER_FACTION_ORDER,
    avatarByFactionId: LAUNCH_PLAYER_AVATAR_BY_FACTION_ID,
    resourceSimulation: START_PHASE_RESOURCE_SIMULATION,
    destroyedDistrictId: DEV_ONLY_DESTROYED_DISTRICT_ID,
    policeIntervalMs: DEV_ONLY_POLICE_INTERVAL_MS
  })
});

export function isDemoScenarioMode(phaseState = {}) {
  return String(phaseState?.gamePhase || "live").trim().toLowerCase() === DEMO_SCENARIOS.launch.gamePhase;
}

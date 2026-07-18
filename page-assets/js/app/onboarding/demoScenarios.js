export const MARKET_PLAYER_DEMO_SELLERS = Object.freeze([
  Object.freeze({ id: "seller:neon-fox", name: "Neon Fox" }),
  Object.freeze({ id: "seller:chrome-crew", name: "Chrome Crew" }),
  Object.freeze({ id: "seller:zero-lab", name: "Zero Lab" }),
  Object.freeze({ id: "seller:byte-runners", name: "Byte Runners" }),
  Object.freeze({ id: "seller:scarlet-yard", name: "Scarlet Yard" })
]);

export const DEV_ONLY_DESTROYED_DISTRICT_ID = 8;
export const DEV_ONLY_SPY_FULL_SUCCESS_CHANCE = 0.99;

export const DEV_ONLY_ONBOARDING_START_STATE = Object.freeze({
  economy: Object.freeze({
    cleanMoney: 0,
    dirtyMoney: 0
  }),
  gang: Object.freeze({
    members: 0,
    influence: 0,
    heat: 0,
    alliance: null
  }),
  allianceBoard: Object.freeze({
    activeAlliance: null,
    allianceBadgesByPlayerId: Object.freeze({}),
    publicAlliances: Object.freeze([]),
    incomingInvites: Object.freeze([]),
    eligibleInviteTargets: Object.freeze([]),
    canCreateAlliance: false,
    createDisabledReason: "ONBOARDING_NO_ALLIANCE",
    disableDevOnlyActiveAlliance: true
  }),
  world: Object.freeze({
    ownedDistrictIds: Object.freeze([1]),
    gamePhase: "launch"
  }),
  storageAmount: 0
});

export const START_PHASE_RESOURCE_SIMULATION = Object.freeze({
  cleanPerMinuteByDistrictType: Object.freeze({
    resident: 500 / 60,
    industrial: 800 / 60,
    park: 150 / 60,
    economy: 1200 / 60,
    downtown: 50
  }),
  dirtyPerMinuteByDistrictType: Object.freeze({
    resident: 50 / 60,
    industrial: 100 / 60,
    park: 550 / 60,
    economy: 250 / 60,
    downtown: 10
  }),
  influencePerMinuteByDistrictType: Object.freeze({
    resident: 2 / 60,
    industrial: 3 / 60,
    park: 3 / 60,
    economy: 4 / 60,
    downtown: 15 / 60
  }),
  populationPerMinuteByDistrictType: Object.freeze({
    resident: 0,
    industrial: 15 / 60,
    park: 10 / 60,
    economy: 20 / 60,
    downtown: 0
  })
});

export const START_PHASE_OWNER_COORDINATES = [
  [0, 0],
  [0, 4], [1, 1], [2, 3], [3, 0], [4, 2], [5, 4],
  [0, 18], [1, 21], [2, 19], [3, 22], [4, 20], [5, 18],
  [6, 1], [6, 4], [6, 8], [6, 12], [6, 16], [6, 20], [6, 22]
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
    destroyedDistrictId: DEV_ONLY_DESTROYED_DISTRICT_ID
  })
});

export function isDemoScenarioMode(phaseState = {}) {
  return String(phaseState?.gamePhase || "live").trim().toLowerCase() === DEMO_SCENARIOS.launch.gamePhase;
}

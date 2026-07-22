const EMPTY_RESOURCE_SIMULATION = Object.freeze({
  cleanPerMinuteByDistrictType: Object.freeze({}),
  dirtyPerMinuteByDistrictType: Object.freeze({}),
  influencePerMinuteByDistrictType: Object.freeze({}),
  populationPerMinuteByDistrictType: Object.freeze({})
});

export let MARKET_PLAYER_DEMO_SELLERS = Object.freeze([]);
export let DEV_ONLY_DESTROYED_DISTRICT_ID = -1;
export let DEV_ONLY_SPY_FULL_SUCCESS_CHANCE = 0;
export let START_PHASE_RESOURCE_SIMULATION = EMPTY_RESOURCE_SIMULATION;
export let START_PHASE_OWNER_COORDINATES = Object.freeze([]);
export let START_PHASE_PLAYER_COLORS = Object.freeze(["#94a3b8"]);
export let START_PHASE_PLAYER_NAMES = Object.freeze([]);
export let CURRENT_PLAYER_ID = 1;
export let LAUNCH_PLAYER_FACTION_ORDER = Object.freeze([]);
export let LAUNCH_PLAYER_AVATAR_BY_FACTION_ID = Object.freeze({});
export let DEMO_SCENARIOS = Object.freeze({});
const scenarioDataListeners = new Set();

export const installLegacyScenarioData = (source = {}) => {
  MARKET_PLAYER_DEMO_SELLERS = frozenArray(source.MARKET_PLAYER_DEMO_SELLERS);
  DEV_ONLY_DESTROYED_DISTRICT_ID = finiteNumber(source.DEV_ONLY_DESTROYED_DISTRICT_ID, -1);
  DEV_ONLY_SPY_FULL_SUCCESS_CHANCE = finiteNumber(source.DEV_ONLY_SPY_FULL_SUCCESS_CHANCE, 0);
  START_PHASE_RESOURCE_SIMULATION = source.START_PHASE_RESOURCE_SIMULATION || EMPTY_RESOURCE_SIMULATION;
  START_PHASE_OWNER_COORDINATES = frozenArray(source.START_PHASE_OWNER_COORDINATES);
  START_PHASE_PLAYER_COLORS = frozenArray(source.START_PHASE_PLAYER_COLORS, ["#94a3b8"]);
  START_PHASE_PLAYER_NAMES = frozenArray(source.START_PHASE_PLAYER_NAMES);
  CURRENT_PLAYER_ID = finiteNumber(source.CURRENT_PLAYER_ID, 1);
  LAUNCH_PLAYER_FACTION_ORDER = frozenArray(source.LAUNCH_PLAYER_FACTION_ORDER);
  LAUNCH_PLAYER_AVATAR_BY_FACTION_ID = Object.freeze({ ...(source.LAUNCH_PLAYER_AVATAR_BY_FACTION_ID || {}) });
  DEMO_SCENARIOS = Object.freeze({ ...(source.DEMO_SCENARIOS || {}) });
  scenarioDataListeners.forEach((listener) => listener());
};

export const subscribeLegacyScenarioData = (listener) => {
  if (typeof listener !== "function") return () => {};
  scenarioDataListeners.add(listener);
  listener();
  return () => scenarioDataListeners.delete(listener);
};

export const isDemoScenarioMode = (phaseState = {}) => {
  const launchPhase = String(DEMO_SCENARIOS?.launch?.gamePhase || "").trim().toLowerCase();
  return Boolean(launchPhase && String(phaseState?.gamePhase || "").trim().toLowerCase() === launchPhase);
};

const frozenArray = (value, fallback = []) => Object.freeze(
  Array.isArray(value) && value.length ? [...value] : [...fallback]
);
const finiteNumber = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;

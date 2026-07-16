import { getStoredPreviewSession, updateStoredPreviewSession } from "./model/authority-state.js";
import { CITY_EVENT_CONFIG } from "../../../packages/game-config/src/legacy-page/gameplay-config.generated.js";
import {
  addGangHeat,
  appendBuildingActionResultEntry,
  applyInventoryOutput,
  applyTopbarEconomy,
  getResolvedGangState,
  getServerGameplaySliceReadModel,
  submitServerCityEventCommand,
  renderSpyResourceState
} from "./runtime.js";
import { closeOverlay, openOverlay } from "./ui/legacyOverlayCoordinator.js";
import { bindSharedCountdown } from "./ui/sharedCountdownTicker.js";
import { GAMEPLAY_EXECUTION_MODES, getGameplayExecutionMode } from "./runtime/gameplayExecutionMode.js";

const MAX_VISIBLE_EVENTS_PER_CHARACTER = 3;
const LOCAL_CITY_EVENT_VISIBLE_MINUTES = 3 * 60;

const CITY_EVENT_REWARD_ALIASES = Object.freeze({
  dirtyCash: "dirty-cash",
  metalParts: "metal-parts",
  chemical: "chemicals",
  techCore: "tech-core",
  streetPistol: "pistol",
  neonViper: "neon-dust",
  overdriveX: "overdrive-x",
  velvetSmoke: "velvet-smoke",
  ghostSerum: "ghost-serum",
  bulletproofVest: "vest",
  securityCameras: "cameras"
});

const rewardLabels = Object.freeze({
  cash: "clean cash",
  "dirty-cash": "dirty cash",
  influence: "influence",
  "metal-parts": "Metal Parts",
  chemicals: "Chemicals",
  biomass: "Biomass",
  "stim-pack": "Stim Pack",
  "tech-core": "Tech Core",
  "combat-module": "Combat Module",
  "baseball-bat": "Baseballová pálka",
  barricades: "Barikády",
  pistol: "Pistole",
  "neon-dust": "Neon Dust",
  "pulse-shot": "Pulse Shot",
  "overdrive-x": "Overdrive X (komponenta)",
  "velvet-smoke": "Velvet Smoke",
  "ghost-serum": "Ghost Serum (komponenta)",
  smg: "SMG",
  ammo: "munice",
  grenade: "Granát",
  spyGear: "špionážní vybavení",
  intel: "informace",
  vest: "Vesta",
  bazooka: "Bazuka",
  cameras: "Kamery",
  alarm: "Alarm",
  "defense-tower": "Obranná věž"
});

const CITY_EVENT_STORAGE_REWARD_TARGETS = Object.freeze({
  "metal-parts": Object.freeze({ inventory: "materials", itemId: "metal-parts" }),
  biomass: Object.freeze({ inventory: "materials", itemId: "biomass" }),
  "stim-pack": Object.freeze({ inventory: "materials", itemId: "stim-pack" }),
  "tech-core": Object.freeze({ inventory: "materials", itemId: "tech-core" }),
  "combat-module": Object.freeze({ inventory: "materials", itemId: "combat-module" }),
  chemicals: Object.freeze({ inventory: "materials", itemId: "chemicals" }),
  "baseball-bat": Object.freeze({ inventory: "weapons", itemId: "baseball-bat" }),
  barricades: Object.freeze({ inventory: "weapons", itemId: "barricades" }),
  pistol: Object.freeze({ inventory: "weapons", itemId: "pistol" }),
  grenade: Object.freeze({ inventory: "weapons", itemId: "grenade" }),
  smg: Object.freeze({ inventory: "weapons", itemId: "smg" }),
  bazooka: Object.freeze({ inventory: "weapons", itemId: "bazooka" }),
  vest: Object.freeze({ inventory: "weapons", itemId: "vest" }),
  cameras: Object.freeze({ inventory: "weapons", itemId: "cameras" }),
  alarm: Object.freeze({ inventory: "weapons", itemId: "alarm" }),
  "defense-tower": Object.freeze({ inventory: "weapons", itemId: "defense-tower" }),
  "neon-dust": Object.freeze({ inventory: "drugs", itemId: "neon-dust" }),
  "pulse-shot": Object.freeze({ inventory: "drugs", itemId: "pulse-shot" }),
  "velvet-smoke": Object.freeze({ inventory: "drugs", itemId: "velvet-smoke" }),
  "ghost-serum": Object.freeze({ inventory: "drugs", itemId: "ghost-serum" }),
  "overdrive-x": Object.freeze({ inventory: "drugs", itemId: "overdrive-x" })
});

function normalizeCityEventRewards(reward = {}) {
  return Object.entries(reward || {}).reduce((normalized, [rawKey, rawValue]) => {
    const key = CITY_EVENT_REWARD_ALIASES[rawKey] || rawKey;
    normalized[key] = Math.max(0, Math.floor(Number(normalized[key] || 0) + Number(rawValue || 0)));
    return normalized;
  }, {});
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatRewardEntry(resourceKey, amount) {
  const safeAmount = Math.max(0, Math.floor(Number(amount || 0)));
  if (!safeAmount) return "";
  const label = rewardLabels[resourceKey] || resourceKey;
  if (resourceKey === "cash" || resourceKey === "dirty-cash") {
    return `+${safeAmount.toLocaleString("cs-CZ")} ${label}`;
  }
  return `+${safeAmount} ${label}`;
}

function mapCityEventsToTasks(eventPool, agentKey) {
  return (Array.isArray(eventPool) ? eventPool : []).map((event) => {
    const reward = normalizeCityEventRewards(event.reward);
    const rewardEntries = Object.entries(reward)
      .map(([key, value]) => formatRewardEntry(key, value))
      .filter(Boolean);
    const successHeat = Math.max(0, Math.floor(Number(event?.risk?.successHeat || 0)));
    const failureHeat = Math.max(successHeat, Math.floor(Number(event?.risk?.failureHeat || 0)));
    const failureDirtyCashLoss = Math.max(0, Math.floor(Number(event?.risk?.failureDirtyCashLoss || 0)));
    return {
      id: event.id,
      agentKey,
      giver: String(CITY_EVENT_CONFIG.agents?.[agentKey === "nira" ? "nyra" : agentKey]?.name || "").trim(),
      title: event.title,
      desc: event.description,
      reward,
      gains: rewardEntries,
      risk: `Úspěch Heat +${successHeat} · Selhání Heat +${failureHeat}${failureDirtyCashLoss > 0 ? ` · ztráta až ${failureDirtyCashLoss.toLocaleString("cs-CZ")} dirty cash` : ""}`,
      successHeat,
      failureHeat,
      failureDirtyCashLoss,
      successRate: Math.max(0, Math.min(100, Math.floor(Number(event.successRate || 0)))),
      durationMinutes: Math.max(1, Math.floor(Number(event.durationMinutes || 1))),
      durationSec: Math.max(60, Math.floor(Number(event.durationMinutes || 1) * 60)),
      difficulty: String(event.difficulty || "medium")
    };
  });
}

function resolveEventDifficultyMeta(difficulty) {
  const key = ["easy", "medium", "hard", "rare"].includes(String(difficulty))
    ? String(difficulty)
    : "medium";
  return { key, label: key === "rare" ? "Rare" : `${key.charAt(0).toUpperCase()}${key.slice(1)}` };
}

const canonicalDefinitions = Array.isArray(CITY_EVENT_CONFIG.definitions) ? CITY_EVENT_CONFIG.definitions : [];
const victorTasks = mapCityEventsToTasks(canonicalDefinitions.filter((event) => event.agentId === "victor"), "victor");
const leonTasks = mapCityEventsToTasks(canonicalDefinitions.filter((event) => event.agentId === "leon"), "leon");
const nyraTasks = mapCityEventsToTasks(canonicalDefinitions.filter((event) => event.agentId === "nyra"), "nira");

const AGENTS = Object.freeze({
  victor: Object.freeze({
    name: "Victor Grave Kadeř",
    type: "Pouliční boss",
    desc: "Bývalý vyhazovač, co si vymlátil vlastní teritorium. Neřeší kecy, jen výsledky. Respekt si bere silou.",
    quote: "Buď to vezmeš nebo to vezme někdo jinej.",
    requiredInfluence: 0,
    tasks: victorTasks
  }),
  leon: Object.freeze({
    name: "Leon Switch Varga",
    type: "Fixer / obchodník",
    desc: "Všechno ví, všechno zařídí. Má kontakty v každém sektoru a nikdy nepracuje zadarmo.",
    quote: "Nejde o to, co máš. Jde o to, co z toho vytěžíš.",
    requiredInfluence: 100,
    tasks: leonTasks
  }),
  nira: Object.freeze({
    name: "Nyra Vale",
    type: "Informační síť / vliv",
    desc: "Vlastní několik klubů a ví o každém všechno. Usmívá se ale tahá za nitky v pozadí.",
    quote: "Informace jsou dražší než krev. A já jich mám dost.",
    requiredInfluence: 300,
    tasks: nyraTasks
  })
});

const taskLookup = new Map();
[victorTasks, leonTasks, nyraTasks].forEach((pool) => {
  pool.forEach((task) => taskLookup.set(String(task.id), task));
});

function mapServerCityEventOffer(agent, offer) {
  const rewards = normalizeCityEventRewards(offer?.rewards || {});
  const gains = Object.entries(rewards).map(([key, value]) => formatRewardEntry(key, value)).filter(Boolean);
  const successHeat = Math.max(0, Math.floor(Number(offer?.successHeat || 0)));
  const failureHeat = Math.max(successHeat, Math.floor(Number(offer?.failureHeat || 0)));
  const failureDirtyCashLoss = Math.max(0, Math.floor(Number(offer?.failureDirtyCashLoss || 0)));
  return {
    id: String(offer?.offerId || ""),
    offerId: String(offer?.offerId || ""),
    definitionId: String(offer?.definitionId || ""),
    agentKey: agent?.agentId === "nyra" ? "nira" : String(agent?.agentId || ""),
    giver: String(agent?.name || ""),
    title: String(offer?.title || "City Event"),
    desc: String(offer?.description || ""),
    reward: rewards,
    gains,
    risk: `Úspěch Heat +${successHeat} · Selhání Heat +${failureHeat}${failureDirtyCashLoss > 0 ? ` · ztráta až ${failureDirtyCashLoss.toLocaleString("cs-CZ")} dirty cash` : ""}`,
    successHeat,
    failureHeat,
    failureDirtyCashLoss,
    successRate: Math.max(0, Math.min(100, Math.floor(Number(offer?.successRate || 0)))),
    durationMinutes: Math.max(1, Math.floor(Number(offer?.durationMinutes || 1))),
    durationTicks: Math.max(1, Math.floor(Number(offer?.durationTicks || 1))),
    difficulty: String(offer?.difficulty || "medium"),
    attempted: Boolean(offer?.attempted),
    canStart: Boolean(offer?.canStart),
    disabledReason: offer?.disabledReason ? String(offer.disabledReason) : null
  };
}

function createDefaultCityEventsState() {
  return {
    version: 2,
    activeRuns: [],
    attemptedOfferIds: [],
    pendingRewards: {},
    eventResources: {
      ammo: 0,
      spyGear: 0,
      intel: 0
    }
  };
}

function normalizeCityEventsState(state) {
  const base = createDefaultCityEventsState();
  return {
    ...base,
    ...(state || {}),
    activeRuns: Array.isArray(state?.activeRuns) ? state.activeRuns : [],
    attemptedOfferIds: Array.isArray(state?.attemptedOfferIds) ? [...new Set(state.attemptedOfferIds.map(String))] : [],
    pendingRewards: normalizeCityEventRewards(state?.pendingRewards || {}),
    eventResources: {
      ...base.eventResources,
      ...(state?.eventResources || {})
    }
  };
}

function getStoredCityEventsState() {
  return normalizeCityEventsState(getStoredPreviewSession()?.cityEvents);
}

function setStoredCityEventsState(state) {
  updateStoredPreviewSession((session) => ({
    ...session,
    cityEvents: normalizeCityEventsState(state)
  }));
}

function updateStoredCityEventsState(updater) {
  const nextState = normalizeCityEventsState(updater(getStoredCityEventsState()));
  setStoredCityEventsState(nextState);
  return nextState;
}

function getCityEventRunState(taskId) {
  const run = getStoredCityEventsState().activeRuns.find((entry) => String(entry?.id || "") === String(taskId || ""));
  if (!run) {
    return { active: false, remainingSec: 0 };
  }
  const remainingMs = Math.max(0, Number(run.endsAt || 0) - Date.now());
  return {
    active: remainingMs > 0,
    remainingSec: Math.max(0, Math.ceil(remainingMs / 1000))
  };
}

function getActiveCityEventRun(nowMs = Date.now()) {
  const activeRuns = getStoredCityEventsState().activeRuns
    .filter((entry) => Number(entry?.endsAt || 0) > nowMs)
    .sort((left, right) => Number(left?.endsAt || 0) - Number(right?.endsAt || 0));
  const run = activeRuns[0] || null;
  if (!run) {
    return { active: false, run: null, task: null, remainingSec: 0 };
  }
  return {
    active: true,
    run,
    task: taskLookup.get(String(run.taskId || run.id || "")) || null,
    remainingSec: Math.max(0, Math.ceil((Number(run.endsAt || 0) - nowMs) / 1000))
  };
}

function hashCityEventSeed(value) {
  let result = 2166136261;
  const text = String(value || "");
  for (let index = 0; index < text.length; index += 1) {
    result ^= text.charCodeAt(index);
    result = Math.imul(result, 16777619);
  }
  return result >>> 0;
}

function resolveLocalScheduleWindow(agentKey) {
  const canonicalAgentKey = agentKey === "nira" ? "nyra" : agentKey;
  const schedule = CITY_EVENT_CONFIG.agents?.[canonicalAgentKey];
  const phase = getStoredPreviewSession()?.world?.phaseState || {};
  const cityMinutes = ((Math.floor(Number(phase.cityMinutes || 0)) % (24 * 60)) + (24 * 60)) % (24 * 60);
  const cityDayIndex = Math.max(0, Math.floor(Number(phase.cityDayIndex || 0)));
  if (!schedule) return { available: false, windowId: `${canonicalAgentKey}:unavailable`, boundaryHour: 0, nextBoundaryLabel: "-", cityDayIndex };
  const refreshTimes = Array.isArray(schedule.refreshTimes) ? schedule.refreshTimes : [];
  const boundaries = refreshTimes.map((time) => {
    const targetMinute = Number(time.hour || 0) * 60 + Number(time.minute || 0);
    const distance = (cityMinutes - targetMinute + (24 * 60)) % (24 * 60);
    return { ...time, targetMinute, distance };
  }).sort((left, right) => left.distance - right.distance);
  const current = boundaries[0] || { hour: 0, minute: 0, targetMinute: 0, distance: 0 };
  const cityDayStartMinute = 6 * 60;
  const shiftedCityMinute = (cityMinutes - cityDayStartMinute + (24 * 60)) % (24 * 60);
  const shiftedBoundaryMinute = (current.targetMinute - cityDayStartMinute + (24 * 60)) % (24 * 60);
  const boundaryDayIndex = Math.max(0, cityDayIndex - (shiftedBoundaryMinute > shiftedCityMinute ? 1 : 0));
  const available = current.distance < LOCAL_CITY_EVENT_VISIBLE_MINUTES;
  const next = refreshTimes.map((time) => {
    const target = time.hour * 60 + time.minute;
    return { ...time, distance: (target - cityMinutes + (24 * 60)) % (24 * 60) || (24 * 60) };
  }).sort((left, right) => left.distance - right.distance)[0];
  return {
    available,
    boundaryHour: current.hour,
    cityDayIndex: boundaryDayIndex,
    windowId: `${canonicalAgentKey}:day-${boundaryDayIndex}:${String(current.hour).padStart(2, "0")}${String(current.minute).padStart(2, "0")}`,
    nextBoundaryLabel: next ? `${String(next.hour).padStart(2, "0")}:${String(next.minute).padStart(2, "0")}` : "-"
  };
}

function resolveVisibleCharacterTasks(poolKey, tasks) {
  const safeTasks = Array.isArray(tasks) ? tasks : [];
  if (!safeTasks.length) return [];

  const activePinned = safeTasks
    .filter((task) => getCityEventRunState(task?.id).active)
    .slice(0, MAX_VISIBLE_EVENTS_PER_CHARACTER);
  const schedule = resolveLocalScheduleWindow(poolKey);
  if (!schedule.available) return activePinned;
  const remainingSlots = Math.max(0, MAX_VISIBLE_EVENTS_PER_CHARACTER - activePinned.length);
  if (remainingSlots <= 0) return activePinned;

  const state = getStoredCityEventsState();
  const canonicalAgentKey = poolKey === "nira" ? "nyra" : poolKey;
  const strategicOwner = ["victor", "leon", "nyra"][hashCityEventSeed(`local-demo:${schedule.cityDayIndex}:strategic`) % 3];
  const standardPool = safeTasks.filter((task) => task.difficulty !== "rare");
  const rarePool = safeTasks.filter((task) => task.difficulty === "rare");
  const sortedStandard = [...standardPool].sort((left, right) =>
    hashCityEventSeed(`${schedule.windowId}:${left.id}`) - hashCityEventSeed(`${schedule.windowId}:${right.id}`) || String(left.id).localeCompare(String(right.id)));
  const sortedRare = [...rarePool].sort((left, right) =>
    hashCityEventSeed(`${schedule.windowId}:rare:${left.id}`) - hashCityEventSeed(`${schedule.windowId}:rare:${right.id}`) || String(left.id).localeCompare(String(right.id)));
  const selected = sortedStandard.slice(0, MAX_VISIBLE_EVENTS_PER_CHARACTER);
  if (schedule.boundaryHour === 22 && strategicOwner === canonicalAgentKey && sortedRare[0]) selected[2] = sortedRare[0];
  const rotatingPool = selected.map((task) => ({
    ...task,
    offerId: `${task.id}:${schedule.windowId}`,
    scheduleWindowId: schedule.windowId,
    attempted: state.attemptedOfferIds.includes(`${task.id}:${schedule.windowId}`)
  })).filter((task) => {
    const taskId = String(task?.id || "").trim();
    return !activePinned.some((activeTask) => String(activeTask?.id || "").trim() === taskId);
  });
  if (!rotatingPool.length) return activePinned;
  return [...activePinned, ...rotatingPool.slice(0, remainingSlots)];
}

function resolveEventOutcomePool(task, wasSuccess) {
  const title = String(task?.title || "Event").trim();
  const risk = String(task?.risk || "Heat +0").trim();
  const durationMinutes = Math.max(1, Math.floor(Number(task?.durationMinutes || 1)));
  if (wasSuccess) {
    return [
      `${title}: operace proběhla čistě. Výsledek dorazil do skladu.`,
      `${title}: cíl splněn za ${durationMinutes} min. Trasa byla tichá a bez úniku.`,
      `${title}: úspěch. ${risk} zůstalo pod kontrolou.`
    ];
  }
  return [
    `${title}: akce se rozpadla během přesunu. Bez zisku.`,
    `${title}: operace selhala. Kontakt zmizel ještě před dokončením.`,
    `${title}: průser. ${risk} vystřelilo nahoru a zisk je nulový.`
  ];
}

function resolveRandomOutcomeLine(task, wasSuccess, seed) {
  const pool = resolveEventOutcomePool(task, wasSuccess);
  const index = hashCityEventSeed(seed) % pool.length;
  return String(pool[index] || pool[0] || "").trim();
}

function createCityEventStreetNewsPayload(task, run) {
  const durationSec = Math.max(1, Math.floor(Number(task?.durationSec || 1)));
  const gains = Array.isArray(task?.gains) ? task.gains.filter(Boolean) : [];
  const remainingSec = Math.max(0, Math.ceil((Number(run?.endsAt || 0) - Date.now()) / 1000));
  return {
    tone: "is-specialty-financial",
    title: `Lokální zakázka spuštěna: ${String(task?.title || "Pouliční zakázka").trim()}`,
    taskTitle: String(task?.title || "Pouliční zakázka").trim(),
    badge: "Probíhající zakázka",
    liveRowsKind: "city_event",
    refreshMs: 1000,
    syncToBuildingAction: false,
    summary: `Zakázka běží: ${String(task?.title || "Pouliční zakázka").trim()}. Klikni pro zbývající čas a možný zisk.`,
    giver: String(task?.giver || AGENTS[task?.agentKey || ""]?.name || "-").trim(),
    risk: String(task?.risk || "Nízké").trim(),
    gains,
    successRate: Math.max(0, Math.min(100, Math.floor(Number(task?.successRate || 0)))),
    durationSec,
    startedAt: Number(run?.startedAt || Date.now()),
    endsAt: Number(run?.endsAt || Date.now() + (durationSec * 1000)),
    rows: [
      { label: "Stav", value: "Probíhá" },
      { label: "Úkol", value: String(task?.title || "City Event").trim() },
      { label: "Zbývá", value: `${remainingSec}s`, nowrap: true },
      { label: "Zadavatel", value: String(task?.giver || AGENTS[task?.agentKey || ""]?.name || "-").trim() },
      { label: "Úspěšnost", value: `${Math.max(0, Math.min(100, Math.floor(Number(task?.successRate || 0))))}%` },
      { label: "Možný zisk", value: gains.length ? gains.join(", ") : "Bez garantované odměny" },
      { label: "Riziko", value: String(task?.risk || "Nízké").trim() }
    ]
  };
}

function createCityEventResultStreetNewsPayload(task, run, wasSuccess, outcomeLine, appliedRewards = []) {
  const title = String(task?.title || "Pouliční zakázka").trim();
  const giver = String(task?.giver || AGENTS[task?.agentKey || ""]?.name || "-").trim();
  const gains = Array.isArray(appliedRewards) ? appliedRewards.filter(Boolean) : [];
  const possibleGains = Array.isArray(task?.gains) ? task.gains.filter(Boolean) : [];
  const risk = String(task?.risk || "Nízké").trim();
  const statusLabel = wasSuccess ? "Úspěch" : "Selhání";
  const rewardLabel = wasSuccess
    ? (gains.length ? gains.join(", ") : "Bez garantované odměny")
    : "Žádný zisk";

  return {
    tone: wasSuccess ? "success is-specialty-financial" : "is-specialty-arrests",
    title: `Lokální zakázka dokončena: ${title}`,
    taskTitle: title,
    badge: statusLabel,
    syncToBuildingAction: false,
    summary: String(outcomeLine || `${title}: ${statusLabel.toLowerCase()}.`).trim(),
    giver,
    risk,
    gains: wasSuccess ? gains : possibleGains,
    successRate: Math.max(0, Math.min(100, Math.floor(Number(task?.successRate || 0)))),
    durationSec: Math.max(1, Math.floor(Number(task?.durationSec || 1))),
    startedAt: Number(run?.startedAt || 0),
    endedAt: Date.now(),
    wasSuccess,
    rows: [
      { label: "Výsledek", value: statusLabel },
      { label: "Úkol", value: title },
      { label: "Zadavatel", value: giver },
      { label: "Shrnutí", value: String(outcomeLine || "-").trim() || "-" },
      { label: "Zisk", value: rewardLabel },
      { label: "Riziko", value: risk },
      { label: "Úspěšnost", value: `${Math.max(0, Math.min(100, Math.floor(Number(task?.successRate || 0))))}%` }
    ]
  };
}

function parseInfluenceAmount(value) {
  const normalized = String(value ?? "")
    .replace(/\s+/gu, "")
    .replace(/[^\d.-]/gu, "");
  return Math.max(0, Math.floor(Number(normalized || 0) || 0));
}

function getCurrentPlayerInfluenceValue(root) {
  const storedInfluence = getStoredPreviewSession()?.gang?.influence;
  if (storedInfluence !== undefined && storedInfluence !== null) {
    return parseInfluenceAmount(storedInfluence);
  }
  const resolvedInfluence = getResolvedGangState?.().influence;
  if (Number(resolvedInfluence || 0) > 0) {
    return parseInfluenceAmount(resolvedInfluence);
  }
  const influenceElement = root.querySelector("[data-topbar-influence]");
  const popupInfluence = root.querySelector("[data-player-popup-influence]");
  const spyValue = root.querySelector("[data-topbar-spy-value]");
  return Math.max(
    parseInfluenceAmount(influenceElement?.dataset.influenceValue),
    parseInfluenceAmount(influenceElement?.textContent),
    parseInfluenceAmount(spyValue?.dataset.influenceValue),
    parseInfluenceAmount(popupInfluence?.textContent)
  );
}

function resolveAgentUnlockState(root, agent) {
  const requiredInfluence = Math.max(0, Math.floor(Number(agent?.requiredInfluence || 0)));
  const currentInfluence = getCurrentPlayerInfluenceValue(root);
  return {
    requiredInfluence,
    currentInfluence,
    unlocked: currentInfluence >= requiredInfluence
  };
}

function setTopbarInfluenceValue(root, nextValue) {
  const safeValue = Math.max(0, Math.floor(Number(nextValue || 0)));
  updateStoredPreviewSession((session) => ({
    ...session,
    gang: {
      ...(session.gang || {}),
      influence: safeValue
    }
  }));
  const influenceElement = root.querySelector("[data-topbar-influence]");
  const spyValue = root.querySelector("[data-topbar-spy-value]");
  const popupInfluence = root.querySelector("[data-player-popup-influence]");

  if (influenceElement) {
    influenceElement.dataset.influenceValue = String(safeValue);
    if (!spyValue || root.querySelector("[data-topbar-spy-pill]")?.dataset.resourceMode !== "spy") {
      influenceElement.textContent = String(safeValue);
    }
  }

  if (spyValue) {
    spyValue.dataset.influenceValue = String(safeValue);
  }

  if (popupInfluence) {
    popupInfluence.textContent = String(safeValue);
  }
}

function applyEventRewardsToPlayerState(root, task) {
  const rewardEntries = Object.entries(task?.reward || {});
  if (!rewardEntries.length) return { appliedRewards: [], pendingRewards: [] };

  let nextInfluence = getCurrentPlayerInfluenceValue(root);
  const directRewardEntries = [];
  const storageRewardEntries = [];

  updateStoredPreviewSession((session) => {
    const nextSession = {
      ...session,
      economy: { ...(session.economy || {}) },
      inventory: {
        ...(session.inventory || {}),
        weapons: { ...(session.inventory?.weapons || {}) },
        materials: { ...(session.inventory?.materials || {}) },
        drugs: { ...(session.inventory?.drugs || {}) },
        eventResources: {
          ammo: Math.max(0, Math.floor(Number(session.inventory?.eventResources?.ammo || 0))),
          spyGear: Math.max(0, Math.floor(Number(session.inventory?.eventResources?.spyGear || 0))),
          intel: Math.max(0, Math.floor(Number(session.inventory?.eventResources?.intel || 0)))
        }
      }
    };

    for (const [key, rawAmount] of rewardEntries) {
      const amount = Math.max(0, Math.floor(Number(rawAmount || 0)));
      if (!amount) continue;

      const storageTarget = CITY_EVENT_STORAGE_REWARD_TARGETS[key];
      if (storageTarget) {
        storageRewardEntries.push({ key, amount, target: storageTarget });
        continue;
      }

      switch (key) {
        case "cash":
          nextSession.economy.cleanMoney = Math.max(0, Math.floor(Number(nextSession.economy.cleanMoney || 0) + amount));
          directRewardEntries.push([key, amount]);
          break;
        case "dirty-cash":
          nextSession.economy.dirtyMoney = Math.max(0, Math.floor(Number(nextSession.economy.dirtyMoney || 0) + amount));
          directRewardEntries.push([key, amount]);
          break;
        case "influence":
          nextInfluence += amount;
          directRewardEntries.push([key, amount]);
          break;
        case "ammo":
          nextSession.inventory.eventResources.ammo = Math.max(0, Math.floor(Number(nextSession.inventory.eventResources.ammo || 0) + amount));
          directRewardEntries.push([key, amount]);
          break;
        case "spyGear":
          nextSession.inventory.eventResources.spyGear = Math.max(0, Math.floor(Number(nextSession.inventory.eventResources.spyGear || 0) + amount));
          directRewardEntries.push([key, amount]);
          break;
        case "intel":
          nextSession.inventory.eventResources.intel = Math.max(0, Math.floor(Number(nextSession.inventory.eventResources.intel || 0) + amount));
          directRewardEntries.push([key, amount]);
          break;
        default:
          break;
      }
    }

    return nextSession;
  });

  setTopbarInfluenceValue(root, nextInfluence);
  const appliedRewards = directRewardEntries
    .map(([key, value]) => formatRewardEntry(key, value))
    .filter(Boolean);
  const pendingRewards = {};

  for (const entry of storageRewardEntries) {
    const acceptedAmount = Math.max(0, Math.floor(Number(applyInventoryOutput({
      ...entry.target,
      amount: entry.amount
    }) || 0)));
    if (acceptedAmount > 0) {
      appliedRewards.push(formatRewardEntry(entry.key, acceptedAmount));
    }
    const remainingAmount = Math.max(0, entry.amount - acceptedAmount);
    if (remainingAmount > 0) {
      pendingRewards[entry.key] = Math.max(0, Math.floor(Number(pendingRewards[entry.key] || 0) + remainingAmount));
    }
  }

  if (Object.keys(pendingRewards).length > 0) {
    updateStoredCityEventsState((state) => ({
      ...state,
      pendingRewards: normalizeCityEventRewards({
        ...(state.pendingRewards || {}),
        ...Object.fromEntries(Object.entries(pendingRewards).map(([key, amount]) => [
          key,
          Math.max(0, Math.floor(Number(state.pendingRewards?.[key] || 0) + Number(amount || 0)))
        ]))
      })
    }));
  }

  return {
    appliedRewards,
    pendingRewards: Object.entries(pendingRewards).map(([key, value]) => formatRewardEntry(key, value)).filter(Boolean)
  };
}

function claimPendingCityEventRewards() {
  const state = getStoredCityEventsState();
  const pendingEntries = Object.entries(state.pendingRewards || {});
  if (!pendingEntries.length) return { claimedRewards: [], pendingRewards: [] };

  const nextPendingRewards = {};
  const claimedRewards = [];
  for (const [key, rawAmount] of pendingEntries) {
    const amount = Math.max(0, Math.floor(Number(rawAmount || 0)));
    const target = CITY_EVENT_STORAGE_REWARD_TARGETS[key];
    if (!amount || !target) continue;
    const acceptedAmount = Math.max(0, Math.floor(Number(applyInventoryOutput({ ...target, amount }) || 0)));
    if (acceptedAmount > 0) claimedRewards.push(formatRewardEntry(key, acceptedAmount));
    const remainingAmount = Math.max(0, amount - acceptedAmount);
    if (remainingAmount > 0) nextPendingRewards[key] = remainingAmount;
  }

  if (claimedRewards.length > 0 || JSON.stringify(nextPendingRewards) !== JSON.stringify(state.pendingRewards || {})) {
    updateStoredCityEventsState((current) => ({ ...current, pendingRewards: nextPendingRewards }));
  }
  return {
    claimedRewards,
    pendingRewards: Object.entries(nextPendingRewards).map(([key, value]) => formatRewardEntry(key, value)).filter(Boolean)
  };
}

function initCityEventsRuntime() {
  const root = document.querySelector("main[data-page='game']");
  if (!root) return;

  const diagnostics = window.empireStreetsRuntimeDiagnostics || null;
  const shouldRunLocalCityEvents = () => getGameplayExecutionMode({
    windowRef: window,
    diagnosticsMode: diagnostics?.getSummary?.().runtimeMode
  }) === GAMEPLAY_EXECUTION_MODES.localDemo;
  const shouldRunServerCityEvents = () => getGameplayExecutionMode({
    windowRef: window,
    diagnosticsMode: diagnostics?.getSummary?.().runtimeMode
  }) === GAMEPLAY_EXECUTION_MODES.serverAuthoritative;
  const getServerCityEventsView = () => getServerGameplaySliceReadModel()?.player?.cityEvents || null;
  const getServerAgent = (agentKey) => getServerCityEventsView()?.agents?.find((agent) =>
    String(agent?.agentId || "") === (agentKey === "nira" ? "nyra" : agentKey)) || null;
  const getServerTasks = (agentKey) => {
    const agent = getServerAgent(agentKey);
    return agent ? (agent.offers || []).map((offer) => mapServerCityEventOffer(agent, offer)) : [];
  };
  const getRenderedTasks = (agentKey) => shouldRunServerCityEvents()
    ? getServerTasks(agentKey)
    : resolveVisibleCharacterTasks(agentKey, AGENTS[agentKey]?.tasks);

  const openBtn = document.getElementById("city-events-open");
  const modal = document.getElementById("events-modal");
  const backdrop = document.getElementById("events-modal-backdrop");
  const closeBtn = document.getElementById("events-modal-close");
  const tasklist = document.getElementById("events-tasklist");
  const agentName = document.getElementById("events-agent-name");
  const agentType = document.getElementById("events-agent-type");
  const agentDesc = document.getElementById("events-agent-desc");
  const agentQuote = document.getElementById("events-agent-quote");
  const eventsRefreshCountdown = document.getElementById("events-refresh-countdown");
  const agentButtons = Array.from(document.querySelectorAll(".events-agent"));

  const detailModal = document.getElementById("event-detail-modal");
  const detailBackdrop = document.getElementById("event-detail-modal-backdrop");
  const detailCloseBtn = document.getElementById("event-detail-modal-close");
  const detailTitle = document.getElementById("event-detail-title");
  const detailGiver = document.getElementById("event-detail-giver");
  const detailStats = document.getElementById("event-detail-stats");
  const detailDesc = document.getElementById("event-detail-desc");
  const detailGains = document.getElementById("event-detail-gains");
  const detailRisk = document.getElementById("event-detail-risk");
  const detailAcceptBtn = document.getElementById("event-detail-accept");
  const detailDeclineBtn = document.getElementById("event-detail-decline");

  if (!modal || !openBtn || !detailModal || !tasklist) return;

  let selectedAgentKey = null;
  let selectedEventTask = null;
  let serverSubmitPending = false;

  const getRenderedRunState = (task) => {
    if (!shouldRunServerCityEvents()) return getCityEventRunState(task?.id);
    const activeRun = getServerCityEventsView()?.activeRun || null;
    const active = Boolean(activeRun && String(activeRun.offerId || "") === String(task?.offerId || task?.id || ""));
    return {
      active,
      remainingSec: active
        ? Math.max(0, Math.ceil(Number(activeRun.remainingTicks || 0) * Number(getServerGameplaySliceReadModel()?.mode?.tickRateMs || 5000) / 1000))
        : 0
    };
  };
  const getRenderedActiveRun = () => {
    if (!shouldRunServerCityEvents()) return getActiveCityEventRun();
    const activeRun = getServerCityEventsView()?.activeRun || null;
    return {
      active: Boolean(activeRun),
      run: activeRun,
      task: activeRun ? getServerTasks(selectedAgentKey || "victor").find((task) => task.offerId === activeRun.offerId) || null : null,
      remainingSec: activeRun
        ? Math.max(0, Math.ceil(Number(activeRun.remainingTicks || 0) * Number(getServerGameplaySliceReadModel()?.mode?.tickRateMs || 5000) / 1000))
        : 0
    };
  };

  const renderDetailChips = (container, values, variant = "gain") => {
    if (!container) return;
    const list = Array.isArray(values) ? values.filter(Boolean) : [];
    if (!list.length) {
      container.innerHTML = variant === "risk"
        ? '<span class="events-task__gain-chip events-task__gain-chip--muted">Nízké</span>'
        : '<span class="events-task__gain-chip events-task__gain-chip--muted">Bez garantované odměny</span>';
      return;
    }
    container.innerHTML = list.map((value) => {
      const className = variant === "risk" ? "events-task__risk-chip" : "events-task__gain-chip";
      return `<span class="${className}">${escapeHtml(String(value))}</span>`;
    }).join("");
  };

  const writeCityEventsInfo = (message) => {
    if (!agentDesc) return;
    const text = String(message || "").trim();
    if (text) {
      agentDesc.textContent = text;
    }
  };

  const syncAgentUnlockBadges = () => {
    agentButtons.forEach((button) => {
      const agentKey = String(button.dataset.agent || "");
      const agent = AGENTS[agentKey];
      if (!agent) return;
      const serverAgent = shouldRunServerCityEvents() ? getServerAgent(agentKey) : null;
      const unlockState = serverAgent ? {
        requiredInfluence: Math.max(0, Number(serverAgent.requiredInfluence || 0)),
        currentInfluence: Math.max(0, Number(serverAgent.currentInfluence || 0)),
        unlocked: Boolean(serverAgent.unlocked)
      } : resolveAgentUnlockState(root, agent);
      button.dataset.agentLocked = unlockState.unlocked ? "false" : "true";
      button.setAttribute("aria-disabled", unlockState.unlocked ? "false" : "true");
      const badge = button.querySelector(".events-agent__unlock-badge");
      if (badge) {
        const required = unlockState.requiredInfluence;
        badge.textContent = required > 0
          ? `Vliv: ${required}+`
          : "";
        badge.hidden = required <= 0;
      }
      if (unlockState.requiredInfluence > 0) {
        button.title = unlockState.unlocked
          ? `Zakázky odemčené. Vliv ${unlockState.currentInfluence}/${unlockState.requiredInfluence}.`
          : `Zakázky zamčené. Potřebuješ ${unlockState.requiredInfluence} vliv. Teď máš ${unlockState.currentInfluence}.`;
      } else {
        button.removeAttribute("title");
      }
    });
  };

  const closeEventDetailModal = () => {
    detailModal.classList.add("hidden");
    detailModal.hidden = true;
    closeOverlay(detailModal, { restoreFocus: true });
    selectedEventTask = null;
  };

  const openEventDetailModal = (task) => {
    if (!task) return;
    const wasHidden = detailModal.hidden || detailModal.classList.contains("hidden");
    selectedEventTask = task;
    const difficulty = resolveEventDifficultyMeta(task.difficulty);
    const runState = getRenderedRunState(task);
    const activeRun = getRenderedActiveRun();
    const isBlockedByOtherRun = activeRun.active && !runState.active;
    const schedule = shouldRunServerCityEvents()
      ? { available: Boolean(getServerAgent(task.agentKey)?.availableNow) }
      : resolveLocalScheduleWindow(task.agentKey);
    const disabledReason = task.disabledReason || (!schedule.available
      ? "Kontakt je teď zavřený"
      : task.attempted
        ? "Nabídka už byla využita"
        : isBlockedByOtherRun
          ? `Jiná zakázka probíhá (${activeRun.remainingSec}s)`
          : "");
    if (detailTitle) detailTitle.textContent = String(task.title || "Detail zakázky");
    if (detailGiver) detailGiver.textContent = String(task.giver || AGENTS[task.agentKey || ""]?.name || "-");
    if (detailStats) {
      detailStats.innerHTML = `
        <span>Úspěšnost ${Math.max(0, Math.floor(Number(task.successRate || 0)))}% • ${Math.max(1, Math.floor(Number(task.durationMinutes || 1)))} min${runState.active ? ` • Probíhá ${runState.remainingSec}s` : ""}${disabledReason ? ` • ${disabledReason}` : ""}</span>
        <span class="event-difficulty event-difficulty--${difficulty.key}">${difficulty.label}</span>
      `;
    }
    if (detailDesc) detailDesc.textContent = String(task.desc || "");
    renderDetailChips(detailGains, task.gains, "gain");
    renderDetailChips(detailRisk, task.risk ? [task.risk] : [], "risk");
    if (detailAcceptBtn) {
      detailAcceptBtn.disabled = serverSubmitPending || runState.active || isBlockedByOtherRun || task.attempted || !schedule.available || task.canStart === false;
      detailAcceptBtn.textContent = serverSubmitPending
        ? "Odesílám…"
        : runState.active
        ? `Probíhá (${runState.remainingSec}s)`
        : task.attempted
        ? "Nabídka využita"
        : !schedule.available
        ? "Kontakt je zavřený"
        : isBlockedByOtherRun
        ? `Počkej ${activeRun.remainingSec}s`
        : "Začít";
    }
    if (wasHidden) {
      detailModal.hidden = false;
      detailModal.classList.remove("hidden");
      openOverlay(detailModal, { type: "modal", ariaModal: true, restoreFocusOnClose: true });
      detailCloseBtn?.focus({ preventScroll: true });
    }
  };

  const renderTasks = (agentKey) => {
    const agent = AGENTS[agentKey];
    if (!agent) return;
    const serverAgent = shouldRunServerCityEvents() ? getServerAgent(agentKey) : null;
    syncAgentUnlockBadges();
    selectedAgentKey = agentKey;
    agentButtons.forEach((btn) => btn.classList.toggle("is-active", btn.dataset.agent === agentKey));
    if (agentName) agentName.textContent = serverAgent?.name || agent.name;
    if (agentType) agentType.textContent = serverAgent?.type || agent.type;
    if (agentDesc) agentDesc.textContent = agent.desc;
    if (agentQuote) agentQuote.textContent = agent.quote;

    const unlockState = serverAgent ? {
      requiredInfluence: Math.max(0, Number(serverAgent.requiredInfluence || 0)),
      currentInfluence: Math.max(0, Number(serverAgent.currentInfluence || 0)),
      unlocked: Boolean(serverAgent.unlocked)
    } : resolveAgentUnlockState(root, agent);
    if (!unlockState.unlocked) {
      if (agentDesc) {
        agentDesc.textContent = `${agent.desc} Zakázky se odemknou až při ${unlockState.requiredInfluence} vlivu. Teď máš ${unlockState.currentInfluence}.`;
      }
      tasklist.innerHTML = `
        <div class="events-task events-task--agent-locked">
          <div class="events-task__title">Zakázky zamčené</div>
          <div class="events-task__desc">Potřebuješ alespoň ${unlockState.requiredInfluence} vliv. Aktuálně máš ${unlockState.currentInfluence}.</div>
        </div>
      `;
      modal.classList.remove("events-modal--compact");
      return;
    }

    const schedule = serverAgent ? {
      available: Boolean(serverAgent.availableNow),
      nextBoundaryLabel: serverAgent.scheduleLabel || "po obnovení serveru"
    } : resolveLocalScheduleWindow(agentKey);
    if (!schedule.available) {
      tasklist.innerHTML = `
        <div class="events-task events-task--agent-locked">
          <div class="events-task__title">Kontakt je teď zavřený</div>
          <div class="events-task__desc">Další úkoly přijdou v ${schedule.nextBoundaryLabel}.</div>
        </div>
      `;
      modal.classList.remove("events-modal--compact");
      return;
    }

    const visibleTasks = getRenderedTasks(agentKey);
    const activeRun = getRenderedActiveRun();
    const pendingRewards = shouldRunServerCityEvents() ? (getServerCityEventsView()?.pendingRewards || []) : [];
    const pendingMarkup = pendingRewards.length ? `
      <div class="events-task events-task--pending-rewards">
        <div class="events-task__title">Čekající odměny</div>
        <div class="events-task__desc">${pendingRewards.map((reward) => `${escapeHtml(formatRewardEntry(reward.resourceKey, reward.amount))} <button type="button" class="btn btn-small" data-city-event-claim="${escapeHtml(reward.pendingRewardId)}"${reward.canClaim && !serverSubmitPending ? "" : " disabled"}>Vyzvednout</button>`).join(" ")}</div>
      </div>
    ` : "";
    tasklist.innerHTML = pendingMarkup + visibleTasks.map((task) => {
      const successRate = Math.max(0, Math.min(100, Math.floor(Number(task?.successRate || 0))));
      const durationMinutes = Math.max(1, Math.floor(Number(task?.durationMinutes || 1)));
      const difficulty = resolveEventDifficultyMeta(task.difficulty);
      const runState = getRenderedRunState(task);
      const isBlockedByOtherRun = activeRun.active && !runState.active;
      const metaLabel = `Úspěšnost ${successRate}% • ${durationMinutes} min${runState.active ? ` • Probíhá ${runState.remainingSec}s` : ""}${task.attempted ? " • Využito" : ""}${isBlockedByOtherRun ? ` • Čekej ${activeRun.remainingSec}s` : ""}`;
      return `
        <div class="events-task${runState.active || task.attempted || task.canStart === false ? " events-task--locked" : ""}${isBlockedByOtherRun ? " events-task--queue-locked" : ""}" data-event-open="${escapeHtml(task.id || "")}">
          <div class="events-task__title">${escapeHtml(task.title)}</div>
          <div class="events-task__desc">${escapeHtml(task.desc)}</div>
          <div class="events-task__meta">
            <span>${escapeHtml(metaLabel)}</span>
            <span class="event-difficulty event-difficulty--${difficulty.key}">${difficulty.label}</span>
          </div>
        </div>
      `;
    }).join("");
    modal.classList.remove("events-modal--compact");
  };

  const openModal = () => {
    if (!shouldRunLocalCityEvents() && !shouldRunServerCityEvents()) return;
    const claimed = shouldRunLocalCityEvents()
      ? claimPendingCityEventRewards()
      : { claimedRewards: [], pendingRewards: [] };
    syncAgentUnlockBadges();
    agentButtons.forEach((btn) => btn.classList.remove("is-active"));
    if (agentName) agentName.textContent = "Vyber postavu";
    if (agentType) agentType.textContent = "Každý nabízí jiné zakázky";
    if (agentDesc) {
      const serverPendingCount = getServerCityEventsView()?.pendingRewards?.length || 0;
      agentDesc.textContent = claimed.claimedRewards.length
        ? `Do SKLADU se přesunula čekající odměna: ${claimed.claimedRewards.join(", ")}.`
        : claimed.pendingRewards.length
          ? `Část odměn čeká u kontaktů na místo ve SKLADU: ${claimed.pendingRewards.join(", ")}.`
          : serverPendingCount > 0
            ? `Na vyzvednutí čeká ${serverPendingCount} serverových odměn. Vyber kontakt a zkontroluj nabídky.`
            : "Vyber kontakt a zobrazí se jeho dočasné pouliční zakázky.";
    }
    if (agentQuote) agentQuote.textContent = "";
    tasklist.innerHTML = "";
    modal.classList.add("events-modal--compact");
    syncRefreshLabel();
    modal.hidden = false;
    modal.classList.remove("hidden");
    openOverlay(modal, { type: "modal", ariaModal: true, restoreFocusOnClose: true });
    closeBtn?.focus({ preventScroll: true });
    document.dispatchEvent(new CustomEvent("empire:city-events-opened", { detail: { open: true } }));
  };

  const closeModal = () => {
    if (selectedEventTask) {
      closeEventDetailModal();
    }
    modal.classList.add("hidden");
    modal.hidden = true;
    modal.classList.add("events-modal--compact");
    closeOverlay(modal, { restoreFocus: true });
  };

  const finalizeCityEventRun = (taskId) => {
    const state = getStoredCityEventsState();
    const run = state.activeRuns.find((entry) => String(entry?.id || "") === String(taskId || ""));
    if (!run) return;

    const task = taskLookup.get(String(run.taskId || ""));
    updateStoredCityEventsState((current) => ({
      ...current,
      activeRuns: current.activeRuns.filter((entry) => String(entry?.id || "") !== String(taskId || ""))
    }));

    if (!task) return;

    const successRoll = hashCityEventSeed(run.outcomeSeed || `${run.offerId || run.taskId}:outcome`) % 100;
    const wasSuccess = successRoll < Math.max(0, Math.min(100, Number(task?.successRate || 0)));
    const outcomeLine = resolveRandomOutcomeLine(task, wasSuccess, `${run.outcomeSeed || run.taskId}:copy`);
    let appliedRewards = [];
    let pendingRewards = [];

    if (wasSuccess) {
      const rewardResult = applyEventRewardsToPlayerState(root, task);
      appliedRewards = rewardResult.appliedRewards;
      pendingRewards = rewardResult.pendingRewards;
      const gainInfo = appliedRewards.length ? ` • Zisk: ${appliedRewards.join(", ")}` : "";
      const pendingInfo = pendingRewards.length
        ? ` • Čeká u kontaktu kvůli plnému SKLADU: ${pendingRewards.join(", ")}`
        : "";
      writeCityEventsInfo(`${outcomeLine}${gainInfo}${pendingInfo}`);
      applyTopbarEconomy(root);
      renderSpyResourceState(root);
    } else {
      const loss = Math.max(0, Math.floor(Number(task.failureDirtyCashLoss || 0)));
      if (loss > 0) {
        updateStoredPreviewSession((session) => ({
          ...session,
          economy: {
            ...(session.economy || {}),
            dirtyMoney: Math.max(0, Math.floor(Number(session.economy?.dirtyMoney || 0)) - loss)
          }
        }));
        applyTopbarEconomy(root);
      }
      writeCityEventsInfo(outcomeLine);
    }
    const resolvedHeat = wasSuccess
      ? Math.max(0, Math.floor(Number(task.successHeat || 0)))
      : Math.max(0, Math.floor(Number(task.failureHeat || 0)));
    if (resolvedHeat > 0) addGangHeat(root, resolvedHeat, `Pouliční zakázka: ${task.title}`);

    const resultPayload = createCityEventResultStreetNewsPayload(task, run, wasSuccess, outcomeLine, appliedRewards);
    if (pendingRewards.length) {
      resultPayload.rows.splice(5, 0, { label: "Čeká u kontaktu", value: pendingRewards.join(", ") });
      resultPayload.summary = `${resultPayload.summary} Část odměny čeká na volné místo ve SKLADU.`;
    }
    appendBuildingActionResultEntry(root, "police", resultPayload, {
      id: `city-event-result-${String(task.id || run.taskId || "event")}-${Date.now()}`,
      tone: "event",
      title: resultPayload.title,
      summary: resultPayload.summary,
      meta: wasSuccess ? "Výsledek lokální zakázky a zisk" : "Výsledek lokální zakázky"
    }, { syncPreview: true, forceLog: true });

    if (selectedAgentKey) {
      renderTasks(selectedAgentKey);
    }
    if (selectedEventTask && String(selectedEventTask.id || "") === String(task.id || "")) {
      openEventDetailModal(task);
    }
  };

  const startCityEventRun = (task) => {
    const taskId = String(task?.id || "").trim();
    if (!taskId) return false;
    const agent = AGENTS[task?.agentKey || ""];
    const unlockState = resolveAgentUnlockState(root, agent);
    if (!unlockState.unlocked) {
      writeCityEventsInfo(`Zakázka je zamčená. Potřebuješ ${unlockState.requiredInfluence} vliv, teď máš ${unlockState.currentInfluence}.`);
      return false;
    }
    const currentState = getStoredCityEventsState();
    const offerId = String(task?.offerId || taskId).trim();
    if (task.attempted || currentState.attemptedOfferIds.includes(offerId)) {
      writeCityEventsInfo("Tuto nabídku už jsi v aktuálním okně využil.");
      return false;
    }
    if (currentState.activeRuns.some((entry) => String(entry?.id || "") === taskId)) {
      writeCityEventsInfo(`Zakázka ${task.title} už běží.`);
      return false;
    }
    const activeRun = getActiveCityEventRun();
    if (activeRun.active) {
      const activeTitle = activeRun.task?.title || "jiná zakázka";
      writeCityEventsInfo(`Nejdřív musí doběhnout ${activeTitle}. Další zakázku můžeš vybrat za ${activeRun.remainingSec}s.`);
      return false;
    }
    const durationSec = Math.max(1, Math.floor(Number(task?.durationSec || 1)));
    const nowMs = Date.now();
    const runEntry = {
      id: taskId,
      taskId,
      offerId,
      scheduleWindowId: task.scheduleWindowId || "local-demo",
      startedAt: nowMs,
      endsAt: nowMs + (durationSec * 1000),
      outcomeSeed: `local-demo:${offerId}:${nowMs}`
    };
    updateStoredCityEventsState((state) => ({
      ...state,
      activeRuns: [
        ...state.activeRuns,
        runEntry
      ],
      attemptedOfferIds: [...state.attemptedOfferIds, offerId]
    }));
    const newsPayload = createCityEventStreetNewsPayload(task, runEntry);
    appendBuildingActionResultEntry(root, "police", newsPayload, {
      id: `city-event-start-${taskId}-${runEntry.startedAt}`,
      tone: "event",
      title: `Lokální zakázka spuštěna: ${task.title}`,
      summary: newsPayload.summary,
      meta: `${newsPayload.giver} · zbývá ${durationSec}s`
    }, { syncPreview: true, forceLog: true });
    writeCityEventsInfo(`Zakázka běží: ${task.title} • dokončení za ${task.durationMinutes} min • při úspěchu Heat +${task.successHeat}, při selhání Heat +${task.failureHeat}`);
    if (selectedAgentKey) {
      renderTasks(selectedAgentKey);
    }
    return true;
  };

  const syncRefreshLabel = () => {
    if (!eventsRefreshCountdown) return;
    if (shouldRunServerCityEvents()) {
      const cityEvents = getServerCityEventsView();
      const agent = getServerAgent(selectedAgentKey || "victor");
      eventsRefreshCountdown.textContent = cityEvents
        ? `MĚSTSKÝ ČAS ${cityEvents.cityClock?.label || "--:--"} · ${agent?.scheduleLabel || "serverové nabídky"}`
        : "SERVEROVÉ NABÍDKY NEDOSTUPNÉ";
      return;
    }
    const schedule = resolveLocalScheduleWindow(selectedAgentKey || "victor");
    const nextText = `MĚSTSKÝ ČAS · další úkoly ${schedule.nextBoundaryLabel}`;
    if (eventsRefreshCountdown.textContent !== nextText) {
      eventsRefreshCountdown.textContent = nextText;
    }
  };

  openBtn.addEventListener("click", openModal);
  backdrop?.addEventListener("click", closeModal);
  closeBtn?.addEventListener("click", closeModal);
  detailBackdrop?.addEventListener("click", closeEventDetailModal);
  detailCloseBtn?.addEventListener("click", closeEventDetailModal);
  detailDeclineBtn?.addEventListener("click", closeEventDetailModal);
  detailAcceptBtn?.addEventListener("click", async () => {
    if (!selectedEventTask) return;
    if (shouldRunServerCityEvents()) {
      if (serverSubmitPending || selectedEventTask.canStart === false) return;
      serverSubmitPending = true;
      openEventDetailModal(selectedEventTask);
      const response = await submitServerCityEventCommand({ action: "start", id: selectedEventTask.offerId });
      serverSubmitPending = false;
      if (response?.accepted) {
        closeEventDetailModal();
      } else {
        writeCityEventsInfo(response?.errors?.[0]?.message || "Zakázku se nepodařilo spustit.");
        openEventDetailModal(selectedEventTask);
      }
      return;
    }
    if (shouldRunLocalCityEvents() && startCityEventRun(selectedEventTask)) {
      closeEventDetailModal();
    }
  });

  agentButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const agentKey = String(button.dataset.agent || "");
      renderTasks(agentKey);
      document.dispatchEvent(new CustomEvent("empire:city-events-agent-selected", {
        detail: {
          agentKey,
          agentName: AGENTS[agentKey]?.name || null
        }
      }));
    });
  });

  tasklist.addEventListener("click", async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const claimButton = target.closest("[data-city-event-claim]");
    if (claimButton instanceof HTMLButtonElement && shouldRunServerCityEvents()) {
      if (serverSubmitPending || claimButton.disabled) return;
      serverSubmitPending = true;
      claimButton.disabled = true;
      const response = await submitServerCityEventCommand({ action: "claim", id: claimButton.dataset.cityEventClaim });
      serverSubmitPending = false;
      if (!response?.accepted) writeCityEventsInfo(response?.errors?.[0]?.message || "Odměnu se nepodařilo vyzvednout.");
      if (selectedAgentKey) renderTasks(selectedAgentKey);
      return;
    }
    const row = target.closest("[data-event-open]");
    if (!(row instanceof HTMLElement)) return;
    const taskId = String(row.dataset.eventOpen || "").trim();
    const selectedTask = selectedAgentKey
      ? getRenderedTasks(selectedAgentKey).find((task) => String(task.id) === taskId)
      : taskLookup.get(taskId);
    if (selectedTask) {
      openEventDetailModal(selectedTask);
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !detailModal.classList.contains("hidden")) {
      closeEventDetailModal();
      return;
    }
    if (event.key === "Escape" && !modal.classList.contains("hidden")) {
      closeModal();
    }
  });

  const tick = (nowMs = Date.now()) => {
    syncAgentUnlockBadges();
    const claimed = claimPendingCityEventRewards();
    if (claimed.claimedRewards.length && !modal.classList.contains("hidden")) {
      writeCityEventsInfo(`Do SKLADU se přesunula čekající odměna: ${claimed.claimedRewards.join(", ")}.`);
    }
    const state = getStoredCityEventsState();
    const expiredRuns = state.activeRuns.filter((entry) => Number(entry?.endsAt || 0) <= nowMs);
    expiredRuns.forEach((entry) => finalizeCityEventRun(entry.id));

    if (selectedAgentKey && !modal.classList.contains("hidden")) {
      renderTasks(selectedAgentKey);
    }
    if (selectedEventTask && !detailModal.classList.contains("hidden")) {
      const refreshedTask = selectedAgentKey
        ? resolveVisibleCharacterTasks(selectedAgentKey, AGENTS[selectedAgentKey]?.tasks)
            .find((task) => String(task.id) === String(selectedEventTask.id)) || selectedEventTask
        : selectedEventTask;
      openEventDetailModal(refreshedTask);
    }
    syncRefreshLabel();
  };

  let unbindLifecycleTicker = null;
  const stopLocalTimers = () => {
    unbindLifecycleTicker?.();
    unbindLifecycleTicker = null;
    diagnostics?.setLocalTickActive?.("legacy-city-events", false);
  };
  const startLocalTimers = () => {
    if (!shouldRunLocalCityEvents() || unbindLifecycleTicker || document.hidden) return;
    tick();
    unbindLifecycleTicker = bindSharedCountdown(openBtn, () => Date.now(), {
      render: (nowMs) => {
        diagnostics?.recordLocalTick?.();
        tick(Number(nowMs));
      }
    });
    diagnostics?.setLocalTickActive?.("legacy-city-events", true);
  };
  const restartLocalTimers = () => {
    stopLocalTimers();
    const available = shouldRunLocalCityEvents() || shouldRunServerCityEvents();
    openBtn.hidden = !available;
    openBtn.setAttribute("aria-hidden", available ? "false" : "true");
    if (!available && !modal.classList.contains("hidden")) closeModal();
    startLocalTimers();
  };
  const handleServerSliceRendered = () => {
    if (!shouldRunServerCityEvents()) return;
    syncAgentUnlockBadges();
    if (selectedAgentKey && !modal.classList.contains("hidden")) renderTasks(selectedAgentKey);
    if (selectedEventTask && !detailModal.classList.contains("hidden")) {
      const refreshedTask = getRenderedTasks(selectedEventTask.agentKey)
        .find((task) => task.offerId === selectedEventTask.offerId);
      if (refreshedTask) openEventDetailModal(refreshedTask);
      else closeEventDetailModal();
    }
  };
  const handleVisibilityChange = () => {
    if (document.hidden) stopLocalTimers();
    else startLocalTimers();
  };

  document.addEventListener("empire:runtime-mode-changed", restartLocalTimers);
  document.addEventListener("empire:gameplay-slice-rendered", handleServerSliceRendered);
  document.addEventListener("visibilitychange", handleVisibilityChange);
  window.addEventListener("empire:mobile-performance-mode-changed", restartLocalTimers);
  window.addEventListener("beforeunload", () => {
    stopLocalTimers();
    document.removeEventListener("empire:runtime-mode-changed", restartLocalTimers);
    document.removeEventListener("empire:gameplay-slice-rendered", handleServerSliceRendered);
    document.removeEventListener("visibilitychange", handleVisibilityChange);
    window.removeEventListener("empire:mobile-performance-mode-changed", restartLocalTimers);
  }, { once: true });
  restartLocalTimers();
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initCityEventsRuntime, { once: true });
  } else {
    initCityEventsRuntime();
  }
}

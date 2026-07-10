import { updateStoredPreviewSession } from "./model/authority-state.js";
import { appendBuildingActionResultEntry, applyTopbarEconomy, renderSpyResourceState } from "./runtime.js";
import { leonSwitchVargaEvents, nyraValeEvents, victorGraveEvents } from "../data/events.js";
import { closeOverlay, openOverlay } from "./ui/legacyOverlayCoordinator.js";

const CITY_EVENTS_STORAGE_KEY = "empireStreets.cityEvents.v1";
const CHARACTER_EVENTS_REFRESH_SECONDS = 30;
const CHARACTER_EVENTS_COUNTDOWN_SYNC_MS = 250;
const MAX_VISIBLE_EVENTS_PER_CHARACTER = 3;

const rewardLabels = Object.freeze({
  cash: "clean cash",
  dirtyCash: "dirty cash",
  influence: "influence",
  metalParts: "metal parts",
  chemical: "chemicals",
  techCore: "tech core",
  streetPistol: "street pistol",
  neonViper: "Neon Viper",
  overdriveX: "Overdrive X",
  velvetSmoke: "Velvet Smoke",
  ghostSerum: "Ghost Serum",
  smg: "SMG",
  ammo: "ammo",
  grenade: "grenade",
  spyGear: "spy gear",
  intel: "intel",
  bulletproofVest: "bulletproof vest",
  bazooka: "bazooka",
  securityCameras: "security camera",
  alarm: "alarm module"
});

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
  if (resourceKey === "cash" || resourceKey === "dirtyCash") {
    return `+${safeAmount.toLocaleString("cs-CZ")} ${label}`;
  }
  return `+${safeAmount} ${label}`;
}

function mapCityEventsToTasks(eventPool, agentKey) {
  return (Array.isArray(eventPool) ? eventPool : []).map((event) => {
    const rewardEntries = Object.entries(event.reward || {})
      .map(([key, value]) => formatRewardEntry(key, value))
      .filter(Boolean);
    const heatRisk = Math.max(0, Math.floor(Number(event?.risk?.heat || 0)));
    return {
      id: event.id,
      agentKey,
      giver: String(event.giver || "").trim(),
      title: event.title,
      desc: event.text,
      reward: { ...(event.reward || {}) },
      gains: rewardEntries,
      risk: heatRisk > 0 ? `Heat +${heatRisk}` : "",
      successRate: Math.max(0, Math.min(100, Math.floor(Number(event.successRate || 0)))),
      durationSec: Math.max(1, Math.floor(Number(event.durationMin || 1)))
    };
  });
}

function resolveEventDifficultyMeta(successRate) {
  const value = Math.max(0, Math.min(100, Math.floor(Number(successRate || 0))));
  if (value >= 86) return { key: "easy", label: "Easy" };
  if (value >= 73) return { key: "medium", label: "Medium" };
  return { key: "hard", label: "Hard" };
}

const victorTasks = mapCityEventsToTasks(victorGraveEvents, "victor");
const leonTasks = mapCityEventsToTasks(leonSwitchVargaEvents, "leon");
const nyraTasks = mapCityEventsToTasks(nyraValeEvents, "nira");

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

function createDefaultCityEventsState() {
  return {
    poolIndexes: {
      victor: 0,
      leon: 0,
      nira: 0
    },
    nextRefreshAt: Date.now() + (CHARACTER_EVENTS_REFRESH_SECONDS * 1000),
    activeRuns: [],
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
    poolIndexes: {
      ...base.poolIndexes,
      ...(state?.poolIndexes || {})
    },
    nextRefreshAt: Number(state?.nextRefreshAt || base.nextRefreshAt),
    activeRuns: Array.isArray(state?.activeRuns) ? state.activeRuns : [],
    eventResources: {
      ...base.eventResources,
      ...(state?.eventResources || {})
    }
  };
}

function getStoredCityEventsState() {
  try {
    const rawValue = window.localStorage.getItem(CITY_EVENTS_STORAGE_KEY);
    if (!rawValue) {
      const defaultState = createDefaultCityEventsState();
      window.localStorage.setItem(CITY_EVENTS_STORAGE_KEY, JSON.stringify(defaultState));
      return defaultState;
    }

    const parsedState = JSON.parse(rawValue);
    const normalizedState = normalizeCityEventsState(parsedState);
    const storedRefreshAt = Number(parsedState?.nextRefreshAt || 0);
    if (!Number.isFinite(storedRefreshAt) || storedRefreshAt <= 0) {
      window.localStorage.setItem(CITY_EVENTS_STORAGE_KEY, JSON.stringify(normalizedState));
    }
    return normalizedState;
  } catch {
    const defaultState = createDefaultCityEventsState();
    try {
      window.localStorage.setItem(CITY_EVENTS_STORAGE_KEY, JSON.stringify(defaultState));
    } catch {
      // Local UX only.
    }
    return defaultState;
  }
}

function setStoredCityEventsState(state) {
  try {
    window.localStorage.setItem(CITY_EVENTS_STORAGE_KEY, JSON.stringify(normalizeCityEventsState(state)));
  } catch {
    // Local UX only.
  }
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

function resolveVisibleCharacterTasks(poolKey, tasks) {
  const safeTasks = Array.isArray(tasks) ? tasks : [];
  if (!safeTasks.length) return [];

  const activePinned = safeTasks
    .filter((task) => getCityEventRunState(task?.id).active)
    .slice(0, MAX_VISIBLE_EVENTS_PER_CHARACTER);
  const remainingSlots = Math.max(0, MAX_VISIBLE_EVENTS_PER_CHARACTER - activePinned.length);
  if (remainingSlots <= 0) return activePinned;

  const rotatingPool = safeTasks.filter((task) => {
    const taskId = String(task?.id || "").trim();
    return !activePinned.some((activeTask) => String(activeTask?.id || "").trim() === taskId);
  });
  if (!rotatingPool.length) return activePinned;
  if (rotatingPool.length <= remainingSlots) return [...activePinned, ...rotatingPool];

  const poolIndexes = getStoredCityEventsState().poolIndexes;
  const offset = Math.max(0, Math.floor(Number(poolIndexes[poolKey] || 0))) % rotatingPool.length;
  const rotated = [];

  for (let index = 0; index < remainingSlots; index += 1) {
    rotated.push(rotatingPool[(offset + index) % rotatingPool.length]);
  }

  return [...activePinned, ...rotated];
}

function countActiveCharacterRuns(tasks, activeRuns, nowMs = Date.now()) {
  const taskIds = new Set((Array.isArray(tasks) ? tasks : []).map((task) => String(task?.id || "").trim()).filter(Boolean));
  if (!taskIds.size) return 0;

  const activeIds = new Set();
  (Array.isArray(activeRuns) ? activeRuns : []).forEach((entry) => {
    const taskId = String(entry?.taskId || entry?.id || "").trim();
    if (taskId && taskIds.has(taskId) && Number(entry?.endsAt || 0) > nowMs) {
      activeIds.add(taskId);
    }
  });

  return Math.min(MAX_VISIBLE_EVENTS_PER_CHARACTER, activeIds.size);
}

function resolveEventOutcomePool(task, wasSuccess) {
  const title = String(task?.title || "Event").trim();
  const risk = String(task?.risk || "Heat +0").trim();
  const durationSec = Math.max(1, Math.floor(Number(task?.durationSec || 1)));
  if (wasSuccess) {
    return [
      `${title}: operace proběhla čistě. Výsledek dorazil do skladu.`,
      `${title}: cíl splněn za ${durationSec}s. Trasa byla tichá a bez úniku.`,
      `${title}: úspěch. ${risk} zůstalo pod kontrolou.`
    ];
  }
  return [
    `${title}: akce se rozpadla během přesunu. Bez zisku.`,
    `${title}: operace selhala. Kontakt zmizel ještě před dokončením.`,
    `${title}: průser. ${risk} vystřelilo nahoru a zisk je nulový.`
  ];
}

function resolveRandomOutcomeLine(task, wasSuccess) {
  const pool = resolveEventOutcomePool(task, wasSuccess);
  const index = Math.max(0, Math.floor(Math.random() * pool.length)) % pool.length;
  return String(pool[index] || pool[0] || "").trim();
}

function createCityEventStreetNewsPayload(task, run) {
  const durationSec = Math.max(1, Math.floor(Number(task?.durationSec || 1)));
  const gains = Array.isArray(task?.gains) ? task.gains.filter(Boolean) : [];
  const remainingSec = Math.max(0, Math.ceil((Number(run?.endsAt || 0) - Date.now()) / 1000));
  return {
    tone: "is-specialty-financial",
    title: `City Event spuštěn: ${String(task?.title || "City Event").trim()}`,
    taskTitle: String(task?.title || "City Event").trim(),
    badge: "Probíhající úkol",
    liveRowsKind: "city_event",
    refreshMs: 1000,
    syncToBuildingAction: false,
    summary: `Úkol běží: ${String(task?.title || "City Event").trim()}. Klikni pro zbývající čas a možný zisk.`,
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
  const title = String(task?.title || "City Event").trim();
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
    title: `City Event dokončen: ${title}`,
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

function getTopbarInfluenceValue(root) {
  const influenceElement = root.querySelector("[data-topbar-influence]");
  const raw = influenceElement?.dataset.influenceValue || influenceElement?.textContent || "0";
  return Math.max(0, Math.floor(Number(raw || 0) || 0));
}

function resolveAgentUnlockState(root, agent) {
  const requiredInfluence = Math.max(0, Math.floor(Number(agent?.requiredInfluence || 0)));
  const currentInfluence = getTopbarInfluenceValue(root);
  return {
    requiredInfluence,
    currentInfluence,
    unlocked: currentInfluence >= requiredInfluence
  };
}

function setTopbarInfluenceValue(root, nextValue) {
  const safeValue = Math.max(0, Math.floor(Number(nextValue || 0)));
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
  if (!rewardEntries.length) return [];

  let nextInfluence = getTopbarInfluenceValue(root);

  updateStoredPreviewSession((session) => {
    const nextSession = {
      ...session,
      economy: { ...(session.economy || {}) },
      inventory: {
        ...(session.inventory || {}),
        weapons: { ...(session.inventory?.weapons || {}) },
        materials: { ...(session.inventory?.materials || {}) },
        drugs: { ...(session.inventory?.drugs || {}) },
        factorySupplies: { ...(session.inventory?.factorySupplies || {}) },
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

      switch (key) {
        case "cash":
          nextSession.economy.cleanMoney = Math.max(0, Math.floor(Number(nextSession.economy.cleanMoney || 0) + amount));
          break;
        case "dirtyCash":
          nextSession.economy.dirtyMoney = Math.max(0, Math.floor(Number(nextSession.economy.dirtyMoney || 0) + amount));
          break;
        case "influence":
          nextInfluence += amount;
          break;
        case "metalParts":
          nextSession.inventory.factorySupplies.metalParts = Math.max(0, Math.floor(Number(nextSession.inventory.factorySupplies.metalParts || 0) + amount));
          break;
        case "techCore":
          nextSession.inventory.factorySupplies.techCore = Math.max(0, Math.floor(Number(nextSession.inventory.factorySupplies.techCore || 0) + amount));
          break;
        case "chemical":
        case "chemicals":
          nextSession.inventory.materials.chemicals = Math.max(0, Math.floor(Number(nextSession.inventory.materials.chemicals || 0) + amount));
          break;
        case "streetPistol":
          nextSession.inventory.weapons.pistol = Math.max(0, Math.floor(Number(nextSession.inventory.weapons.pistol || 0) + amount));
          break;
        case "grenade":
          nextSession.inventory.weapons.grenade = Math.max(0, Math.floor(Number(nextSession.inventory.weapons.grenade || 0) + amount));
          break;
        case "smg":
          nextSession.inventory.weapons.smg = Math.max(0, Math.floor(Number(nextSession.inventory.weapons.smg || 0) + amount));
          break;
        case "bazooka":
          nextSession.inventory.weapons.bazooka = Math.max(0, Math.floor(Number(nextSession.inventory.weapons.bazooka || 0) + amount));
          break;
        case "bulletproofVest":
          nextSession.inventory.weapons.vest = Math.max(0, Math.floor(Number(nextSession.inventory.weapons.vest || 0) + amount));
          break;
        case "securityCameras":
          nextSession.inventory.weapons.cameras = Math.max(0, Math.floor(Number(nextSession.inventory.weapons.cameras || 0) + amount));
          break;
        case "alarm":
          nextSession.inventory.weapons.alarm = Math.max(0, Math.floor(Number(nextSession.inventory.weapons.alarm || 0) + amount));
          break;
        case "neonViper":
          nextSession.inventory.drugs["neon-dust"] = Math.max(0, Math.floor(Number(nextSession.inventory.drugs["neon-dust"] || 0) + amount));
          break;
        case "velvetSmoke":
          nextSession.inventory.drugs["velvet-smoke"] = Math.max(0, Math.floor(Number(nextSession.inventory.drugs["velvet-smoke"] || 0) + amount));
          break;
        case "ghostSerum":
          nextSession.inventory.drugs["ghost-serum"] = Math.max(0, Math.floor(Number(nextSession.inventory.drugs["ghost-serum"] || 0) + amount));
          break;
        case "overdriveX":
          nextSession.inventory.drugs["overdrive-x"] = Math.max(0, Math.floor(Number(nextSession.inventory.drugs["overdrive-x"] || 0) + amount));
          break;
        case "ammo":
          nextSession.inventory.eventResources.ammo = Math.max(0, Math.floor(Number(nextSession.inventory.eventResources.ammo || 0) + amount));
          break;
        case "spyGear":
          nextSession.inventory.eventResources.spyGear = Math.max(0, Math.floor(Number(nextSession.inventory.eventResources.spyGear || 0) + amount));
          break;
        case "intel":
          nextSession.inventory.eventResources.intel = Math.max(0, Math.floor(Number(nextSession.inventory.eventResources.intel || 0) + amount));
          break;
        default:
          break;
      }
    }

    return nextSession;
  });

  setTopbarInfluenceValue(root, nextInfluence);
  return rewardEntries.map(([key, value]) => formatRewardEntry(key, value)).filter(Boolean);
}

function initCityEventsRuntime() {
  const root = document.querySelector("main[data-page='game']");
  if (!root) return;

  const diagnostics = window.empireStreetsRuntimeDiagnostics || null;
  const shouldRunLocalCityEvents = () => diagnostics?.shouldRunLocalTick?.() ?? false;

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
      const unlockState = resolveAgentUnlockState(root, agent);
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
          ? `Questy odemčené. Vliv ${unlockState.currentInfluence}/${unlockState.requiredInfluence}.`
          : `Questy zamčené. Potřebuješ ${unlockState.requiredInfluence} vliv. Teď máš ${unlockState.currentInfluence}.`;
      } else {
        button.removeAttribute("title");
      }
    });
  };

  const closeEventDetailModal = () => {
    detailModal.classList.add("hidden");
    detailModal.hidden = true;
    closeOverlay(detailModal, { restoreFocus: false });
    selectedEventTask = null;
  };

  const openEventDetailModal = (task) => {
    if (!task) return;
    selectedEventTask = task;
    const difficulty = resolveEventDifficultyMeta(task.successRate);
    const runState = getCityEventRunState(task.id);
    const activeRun = getActiveCityEventRun();
    const isBlockedByOtherRun = activeRun.active && !runState.active;
    const disabledReason = isBlockedByOtherRun
      ? `Jiný event probíhá (${activeRun.remainingSec}s)`
      : "";
    if (detailTitle) detailTitle.textContent = String(task.title || "Detail eventu");
    if (detailGiver) detailGiver.textContent = String(task.giver || AGENTS[task.agentKey || ""]?.name || "-");
    if (detailStats) {
      detailStats.innerHTML = `
        <span>Úspěšnost ${Math.max(0, Math.floor(Number(task.successRate || 0)))}% • ${Math.max(1, Math.floor(Number(task.durationSec || 1)))} s${runState.active ? ` • Probíhá ${runState.remainingSec}s` : ""}${disabledReason ? ` • ${disabledReason}` : ""}</span>
        <span class="event-difficulty event-difficulty--${difficulty.key}">${difficulty.label}</span>
      `;
    }
    if (detailDesc) detailDesc.textContent = String(task.desc || "");
    renderDetailChips(detailGains, task.gains, "gain");
    renderDetailChips(detailRisk, task.risk ? [task.risk] : [], "risk");
    if (detailAcceptBtn) {
      detailAcceptBtn.disabled = runState.active || isBlockedByOtherRun;
      detailAcceptBtn.textContent = runState.active
        ? `Probíhá (${runState.remainingSec}s)`
        : isBlockedByOtherRun
        ? `Počkej ${activeRun.remainingSec}s`
        : "Začít";
    }
    openOverlay(detailModal, { type: "modal", ariaModal: true, restoreFocusOnClose: false });
    detailModal.hidden = false;
    detailModal.classList.remove("hidden");
  };

  const renderTasks = (agentKey) => {
    const agent = AGENTS[agentKey];
    if (!agent) return;
    syncAgentUnlockBadges();
    selectedAgentKey = agentKey;
    agentButtons.forEach((btn) => btn.classList.toggle("is-active", btn.dataset.agent === agentKey));
    if (agentName) agentName.textContent = agent.name;
    if (agentType) agentType.textContent = agent.type;
    if (agentDesc) agentDesc.textContent = agent.desc;
    if (agentQuote) agentQuote.textContent = agent.quote;

    const unlockState = resolveAgentUnlockState(root, agent);
    if (!unlockState.unlocked) {
      if (agentDesc) {
        agentDesc.textContent = `${agent.desc} Questy se odemknou až při ${unlockState.requiredInfluence} vlivu. Teď máš ${unlockState.currentInfluence}.`;
      }
      tasklist.innerHTML = `
        <div class="events-task events-task--agent-locked">
          <div class="events-task__title">Questy zamčené</div>
          <div class="events-task__desc">Potřebuješ alespoň ${unlockState.requiredInfluence} vliv. Aktuálně máš ${unlockState.currentInfluence}.</div>
        </div>
      `;
      modal.classList.remove("events-modal--compact");
      return;
    }

    const visibleTasks = resolveVisibleCharacterTasks(agentKey, agent.tasks);
    const activeRun = getActiveCityEventRun();
    tasklist.innerHTML = visibleTasks.map((task) => {
      const successRate = Math.max(0, Math.min(100, Math.floor(Number(task?.successRate || 0))));
      const durationSec = Math.max(1, Math.floor(Number(task?.durationSec || 1)));
      const difficulty = resolveEventDifficultyMeta(successRate);
      const runState = getCityEventRunState(task?.id);
      const isBlockedByOtherRun = activeRun.active && !runState.active;
      const metaLabel = `Úspěšnost ${successRate}% • ${durationSec}s${runState.active ? ` • Probíhá ${runState.remainingSec}s` : ""}${isBlockedByOtherRun ? ` • Čekej ${activeRun.remainingSec}s` : ""}`;
      return `
        <div class="events-task${runState.active ? " events-task--locked" : ""}${isBlockedByOtherRun ? " events-task--queue-locked" : ""}" data-event-open="${escapeHtml(task.id || "")}">
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
    syncAgentUnlockBadges();
    agentButtons.forEach((btn) => btn.classList.remove("is-active"));
    if (agentName) agentName.textContent = "Vyber postavu";
    if (agentType) agentType.textContent = "Každá má jiné questy";
    if (agentDesc) agentDesc.textContent = "Klikni na postavu a zobrazí se její popis a dočasné úkoly.";
    if (agentQuote) agentQuote.textContent = "";
    tasklist.innerHTML = "";
    modal.classList.add("events-modal--compact");
    openOverlay(modal, { type: "modal", ariaModal: true, restoreFocusOnClose: false });
    modal.hidden = false;
    modal.classList.remove("hidden");
    document.dispatchEvent(new CustomEvent("empire:city-events-opened", { detail: { open: true } }));
  };

  const closeModal = () => {
    if (selectedEventTask) {
      closeEventDetailModal();
    }
    modal.classList.add("hidden");
    modal.hidden = true;
    modal.classList.add("events-modal--compact");
    closeOverlay(modal, { restoreFocus: false });
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

    const successRoll = Math.random() * 100;
    const wasSuccess = successRoll <= Math.max(0, Math.min(100, Number(task?.successRate || 0)));
    const outcomeLine = resolveRandomOutcomeLine(task, wasSuccess);
    let appliedRewards = [];

    if (wasSuccess) {
      appliedRewards = applyEventRewardsToPlayerState(root, task);
      const gainInfo = appliedRewards.length ? ` • Zisk: ${appliedRewards.join(", ")}` : "";
      writeCityEventsInfo(`${outcomeLine}${gainInfo}`);
      applyTopbarEconomy(root);
      renderSpyResourceState(root);
    } else {
      writeCityEventsInfo(outcomeLine);
    }

    const resultPayload = createCityEventResultStreetNewsPayload(task, run, wasSuccess, outcomeLine, appliedRewards);
    appendBuildingActionResultEntry(root, "police", resultPayload, {
      id: `city-event-result-${String(task.id || run.taskId || "event")}-${Date.now()}`,
      tone: "event",
      title: resultPayload.title,
      summary: resultPayload.summary,
      meta: wasSuccess ? "Výsledek city eventu a zisk" : "Výsledek city eventu"
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
      writeCityEventsInfo(`Quest je zamčený. Potřebuješ ${unlockState.requiredInfluence} vliv, teď máš ${unlockState.currentInfluence}.`);
      return false;
    }
    const currentState = getStoredCityEventsState();
    if (currentState.activeRuns.some((entry) => String(entry?.id || "") === taskId)) {
      writeCityEventsInfo(`Event ${task.title} už běží.`);
      return false;
    }
    const activeRun = getActiveCityEventRun();
    if (activeRun.active) {
      const activeTitle = activeRun.task?.title || "jiný event";
      writeCityEventsInfo(`Nejdřív musí doběhnout ${activeTitle}. Další event můžeš vybrat za ${activeRun.remainingSec}s.`);
      return false;
    }
    const durationSec = Math.max(1, Math.floor(Number(task?.durationSec || 1)));
    const nowMs = Date.now();
    const runEntry = {
      id: taskId,
      taskId,
      startedAt: nowMs,
      endsAt: nowMs + (durationSec * 1000)
    };
    updateStoredCityEventsState((state) => ({
      ...state,
      activeRuns: [
        ...state.activeRuns,
        runEntry
      ]
    }));
    const newsPayload = createCityEventStreetNewsPayload(task, runEntry);
    appendBuildingActionResultEntry(root, "police", newsPayload, {
      id: `city-event-start-${taskId}-${runEntry.startedAt}`,
      tone: "event",
      title: `City Event spuštěn: ${task.title}`,
      summary: newsPayload.summary,
      meta: `${newsPayload.giver} · zbývá ${durationSec}s`
    }, { syncPreview: true, forceLog: true });
    writeCityEventsInfo(`Event běží: ${task.title} • dokončení za ${durationSec}s`);
    if (selectedAgentKey) {
      renderTasks(selectedAgentKey);
    }
    return true;
  };

  const rotateCharacterEvents = () => {
    const nowMs = Date.now();
    const resolveNextPoolIndex = (poolKey, tasks, state) => {
      const safeTasks = Array.isArray(tasks) ? tasks : [];
      if (!safeTasks.length) return 0;
      const currentIndex = Math.max(0, Number(state.poolIndexes?.[poolKey] || 0));
      const activeCount = countActiveCharacterRuns(safeTasks, state.activeRuns, nowMs);
      const refreshSlots = Math.max(0, MAX_VISIBLE_EVENTS_PER_CHARACTER - activeCount);
      return (currentIndex + refreshSlots) % safeTasks.length;
    };

    updateStoredCityEventsState((state) => ({
      ...state,
      poolIndexes: {
        victor: resolveNextPoolIndex("victor", victorTasks, state),
        leon: resolveNextPoolIndex("leon", leonTasks, state),
        nira: resolveNextPoolIndex("nira", nyraTasks, state)
      },
      nextRefreshAt: nowMs + (CHARACTER_EVENTS_REFRESH_SECONDS * 1000)
    }));
  };

  const syncRefreshLabel = (nowMs = Date.now()) => {
    if (!eventsRefreshCountdown) return;
    const state = getStoredCityEventsState();
    const remainingSec = Math.max(0, Math.ceil((Number(state.nextRefreshAt || 0) - nowMs) / 1000));
    const nextText = `refresh ${remainingSec}s`;
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
  detailAcceptBtn?.addEventListener("click", () => {
    if (!shouldRunLocalCityEvents()) return;
    if (!selectedEventTask) return;
    if (startCityEventRun(selectedEventTask)) {
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

  tasklist.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const row = target.closest("[data-event-open]");
    if (!(row instanceof HTMLElement)) return;
    const taskId = String(row.dataset.eventOpen || "").trim();
    const selectedTask = taskLookup.get(taskId);
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
    const state = getStoredCityEventsState();
    const expiredRuns = state.activeRuns.filter((entry) => Number(entry?.endsAt || 0) <= nowMs);
    expiredRuns.forEach((entry) => finalizeCityEventRun(entry.id));

    const refreshedState = getStoredCityEventsState();
    if (Number(refreshedState.nextRefreshAt || 0) <= nowMs) {
      rotateCharacterEvents();
      if (selectedAgentKey && !modal.classList.contains("hidden")) {
        renderTasks(selectedAgentKey);
      }
    }

    if (selectedAgentKey && !modal.classList.contains("hidden")) {
      renderTasks(selectedAgentKey);
    }
    if (selectedEventTask && !detailModal.classList.contains("hidden")) {
      const refreshedTask = taskLookup.get(String(selectedEventTask.id || "")) || selectedEventTask;
      openEventDetailModal(refreshedTask);
    }
    syncRefreshLabel(nowMs);
  };

  const syncCountdownTick = () => {
    const nowMs = Date.now();
    const state = getStoredCityEventsState();
    if (Number(state.nextRefreshAt || 0) <= nowMs) {
      tick(nowMs);
      return;
    }
    syncRefreshLabel(nowMs);
  };

  let tickTimerId = null;
  let countdownTimerId = null;
  const stopLocalTimers = () => {
    if (tickTimerId !== null) window.clearInterval(tickTimerId);
    if (countdownTimerId !== null) window.clearInterval(countdownTimerId);
    tickTimerId = null;
    countdownTimerId = null;
    diagnostics?.setLocalTickActive?.("legacy-city-events", false);
  };
  const startLocalTimers = () => {
    if (!shouldRunLocalCityEvents() || tickTimerId !== null || document.hidden) return;
    const tickIntervalMs = diagnostics?.getLocalTickIntervalMs?.(1000) || 1000;
    const countdownIntervalMs = diagnostics?.getLocalTickIntervalMs?.(CHARACTER_EVENTS_COUNTDOWN_SYNC_MS)
      || CHARACTER_EVENTS_COUNTDOWN_SYNC_MS;
    tick();
    tickTimerId = window.setInterval(() => {
      diagnostics?.recordLocalTick?.();
      tick();
    }, tickIntervalMs);
    countdownTimerId = window.setInterval(syncCountdownTick, countdownIntervalMs);
    diagnostics?.setLocalTickActive?.("legacy-city-events", true);
  };
  const restartLocalTimers = () => {
    stopLocalTimers();
    startLocalTimers();
  };
  const handleVisibilityChange = () => {
    if (document.hidden) stopLocalTimers();
    else startLocalTimers();
  };

  document.addEventListener("empire:runtime-mode-changed", restartLocalTimers);
  document.addEventListener("visibilitychange", handleVisibilityChange);
  window.addEventListener("empire:mobile-performance-mode-changed", restartLocalTimers);
  window.addEventListener("beforeunload", () => {
    stopLocalTimers();
    document.removeEventListener("empire:runtime-mode-changed", restartLocalTimers);
    document.removeEventListener("visibilitychange", handleVisibilityChange);
    window.removeEventListener("empire:mobile-performance-mode-changed", restartLocalTimers);
  }, { once: true });
  startLocalTimers();
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initCityEventsRuntime, { once: true });
  } else {
    initCityEventsRuntime();
  }
}

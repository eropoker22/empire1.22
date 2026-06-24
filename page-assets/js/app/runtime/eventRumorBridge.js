import {
  normalizeCityFeedEvents,
  renderDistrictRumorFeed
} from "../ui/rumorFeedPanel.js";

const CITY_FEED_LIMIT = 50;

function safeObject(value) {
  return value && typeof value === "object" ? value : {};
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function safeText(value, fallback = "") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function collectCoreFeed(state = {}) {
  const cityFeed = safeObject(state.cityFeed || state.player?.cityFeed || state.snapshot?.cityFeed);
  return normalizeCityFeedEvents([
    ...asArray(cityFeed.currentPlayerFeed),
    ...asArray(cityFeed.globalCityFeed),
    ...asArray(state.cityFeedEvents),
    ...Object.values(safeObject(state.cityFeedEventsById))
  ]);
}

function appendBattleReportRumorNote(documentRef) {
  const stats = documentRef?.querySelector?.("#attack-result-modal-stats");
  if (!stats || stats.querySelector?.("[data-city-rumor-note]")) return false;
  const row = documentRef.createElement("div");
  const label = documentRef.createElement("span");
  const value = documentRef.createElement("strong");
  row.className = "modal__row attack-result-modal__stat attack-result-modal__extra";
  row.dataset.cityRumorNote = "true";
  label.textContent = "Město";
  value.textContent = "Město o tom začne mluvit.";
  row.append(label, value);
  stats.append(row);
  return true;
}

export function createEventRumorBridge(deps = {}) {
  const documentRef = deps.documentRef || (typeof document !== "undefined" ? document : null);
  const root = deps.root || documentRef?.querySelector?.("#game-root") || null;
  let selectedDistrictId = "";
  let localEvents = [];

  const getState = () => safeObject(typeof deps.getState === "function" ? deps.getState() : {});
  const renderDistrictFeed = (events) => {
    const list = root?.querySelector?.("[data-district-popup-gossip-list]");
    const panel = root?.querySelector?.("[data-district-popup-gossip]");
    const hasEntries = renderDistrictRumorFeed(list, events, { districtId: selectedDistrictId, limit: 5 });
    if (panel) panel.hidden = !hasEntries;
  };
  const render = () => {
    const events = normalizeCityFeedEvents([...collectCoreFeed(getState()), ...localEvents]).slice(0, CITY_FEED_LIMIT);
    renderDistrictFeed(events);
    return events;
  };
  const appendLocalEvent = (event) => {
    if (event?.serverAuthoritative === true) {
      localEvents = normalizeCityFeedEvents([event, ...localEvents]).slice(0, CITY_FEED_LIMIT);
    }
    return render();
  };
  const bindEvents = () => {
    if (!documentRef?.addEventListener) return false;
    documentRef.addEventListener("empire:result-modal-opened", (event) => {
      if (safeText(event.detail?.kind) === "attack") appendBattleReportRumorNote(documentRef);
    });
    documentRef.addEventListener("empire:district-opened", (event) => {
      selectedDistrictId = safeText(event.detail?.districtId || event.detail?.district?.id);
      render();
    });
    documentRef.addEventListener("empire:runtime-refresh", () => render());
    return true;
  };

  return {
    appendLocalEvent,
    bindEvents,
    getEvents: () => normalizeCityFeedEvents([...collectCoreFeed(getState()), ...localEvents]),
    init: () => {
      bindEvents();
      return render();
    },
    render
  };
}

if (typeof window !== "undefined") {
  window.EmpireEventRumorBridge = {
    createEventRumorBridge
  };
}

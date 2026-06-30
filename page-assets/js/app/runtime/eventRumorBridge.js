import {
  normalizeCityFeedEvent,
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

function resolveDistrictLabel(event = {}) {
  const rawDistrict = safeText(event.districtId || event.targetDistrictId || event.payload?.districtId || event.payload?.targetDistrictId);
  const districtNumber = Number.parseInt(rawDistrict.replace("district:", ""), 10);
  return Number.isFinite(districtNumber) && districtNumber > 0
    ? `District ${districtNumber}`
    : "Neznámý district";
}

function resolveRumorPlayerLabel(event = {}, deps = {}) {
  const payload = safeObject(event.payload);
  const directLabel = safeText(
    event.playerName
    || event.playerNick
    || event.targetPlayerName
    || event.targetPlayerNick
    || payload.playerName
    || payload.playerNick
    || payload.targetPlayerName
    || payload.targetPlayerNick
    || payload.ownerName
    || payload.gangName
  );

  if (directLabel) return directLabel;

  const rawPlayerId = safeText(event.targetPlayerId || event.playerId || payload.targetPlayerId || payload.playerId);
  const ownerId = Number.parseInt(rawPlayerId.replace("player:", ""), 10);
  if (Number.isFinite(ownerId) && ownerId > 0 && typeof deps.getLaunchPlayerName === "function") {
    return deps.getLaunchPlayerName(ownerId);
  }

  return rawPlayerId || "Neznámý hráč";
}

export function createRumorStreetNewsPayload(event = {}, deps = {}) {
  const rawEvent = safeObject(event);
  const normalized = normalizeCityFeedEvent(rawEvent);
  const detailEvent = {
    ...rawEvent,
    ...normalized,
    payload: {
      ...safeObject(rawEvent.payload),
      ...safeObject(normalized.payload)
    }
  };
  const districtLabel = resolveDistrictLabel(detailEvent);
  const playerLabel = resolveRumorPlayerLabel(detailEvent, deps);
  const rumorText = safeText(detailEvent.message, "Město zachytilo nejasný pohyb v ulicích.");

  return {
    title: "Drb z ulice",
    badge: "Drb",
    tone: "is-player-alert",
    summary: `${districtLabel}: ${rumorText}`,
    meta: `${districtLabel} · ${playerLabel}`,
    rows: [
      { label: "District", value: districtLabel },
      { label: "Hráč", value: playerLabel },
      { label: "Drb", value: rumorText }
    ]
  };
}

function isStreetNewsRumorEvent(event = {}) {
  const category = safeText(event.category);
  const intelType = safeText(event.intelType);
  if (category === "atmosphere") return false;
  if (category === "rumor") return true;
  return ["rumor", "suspicion", "scandal", "warning", "false_lead"].includes(intelType);
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
  const streetNewsEventIds = new Set();

  const getState = () => safeObject(typeof deps.getState === "function" ? deps.getState() : {});
  const appendRumorStreetNews = (event) => {
    if (typeof deps.appendBuildingActionResultEntry !== "function") return false;

    const normalized = normalizeCityFeedEvent(event);
    const entryId = normalized.sourceEventId || normalized.id;
    if (!entryId || streetNewsEventIds.has(entryId)) return false;
    streetNewsEventIds.add(entryId);

    const payload = createRumorStreetNewsPayload(normalized, deps);
    deps.appendBuildingActionResultEntry(root, "police", payload, {
      id: `rumor-street-news:${entryId}`,
      tone: "event",
      title: payload.title,
      summary: payload.summary,
      meta: payload.meta,
      timestampMs: normalized.timestampMs
    }, {
      syncPreview: true,
      forceLog: true,
      refresh: false
    });
    return true;
  };
  const syncStreetNews = (events = []) => {
    for (const event of events) {
      const normalized = normalizeCityFeedEvent(event);
      if (!isStreetNewsRumorEvent(normalized)) continue;
      appendRumorStreetNews(normalized);
    }
  };
  const renderDistrictFeed = (events) => {
    const list = root?.querySelector?.("[data-district-popup-gossip-list]");
    const panel = root?.querySelector?.("[data-district-popup-gossip]");
    const hasEntries = renderDistrictRumorFeed(list, events, { districtId: selectedDistrictId, limit: 5 });
    if (panel) panel.hidden = !hasEntries;
  };
  const render = () => {
    const events = normalizeCityFeedEvents([...collectCoreFeed(getState()), ...localEvents]).slice(0, CITY_FEED_LIMIT);
    renderDistrictFeed(events);
    syncStreetNews(events);
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

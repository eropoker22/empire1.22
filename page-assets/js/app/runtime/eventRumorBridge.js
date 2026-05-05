import {
  normalizeCityFeedEvents,
  renderDistrictRumorFeed,
  renderRumorFeedPanel
} from "../ui/rumorFeedPanel.js";

const CITY_FEED_STORAGE_KEY = "empireStreets.cityFeed.v1";
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

function readStorage(storage) {
  if (!storage?.getItem) return [];
  try {
    const parsed = JSON.parse(storage.getItem(CITY_FEED_STORAGE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeStorage(storage, events) {
  if (!storage?.setItem) return false;
  try {
    storage.setItem(CITY_FEED_STORAGE_KEY, JSON.stringify(events.slice(0, CITY_FEED_LIMIT)));
    return true;
  } catch {
    return false;
  }
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

function createMount(root, documentRef) {
  const existing = root?.querySelector?.("[data-rumor-feed]");
  if (existing) return existing;
  const mount = documentRef?.createElement?.("section");
  if (!mount) return null;
  const anchor = root?.querySelector?.(".building-action-status");
  const container = root?.querySelector?.("#game-left-nav") || root;
  if (anchor?.after) {
    anchor.after(mount);
  } else {
    container?.append?.(mount);
  }
  return mount;
}

function getActionDistrictId(payload = {}) {
  return safeText(
    payload.districtId
      || payload.targetDistrictId
      || payload.target
      || payload.order?.targetDistrictId
      || payload.mission?.targetDistrictId
  );
}

function getPayloadSourceId(kind, payload = {}, snapshot = {}) {
  return safeText(
    payload.sourceEventId
      || payload.actionResultId
      || payload.raidId
      || payload.battleReportId
      || payload.reportId
      || payload.heistId
      || payload.id
      || snapshot.id,
    `${kind}:${getActionDistrictId(payload)}:${safeText(payload.title || payload.summary)}`
  );
}

function createEventFromActionResult(kind, payload = {}, snapshot = {}) {
  const normalizedKind = safeText(kind, "system");
  const sourceEventId = `runtime:${normalizedKind}:${getPayloadSourceId(normalizedKind, payload, snapshot)}`;
  const districtId = getActionDistrictId(payload);
  const sourceType = resolveSourceType(normalizedKind, payload);
  return {
    id: `city-feed:${sourceEventId}`,
    sourceEventId,
    sourceType,
    category: resolveCategory(sourceType),
    severity: resolveSeverity(payload),
    truthiness: sourceType === "spy" ? "unconfirmed" : "confirmed",
    visibility: "all",
    districtId,
    createdAtTick: Number(payload.tick || 0),
    timestampMs: Date.now(),
    message: resolveRuntimeMessage(sourceType, payload, districtId),
    payload: {
      kind: normalizedKind,
      title: payload.title,
      tone: payload.tone
    }
  };
}

function resolveSourceType(kind, payload = {}) {
  if (kind === "attack") return payload.districtCaptured || payload.capturesDistrict ? "district_capture" : "attack";
  if (kind === "spy") return "spy";
  if (kind === "police") return payload.raidId || payload.pendingRaid ? "police_raid" : "police_warning";
  if (kind === "market") return "market";
  if (kind === "raid" || kind === "robbery") return "robbery";
  if (kind === "trap") return "trap";
  if (kind === "occupy") return "district_capture";
  return "system";
}

function resolveCategory(sourceType) {
  if (sourceType === "police_raid" || sourceType === "police_warning") return "police";
  if (sourceType === "attack" || sourceType === "trap") return "combat";
  if (sourceType === "market") return "economy";
  if (sourceType === "district_capture") return "district";
  return "rumor";
}

function resolveSeverity(payload = {}) {
  const tone = safeText(payload.tone || payload.badge).toLowerCase();
  if (tone.includes("catastrophe") || tone.includes("extreme")) return "extreme";
  if (tone.includes("warning") || tone.includes("trap") || Number(payload.heatGained || 0) >= 8) return "high";
  if (tone.includes("success") || Number(payload.heatGained || 0) > 0) return "medium";
  return "low";
}

function resolveRuntimeMessage(sourceType, payload = {}, districtId = "") {
  const district = districtId ? `District ${districtId}` : "jedné z horkých čtvrtí";
  if (sourceType === "district_capture") return `${district} má nového pána. Město to ucítilo okamžitě.`;
  if (sourceType === "attack") return payload.ok === false ? `U ${district} někdo narazil.` : `Z ${district} přišly zprávy o přestřelce.`;
  if (sourceType === "spy") return `Někdo si tiše prohlížel ${district}. Detaily zůstávají ve stínu.`;
  if (sourceType === "police_raid") return `Sirény přehlušily neon. Policie si vybrala ${district}.`;
  if (sourceType === "police_warning") return `Policie začíná sledovat horké body města.`;
  if (sourceType === "market") return "Na černém trhu se otočil větší balík. Nikdo neříká jména nahlas.";
  if (sourceType === "robbery") return `Z ${district} zmizelo zboží. Nikdo nic neviděl.`;
  if (sourceType === "trap") return `V ${district} někdo vstoupil do špatných dveří. Past sklapla.`;
  return safeText(payload.summary || payload.message, "Město zachytilo nejasný pohyb v ulicích.");
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
  const storage = deps.storage || (typeof window !== "undefined" ? window.localStorage : null);
  const root = deps.root || documentRef?.querySelector?.("#game-root") || null;
  let mount = deps.mount || null;
  let selectedDistrictId = "";
  let localEvents = normalizeCityFeedEvents(readStorage(storage));

  const getState = () => safeObject(typeof deps.getState === "function" ? deps.getState() : {});
  const renderDistrictFeed = (events) => {
    const list = root?.querySelector?.("[data-district-popup-gossip-list]");
    const panel = root?.querySelector?.("[data-district-popup-gossip]");
    const hasEntries = renderDistrictRumorFeed(list, events, { districtId: selectedDistrictId, limit: 5 });
    if (panel && hasEntries) panel.hidden = false;
  };
  const render = () => {
    const events = normalizeCityFeedEvents([...collectCoreFeed(getState()), ...localEvents]).slice(0, CITY_FEED_LIMIT);
    mount ||= createMount(root, documentRef);
    if (mount) renderRumorFeedPanel(mount, { events }, {}, { limit: 6 });
    renderDistrictFeed(events);
    return events;
  };
  const appendLocalEvent = (event) => {
    localEvents = normalizeCityFeedEvents([event, ...localEvents]).slice(0, CITY_FEED_LIMIT);
    writeStorage(storage, localEvents);
    return render();
  };
  const bindEvents = () => {
    if (!documentRef?.addEventListener) return false;
    documentRef.addEventListener("empire:action-result", (event) => {
      const detail = safeObject(event.detail);
      appendLocalEvent(createEventFromActionResult(detail.kind, safeObject(detail.payload), safeObject(detail.snapshot)));
    });
    documentRef.addEventListener("empire:police-feedback", (event) => {
      const detail = safeObject(event.detail);
      if (["medium", "high", "extreme"].includes(safeText(detail.riskKey))) {
        appendLocalEvent(createEventFromActionResult("police", { ...detail, summary: detail.message }));
      }
    });
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

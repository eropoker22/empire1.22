import { renderPoliceFeedPanel } from "../ui/policeFeedPanel.js";

function safeObject(value) {
  return value && typeof value === "object" ? value : {};
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function riskFromHeat(heat = 0, wantedLevel = 0) {
  const safeHeat = Math.max(0, Number(heat || 0));
  const safeWanted = Math.max(0, Number(wantedLevel || 0));
  if (safeHeat >= 140 || safeWanted >= 5) return "extreme";
  if (safeHeat >= 90 || safeWanted >= 4) return "high";
  if (safeHeat >= 40 || safeWanted >= 2) return "medium";
  return "low";
}

function riskCopy(riskKey) {
  switch (riskKey) {
    case "extreme":
      return {
        statusLabel: "Extrémní",
        message: "Další hlučná akce může vyvolat zásah. Stáhni heat nebo počítej s kontrolou."
      };
    case "high":
      return {
        statusLabel: "Vysoký",
        message: "Policie je blízko. Útoky, dirty cash a černý trh můžou spustit tvrdý zásah."
      };
    case "medium":
      return {
        statusLabel: "Střední",
        message: "Policie sleduje tvoje lidi. Risk roste hlavně po špinavých akcích."
      };
    case "low":
    default:
      return {
        statusLabel: "Nízký",
        message: "Nízký dohled. Gang je zatím skoro pod radarem."
      };
  }
}

function normalizePoliceReadModel(input = {}) {
  const state = safeObject(input.state || input.snapshot);
  const player = safeObject(input.player || state.player || input.playerView);
  const modelsByPlayerId = safeObject(state.policeReadModelsByPlayerId || input.policeReadModelsByPlayerId);
  const playerId = String(input.playerId || player.playerId || player.id || "").trim();
  const candidate = input.policeReadModel
    || input.police
    || player.police
    || state.police
    || (playerId ? modelsByPlayerId[playerId] : null);
  return candidate && typeof candidate === "object" ? candidate : null;
}

function normalizeCorePoliceEntries(model = {}) {
  const feed = asArray(model.policeFeed);
  const pendingRaid = safeObject(model.pendingRaid);
  const entries = feed.map((event) => ({
    kind: event.type || "police-event",
    title: event.type || "Policejní event",
    message: event.message || event.payload?.message || "Bez detailu."
  }));

  if (pendingRaid.raidId) {
    entries.unshift({
      kind: "pending-raid",
      title: `Připravená razie · ${pendingRaid.severity || "vysoká"}`,
      message: pendingRaid.reason || `Vyprší v ticku ${pendingRaid.expiresAtTick ?? "?"}`
    });
  }

  return entries;
}

function normalizePoliceEntries(policeActions = {}, lastMessage = "") {
  const entries = Object.values(safeObject(policeActions))
    .filter((entry) => entry && typeof entry === "object")
    .sort((left, right) => Number(right.startedAt || 0) - Number(left.startedAt || 0))
    .map((entry) => ({
      kind: "police-event",
      title: entry.operationType || "Policejní event",
      message: `District ${entry.districtId || "?"} · ${entry.raidSpecialtyKey || "monitoring"}`
    }));

  if (!entries.length && lastMessage) {
    entries.push({
      kind: "fallback",
      title: "Záložní varování",
      message: lastMessage
    });
  }

  return entries;
}

export function resolvePoliceHeatFeedback(input = {}) {
  const coreModel = normalizePoliceReadModel(input);
  if (coreModel) {
    const riskKey = String(coreModel.riskTier || "low");
    const copy = riskCopy(riskKey);
    const pendingRaid = coreModel.pendingRaid && typeof coreModel.pendingRaid === "object"
      ? coreModel.pendingRaid
      : null;
    const lastEvent = coreModel.lastPoliceEvent && typeof coreModel.lastPoliceEvent === "object"
      ? coreModel.lastPoliceEvent
      : null;
    const lastMessage = String(lastEvent?.message || coreModel.recommendedAction || copy.message || "").trim();
    return {
      heat: Math.max(0, Number(coreModel.heat || 0) || 0),
      playerHeat: Math.max(0, Number(coreModel.playerHeat ?? coreModel.heat ?? 0) || 0),
      ownedDistrictHeat: Math.max(0, Number(coreModel.ownedDistrictHeat ?? coreModel.districtHeat ?? coreModel.districtHeatPressure ?? 0) || 0),
      wantedLevel: Math.max(0, Number(coreModel.wantedLevel || 0) || 0),
      wantedLabel: String(coreModel.wantedLabel || `${coreModel.wantedLevel || 0} / 5`),
      riskKey,
      statusLabel: copy.statusLabel,
      riskMessage: String(coreModel.recommendedAction || copy.message),
      lastMessage,
      entries: normalizeCorePoliceEntries(coreModel),
      aggregatePressure: Math.max(0, Number(coreModel.aggregatePressure || 0) || 0),
      raidPressure: Math.max(0, Number(coreModel.raidPressure ?? coreModel.aggregatePressure ?? 0) || 0),
      raidPressureExplanation: String(coreModel.raidPressureExplanation || "Tlak raidu je celkový tlak policie. Heat districtů může přitáhnout raid i bez vysoké hledanosti."),
      heatBreakdown: asArray(coreModel.heatBreakdown),
      playerHeatPressure: Math.max(0, Number(coreModel.playerHeatPressure || 0) || 0),
      districtHeatPressure: Math.max(0, Number(coreModel.districtHeatPressure || 0) || 0),
      hottestDistrictId: coreModel.hottestDistrictId || null,
      hottestDistrictHeat: Math.max(0, Number(coreModel.hottestDistrictHeat || 0) || 0),
      pendingRaid,
      previewConsequences: pendingRaid?.previewConsequences || null,
      lastPoliceEvent: lastEvent,
      recommendedAction: String(coreModel.recommendedAction || ""),
      hasCoreReadModel: true,
      hasRealPoliceEvent: asArray(coreModel.policeFeed).length > 0 || Boolean(pendingRaid)
    };
  }

  // Legacy fallback: old browser runtime can still render heat when the core PoliceReadModel is absent.
  const gangState = safeObject(input.gangState || input.gang);
  const heatLevel = safeObject(input.heatLevel || input.wantedLevel || input.tier);
  const heat = Math.max(0, Number(input.heat ?? gangState.heat ?? 0) || 0);
  const wantedLevel = Math.max(0, Number(input.wantedLevelId ?? heatLevel.id ?? 0) || 0);
  const riskKey = riskFromHeat(heat, wantedLevel);
  const copy = riskCopy(riskKey);
  const lastEventMessage = String(input.lastMessage || input.message || "").trim();
  const fallbackLastMessage = lastEventMessage || copy.message;
  const entries = normalizePoliceEntries(input.policeActions, fallbackLastMessage);

  return {
    heat,
    wantedLevel,
    wantedLabel: `${wantedLevel} / 6`,
    riskKey,
    statusLabel: copy.statusLabel,
    riskMessage: copy.message,
    lastMessage: fallbackLastMessage,
    entries,
    aggregatePressure: heat,
    raidPressure: heat,
    raidPressureExplanation: "Tlak raidu je celkový tlak policie. Bez core read modelu se používá legacy heat fallback.",
    heatBreakdown: [],
    playerHeat: heat,
    ownedDistrictHeat: 0,
    playerHeatPressure: heat,
    districtHeatPressure: 0,
    hottestDistrictId: null,
    hottestDistrictHeat: 0,
    pendingRaid: null,
    previewConsequences: null,
    lastPoliceEvent: null,
    recommendedAction: copy.message,
    hasCoreReadModel: false,
    hasRealPoliceEvent: Object.keys(safeObject(input.policeActions)).length > 0
  };
}

function createMount(root, documentRef) {
  const existing = root?.querySelector?.("[data-police-feed]");
  if (existing) {
    return existing;
  }

  const wantedFeedMount = root?.querySelector?.("[data-wanted-popup-police-feed]");
  if (wantedFeedMount) {
    const toggleButton = root?.querySelector?.("[data-wanted-popup-police-toggle]");
    const policeWindow = root?.querySelector?.("[data-wanted-popup-police-window]");
    const closeButton = root?.querySelector?.("[data-wanted-popup-police-close]");
    const panelHost = policeWindow || wantedFeedMount;
    const positionPoliceWindow = () => {
      if (!toggleButton || !policeWindow || typeof toggleButton.getBoundingClientRect !== "function") {
        return;
      }
      const rect = toggleButton.getBoundingClientRect();
      const windowWidth = 348;
      const viewportWidth = Number(globalThis.innerWidth || 0);
      const left = viewportWidth > 0
        ? Math.max(10, Math.min(rect.left, viewportWidth - windowWidth - 10))
        : rect.left;
      policeWindow.style?.setProperty?.("--wanted-police-window-left", `${Math.round(left)}px`);
      policeWindow.style?.setProperty?.("--wanted-police-window-top", `${Math.round(rect.bottom + 10)}px`);
    };
    wantedFeedMount.classList?.add?.("police-feed-panel");
    wantedFeedMount.setAttribute?.("data-police-feed", "");
    wantedFeedMount.setAttribute?.("aria-label", "Policejní zpětná vazba");
    panelHost.hidden = true;
    if (toggleButton && !toggleButton.dataset?.policeFeedToggleBound) {
      if (toggleButton.dataset) {
        toggleButton.dataset.policeFeedToggleBound = "true";
      }
      toggleButton.addEventListener?.("click", () => {
        const nextHidden = !panelHost.hidden;
        if (!nextHidden) {
          positionPoliceWindow();
        }
        panelHost.hidden = nextHidden;
        toggleButton.setAttribute?.("aria-expanded", nextHidden ? "false" : "true");
      });
    }
    if (closeButton && !closeButton.dataset?.policeFeedCloseBound) {
      if (closeButton.dataset) {
        closeButton.dataset.policeFeedCloseBound = "true";
      }
      closeButton.addEventListener?.("click", () => {
        panelHost.hidden = true;
        toggleButton?.setAttribute?.("aria-expanded", "false");
      });
    }
    return wantedFeedMount;
  }

  const mount = documentRef?.createElement?.("section");
  if (!mount) {
    return null;
  }
  mount.className = "police-feed-panel";
  mount.setAttribute("data-police-feed", "");
  mount.setAttribute("aria-label", "Policejní zpětná vazba");

  const container = root?.querySelector?.(".wanted-popup-card")
    || root;
  container?.append?.(mount);
  return mount;
}

export function createPoliceHeatBridge(deps = {}) {
  const documentRef = deps.documentRef || (typeof document !== "undefined" ? document : null);
  const root = deps.root || documentRef?.querySelector?.("#game-root") || null;
  let mount = deps.mount || null;
  let lastMessage = "";
  let lastViewModel = null;

  const getState = () => safeObject(typeof deps.getState === "function" ? deps.getState() : {});
  const acknowledgeRaid = (raidId) => {
    const resolvedRaidId = String(raidId || lastViewModel?.pendingRaid?.raidId || "").trim();
    if (!resolvedRaidId) return false;
    if (typeof deps.acknowledgePendingRaid === "function") {
      return deps.acknowledgePendingRaid(resolvedRaidId);
    }
    const executionMode = String(getState().executionMode || getState().gameplayExecutionMode || "local-demo");
    if (executionMode === "server-authoritative") return false;
    documentRef?.dispatchEvent?.(new CustomEvent("empire:police-raid-acknowledged", {
      detail: { raidId: resolvedRaidId, fallback: true }
    }));
    return true;
  };

  const render = (eventOrState = {}) => {
    const state = getState();
    const detail = safeObject(eventOrState?.detail || eventOrState);
    const eventType = String(eventOrState?.type || detail.type || "").trim();
    const eventMessage = String(detail.message || detail.reason || detail.summary || "").trim();
    if (eventMessage) {
      lastMessage = eventMessage;
    }
    const viewModel = resolvePoliceHeatFeedback({
      ...state,
      ...detail,
      lastMessage
    });
    mount ||= createMount(root, documentRef);
    if (!mount) {
      lastViewModel = viewModel;
      return viewModel;
    }
    renderPoliceFeedPanel(mount, viewModel, { onAcknowledge: acknowledgeRaid });
    lastViewModel = viewModel;
    if (eventType !== "init" && eventType !== "runtime:refresh" && eventType !== "empire:runtime-refresh") {
      documentRef?.dispatchEvent?.(new CustomEvent("empire:police-feedback", {
        detail: {
          heat: viewModel.heat,
          riskKey: viewModel.riskKey,
          message: viewModel.lastMessage,
          fallback: !viewModel.hasCoreReadModel
        }
      }));
    }
    return viewModel;
  };

  const bindEvents = () => {
    if (!documentRef?.addEventListener) {
      return false;
    }
    for (const eventName of [
      "empire:gang-state-changed",
      "empire:police-state-changed",
      "empire:heat-changed",
      "empire:action-result",
      "empire:runtime-refresh"
    ]) {
      documentRef.addEventListener(eventName, (event) => {
        if (eventName === "empire:action-result" && !["attack", "police", "market"].includes(String(event?.detail?.kind || ""))) {
          return;
        }
        render(event);
      });
    }
    return true;
  };

  return {
    bindEvents,
    acknowledgePendingRaid: acknowledgeRaid,
    init: () => {
      bindEvents();
      return render({ type: "init" });
    },
    render
  };
}

if (typeof window !== "undefined") {
  window.acknowledgePendingRaid = window.acknowledgePendingRaid || ((raidId) => {
    const event = new CustomEvent("empire:police-raid-acknowledged", {
      detail: {
        raidId: String(raidId || ""),
        fallback: true
      }
    });
    window.document?.dispatchEvent?.(event);
    return true;
  });
  window.EmpirePoliceHeatBridge = {
    createPoliceHeatBridge,
    resolvePoliceHeatFeedback
  };
}

import { closeOverlay, openOverlay } from "../ui/legacyOverlayCoordinator.js";
import { formatDistrictMetricNumber } from "./formatters.js";

const UNAVAILABLE_VALUE_LABEL = "—";

function safeObject(value) {
  return value && typeof value === "object" ? value : {};
}

function finiteNumberOrNull(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalizeAuthoritativeHeatJournal(entries) {
  return (Array.isArray(entries) ? entries : [])
    .filter((entry) => entry && typeof entry === "object" && typeof entry.reason === "string")
    .map((entry, index) => ({
      id: String(entry.id || `server-heat-log-${index}`),
      type: entry.type === "fall" ? "fall" : "rise",
      amount: Math.max(0, finiteNumberOrNull(entry.amount) ?? 0),
      reason: String(entry.reason || "").trim(),
      createdAt: typeof entry.createdAt === "string" ? entry.createdAt : "",
      deltaLabel: typeof entry.deltaLabel === "string" ? entry.deltaLabel : "",
      timestampLabel: typeof entry.timestampLabel === "string" ? entry.timestampLabel : ""
    }))
    .filter((entry) => entry.reason)
    .slice(0, 18);
}

function resolveAuthoritativeProtectionLabel(police = {}) {
  if (!police.protection || typeof police.protection !== "object") {
    return UNAVAILABLE_VALUE_LABEL;
  }

  const sources = Array.isArray(police.protection.sources)
    ? police.protection.sources.map((source) => String(source || "").trim()).filter(Boolean)
    : [];
  if (sources.length === 0) {
    return "Bez ochrany";
  }

  const multiplier = finiteNumberOrNull(police.protection.raidConsequenceMultiplier);
  if (multiplier === null) {
    return sources.join(", ");
  }
  const reductionPct = Math.round((1 - multiplier) * 100);
  const consequenceLabel = reductionPct >= 0
    ? `-${reductionPct} % následky raidu`
    : `+${Math.abs(reductionPct)} % následky raidu`;
  return `${sources.join(", ")} ${consequenceLabel}`;
}

export function buildGangWantedStatusViewModel({
  economyState = {},
  gangState = {},
  heatLevel = {},
  heatTiers = [],
  journal = [],
  policeFeedback = {}
} = {}, options = {}) {
  const heatValue = Number(gangState.heat || 0);
  const safePoliceFeedback = policeFeedback && typeof policeFeedback === "object" ? policeFeedback : {};
  const now = typeof options.now === "function" ? options.now() : Date.now();
  return {
    heat: heatValue,
    heatLabel: typeof options.heatLabel === "string"
      ? options.heatLabel
      : formatDistrictMetricNumber(heatValue, 1),
    available: options.available !== false,
    levelId: heatLevel.id,
    levelLabel: typeof options.levelLabel === "string" ? options.levelLabel : heatLevel.label,
    title: heatLevel.title,
    description: heatLevel.description,
    riskKey: safePoliceFeedback.riskKey || safePoliceFeedback.riskTier || "",
    pendingRaid: safePoliceFeedback.pendingRaid || null,
    policeFeedback: safePoliceFeedback,
    activePoliceActionCount: Math.max(0, Number(safePoliceFeedback.activePoliceActionCount || 0) || 0),
    protectionLabel: typeof options.protectionLabel === "string"
      ? options.protectionLabel
      : typeof options.formatProtectionLabel === "function"
        ? options.formatProtectionLabel(gangState.policeRaidProtectionUntil)
        : "",
    auditRiskPct: typeof options.resolveAuditRisk === "function"
      ? options.resolveAuditRisk(gangState.heatReductionAuditTimestamps, now)
      : Math.max(0, Number(gangState.auditRiskPct || 0) || 0),
    auditRiskLabel: typeof options.auditRiskLabel === "string" ? options.auditRiskLabel : "",
    levels: (Array.isArray(heatTiers) ? heatTiers : []).map((tier) => ({
      id: tier.id,
      label: tier.label,
      title: tier.title,
      effect: typeof options.getTierEffect === "function" ? options.getTierEffect(tier.id) : "",
      active: tier.id === heatLevel.id
    })),
    riseEntries: (Array.isArray(journal) ? journal : []).filter((entry) => entry.type === "rise").slice(0, 6),
    fallEntries: (Array.isArray(journal) ? journal : []).filter((entry) => entry.type === "fall").slice(0, 6),
    riseEmptyText: typeof options.riseEmptyText === "string" ? options.riseEmptyText : "",
    fallEmptyText: typeof options.fallEmptyText === "string" ? options.fallEmptyText : "",
    dirtyActionDisabled: typeof options.dirtyActionDisabled === "boolean"
      ? options.dirtyActionDisabled
      : Number(economyState.dirtyMoney || 0) < Number(options.dirtyActionCost || 0),
    cleanActionDisabled: typeof options.cleanActionDisabled === "boolean"
      ? options.cleanActionDisabled
      : Number(economyState.cleanMoney || 0) < Number(options.cleanActionCost || 0),
    influenceActionDisabled: typeof options.influenceActionDisabled === "boolean"
      ? options.influenceActionDisabled
      : Number(gangState.influence || 0) < Number(options.influenceActionCost || 0),
    clearLogDisabled: Boolean(options.clearLogDisabled),
    now
  };
}

export function buildServerGangWantedStatusViewModel({
  serverPlayer = null,
  heatTiers = []
} = {}, options = {}) {
  const player = safeObject(serverPlayer);
  const police = safeObject(player.police);
  const economy = safeObject(player.economy);
  const heat = finiteNumberOrNull(police.heat ?? police.playerHeat);
  const authoritativeHeatAvailable = heat !== null;
  const presentationTier = authoritativeHeatAvailable && typeof options.resolveHeatTier === "function"
    ? safeObject(options.resolveHeatTier(heat))
    : {};
  const wantedLevel = finiteNumberOrNull(police.wantedLevel);
  const levelLabel = String(police.wantedLevelLabel || police.wantedLabel || "").trim()
    || (wantedLevel === null ? UNAVAILABLE_VALUE_LABEL : `${Math.max(0, wantedLevel)} / 5`);
  const authoritativeJournalAvailable = Array.isArray(police.heatJournal);
  const journal = authoritativeJournalAvailable
    ? normalizeAuthoritativeHeatJournal(police.heatJournal)
    : [];
  const auditRiskPct = finiteNumberOrNull(police.auditRiskPct);
  const policeFeedback = player.police && typeof options.resolvePoliceFeedback === "function"
    ? safeObject(options.resolvePoliceFeedback({ policeReadModel: player.police }))
    : {};

  return buildGangWantedStatusViewModel({
    economyState: {
      cleanMoney: finiteNumberOrNull(economy.cleanCash),
      dirtyMoney: finiteNumberOrNull(economy.dirtyCash)
    },
    gangState: {
      heat: authoritativeHeatAvailable ? Math.max(0, heat) : 0,
      influence: finiteNumberOrNull(economy.influence),
      auditRiskPct: auditRiskPct ?? 0
    },
    heatLevel: {
      id: authoritativeHeatAvailable ? presentationTier.id : 0,
      label: levelLabel,
      title: authoritativeHeatAvailable
        ? String(presentationTier.title || UNAVAILABLE_VALUE_LABEL)
        : UNAVAILABLE_VALUE_LABEL,
      description: authoritativeHeatAvailable
        ? String(presentationTier.description || UNAVAILABLE_VALUE_LABEL)
        : UNAVAILABLE_VALUE_LABEL
    },
    heatTiers,
    journal,
    policeFeedback
  }, {
    ...options,
    available: authoritativeHeatAvailable,
    heatLabel: authoritativeHeatAvailable
      ? formatDistrictMetricNumber(Math.max(0, heat), 1)
      : UNAVAILABLE_VALUE_LABEL,
    levelLabel,
    protectionLabel: resolveAuthoritativeProtectionLabel(police),
    auditRiskLabel: auditRiskPct === null ? UNAVAILABLE_VALUE_LABEL : `${Math.max(0, auditRiskPct)} %`,
    riseEmptyText: authoritativeJournalAvailable ? "" : UNAVAILABLE_VALUE_LABEL,
    fallEmptyText: authoritativeJournalAvailable ? "" : UNAVAILABLE_VALUE_LABEL,
    dirtyActionDisabled: true,
    cleanActionDisabled: true,
    influenceActionDisabled: true,
    clearLogDisabled: true,
    resolveAuditRisk: null
  });
}

function resolveWantedElements(root, selectors = {}) {
  if (!root) {
    return null;
  }

  const resolveTextMirror = (selector) => {
    const nodes = Array.from(root.querySelectorAll(selector));
    if (nodes.length === 0) {
      const node = root.querySelector(selector);
      return node || null;
    }
    if (nodes.length === 1) {
      return nodes[0];
    }
    return {
      get textContent() {
        return nodes[0]?.textContent || "";
      },
      set textContent(value) {
        for (const node of nodes) {
          node.textContent = value;
        }
      }
    };
  };

  return {
    heatButton: root.querySelector(selectors.gangHeat),
    starContainer: root.querySelector(selectors.gangStars),
    stars: Array.from(root.querySelectorAll(selectors.gangStar)),
    popup: root.querySelector(selectors.popup),
    popupHeat: resolveTextMirror(selectors.popupHeat),
    popupLevel: resolveTextMirror(selectors.popupLevel),
    popupTier: resolveTextMirror(selectors.popupTier),
    popupDescription: resolveTextMirror(selectors.popupDescription),
    popupProtection: resolveTextMirror(selectors.popupProtection),
    popupAuditRisk: selectors.popupAuditRisk ? resolveTextMirror(selectors.popupAuditRisk) : null,
    popupLevels: root.querySelector(selectors.popupLevels),
    popupRiseList: root.querySelector(selectors.popupRiseList),
    popupFallList: root.querySelector(selectors.popupFallList),
    popupFeedback: root.querySelector(selectors.popupFeedback),
    dirtyActionButton: root.querySelector(selectors.dirtyAction),
    cleanActionButton: root.querySelector(selectors.cleanAction),
    influenceActionButton: root.querySelector(selectors.influenceAction),
    clearLogButton: root.querySelector(selectors.clearLog),
    popupCloseElements: Array.from(root.querySelectorAll(selectors.popupClose))
  };
}

function hasRequiredWantedElements(elements) {
  return Boolean(
    elements?.heatButton
    && elements.starContainer
    && elements.stars.length > 0
    && elements.popup
    && elements.popupHeat
    && elements.popupLevel
    && elements.popupTier
    && elements.popupDescription
    && elements.popupProtection
    && elements.popupLevels
    && elements.popupRiseList
    && elements.popupFallList
  );
}

function resolveWantedPoliceFeedback(deps = {}, gangState = {}, heatLevel = {}) {
  const policeActions = safeObject(
    typeof deps.getResolvedDistrictPoliceActions === "function"
      ? deps.getResolvedDistrictPoliceActions()
      : {}
  );
  const activePoliceActionCount = Object.keys(policeActions).length;
  if (typeof deps.resolvePoliceHeatFeedback !== "function") {
    return { activePoliceActionCount };
  }
  return {
    ...safeObject(deps.resolvePoliceHeatFeedback({
      gangState,
      heatLevel,
      policeActions
    })),
    activePoliceActionCount
  };
}

export function createGangWantedStatusRuntime(deps = {}) {
  const selectors = deps.selectors || {};

  const bindGangWantedStatus = (root) => {
    const elements = resolveWantedElements(root, selectors);

    if (!hasRequiredWantedElements(elements)) {
      return false;
    }

    const renderFeedback = (tone, message) => {
      deps.renderWantedFeedback(elements.popupFeedback, tone, message);
    };

    const syncWantedStatus = () => {
      const serverAuthoritative = Boolean(deps.isServerAuthoritativeMode?.());
      const serverPlayer = serverAuthoritative ? deps.getServerPlayerView?.() || null : null;
      const wantedViewModel = serverAuthoritative
        ? buildServerGangWantedStatusViewModel({
            serverPlayer,
            heatTiers: deps.gangHeatTiers
          }, {
            cleanActionCost: deps.cleanActionCost,
            dirtyActionCost: deps.dirtyActionCost,
            influenceActionCost: deps.influenceActionCost,
            getTierEffect: deps.getPoliceTierShortEffect,
            now: deps.now,
            resolveHeatTier: deps.resolveGangHeatTier,
            resolvePoliceFeedback: deps.resolvePoliceHeatFeedback
          })
        : (() => {
            const gangState = deps.syncGangHeatDecay();
            const heatLevel = deps.resolveGangHeatTier(gangState.heat);
            const economyState = deps.getResolvedEconomyState();
            const journal = deps.normalizeGangHeatJournal(gangState.heatJournal);
            const policeFeedback = resolveWantedPoliceFeedback(deps, gangState, heatLevel);
            return buildGangWantedStatusViewModel({
              economyState,
              gangState,
              heatLevel,
              heatTiers: deps.gangHeatTiers,
              journal,
              policeFeedback
            }, {
              cleanActionCost: deps.cleanActionCost,
              dirtyActionCost: deps.dirtyActionCost,
              influenceActionCost: deps.influenceActionCost,
              formatProtectionLabel: deps.formatGangHeatProtectionLabel,
              getTierEffect: deps.getPoliceTierShortEffect,
              resolveAuditRisk: deps.resolveGangHeatAuditRisk,
              now: deps.now
            });
          })();

      deps.renderHeatBadge(wantedViewModel, {
        heatButton: elements.heatButton,
        starContainer: elements.starContainer,
        stars: elements.stars
      });
      deps.renderWantedPanel(wantedViewModel, {
        mounts: {
          popupHeat: elements.popupHeat,
          popupLevel: elements.popupLevel,
          popupTier: elements.popupTier,
          popupDescription: elements.popupDescription,
          popupProtection: elements.popupProtection,
          popupAuditRisk: elements.popupAuditRisk,
          popupLevels: elements.popupLevels,
          popupRiseList: elements.popupRiseList,
          popupFallList: elements.popupFallList,
          dirtyActionButton: elements.dirtyActionButton,
          cleanActionButton: elements.cleanActionButton,
          influenceActionButton: elements.influenceActionButton,
          clearLogButton: elements.clearLogButton
        }
      });
      return wantedViewModel;
    };

    const openPopup = () => {
      renderFeedback("", "");
      syncWantedStatus();
      openOverlay(elements.popup, { type: "modal", ariaModal: true, restoreFocusOnClose: false });
      elements.popup.hidden = false;
      document.documentElement?.classList?.add?.("game-wanted-popup-open");
      document.body?.classList?.add?.("game-wanted-popup-open");
    };

    const closePopup = () => {
      elements.popup.hidden = true;
      document.documentElement?.classList?.remove?.("game-wanted-popup-open");
      document.body?.classList?.remove?.("game-wanted-popup-open");
      closeOverlay(elements.popup, { restoreFocus: false });
    };

    elements.heatButton.addEventListener("click", openPopup);
    const runWantedAction = (callback) => {
      if (deps.isServerAuthoritativeMode?.()) {
        renderFeedback("warning", "Akce není v autoritativním serverovém modelu dostupná.");
        syncWantedStatus();
        return false;
      }
      callback?.({ renderFeedback, root, syncWantedStatus });
      return true;
    };

    elements.dirtyActionButton?.addEventListener("click", () => runWantedAction(deps.onDirtyAction));
    elements.cleanActionButton?.addEventListener("click", () => runWantedAction(deps.onCleanAction));
    elements.influenceActionButton?.addEventListener("click", () => runWantedAction(deps.onInfluenceAction));
    elements.clearLogButton?.addEventListener("click", () => runWantedAction(deps.onClearLog));

    for (const closeElement of elements.popupCloseElements) {
      closeElement.addEventListener("click", closePopup);
    }

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !elements.popup.hidden) {
        closePopup();
      }
    });

    document.addEventListener("empire:gang-state-changed", syncWantedStatus);
    document.addEventListener("empire:police-state-changed", syncWantedStatus);
    document.addEventListener("empire:economy-state-changed", syncWantedStatus);
    document.addEventListener("empire:gameplay-slice-rendered", syncWantedStatus);

    syncWantedStatus();
    return true;
  };

  return {
    bindGangWantedStatus
  };
}

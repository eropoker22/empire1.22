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
  return {
    heat: heatValue,
    levelId: heatLevel.id,
    levelLabel: heatLevel.label,
    title: heatLevel.title,
    description: heatLevel.description,
    riskKey: safePoliceFeedback.riskKey || safePoliceFeedback.riskTier || "",
    pendingRaid: safePoliceFeedback.pendingRaid || null,
    policeFeedback: safePoliceFeedback,
    activePoliceActionCount: Math.max(0, Number(safePoliceFeedback.activePoliceActionCount || 0) || 0),
    protectionLabel: typeof options.formatProtectionLabel === "function"
      ? options.formatProtectionLabel(gangState.policeRaidProtectionUntil)
      : "",
    levels: (Array.isArray(heatTiers) ? heatTiers : []).map((tier) => ({
      id: tier.id,
      label: tier.label,
      title: tier.title,
      effect: typeof options.getTierEffect === "function" ? options.getTierEffect(tier.id) : "",
      active: tier.id === heatLevel.id
    })),
    riseEntries: (Array.isArray(journal) ? journal : []).filter((entry) => entry.type === "rise").slice(0, 6),
    fallEntries: (Array.isArray(journal) ? journal : []).filter((entry) => entry.type === "fall").slice(0, 6),
    dirtyActionDisabled: Number(economyState.dirtyMoney || 0) < Number(options.dirtyActionCost || 0),
    cleanActionDisabled: Number(economyState.cleanMoney || 0) < Number(options.cleanActionCost || 0),
    now: typeof options.now === "function" ? options.now() : Date.now()
  };
}

function resolveWantedElements(root, selectors = {}) {
  if (!root) {
    return null;
  }

  return {
    heatButton: root.querySelector(selectors.gangHeat),
    starContainer: root.querySelector(selectors.gangStars),
    stars: Array.from(root.querySelectorAll(selectors.gangStar)),
    popup: root.querySelector(selectors.popup),
    popupHeat: root.querySelector(selectors.popupHeat),
    popupLevel: root.querySelector(selectors.popupLevel),
    popupTier: root.querySelector(selectors.popupTier),
    popupDescription: root.querySelector(selectors.popupDescription),
    popupProtection: root.querySelector(selectors.popupProtection),
    popupLevels: root.querySelector(selectors.popupLevels),
    popupRiseList: root.querySelector(selectors.popupRiseList),
    popupFallList: root.querySelector(selectors.popupFallList),
    popupFeedback: root.querySelector(selectors.popupFeedback),
    dirtyActionButton: root.querySelector(selectors.dirtyAction),
    cleanActionButton: root.querySelector(selectors.cleanAction),
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

function safeObject(value) {
  return value && typeof value === "object" ? value : {};
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
      const gangState = deps.syncGangHeatDecay();
      const heatLevel = deps.resolveGangHeatTier(gangState.heat);
      const economyState = deps.getResolvedEconomyState();
      const journal = deps.normalizeGangHeatJournal(gangState.heatJournal);
      const policeFeedback = resolveWantedPoliceFeedback(deps, gangState, heatLevel);
      const wantedViewModel = buildGangWantedStatusViewModel({
        economyState,
        gangState,
        heatLevel,
        heatTiers: deps.gangHeatTiers,
        journal,
        policeFeedback
      }, {
        cleanActionCost: deps.cleanActionCost,
        dirtyActionCost: deps.dirtyActionCost,
        formatProtectionLabel: deps.formatGangHeatProtectionLabel,
        getTierEffect: deps.getPoliceTierShortEffect,
        now: deps.now
      });

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
          popupLevels: elements.popupLevels,
          popupRiseList: elements.popupRiseList,
          popupFallList: elements.popupFallList,
          dirtyActionButton: elements.dirtyActionButton,
          cleanActionButton: elements.cleanActionButton
        }
      });
      return wantedViewModel;
    };

    const openPopup = () => {
      renderFeedback("", "");
      syncWantedStatus();
      elements.popup.hidden = false;
    };

    const closePopup = () => {
      elements.popup.hidden = true;
    };

    elements.heatButton.addEventListener("click", openPopup);
    elements.dirtyActionButton?.addEventListener("click", () => {
      deps.onDirtyAction?.({ renderFeedback, root, syncWantedStatus });
    });
    elements.cleanActionButton?.addEventListener("click", () => {
      deps.onCleanAction?.({ renderFeedback, root, syncWantedStatus });
    });
    elements.clearLogButton?.addEventListener("click", () => {
      deps.onClearLog?.({ renderFeedback, root, syncWantedStatus });
    });

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

    syncWantedStatus();
    return true;
  };

  return {
    bindGangWantedStatus
  };
}

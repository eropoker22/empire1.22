function queryAll(root, selector) {
  return selector ? Array.from(root?.querySelectorAll?.(selector) || []) : [];
}

export function createFactoryPopupRuntime(deps = {}) {
  const selectors = deps.selectors || {};
  const documentRef = deps.documentRef || (typeof document !== "undefined" ? document : null);

  const getFactoryCollectableAmount = (factoryState) => (factoryState?.slots || []).reduce((total, slot) => (
    total + Math.max(0, Math.floor(Number(slot?.producedAmount || 0)))
  ), 0);

  const renderFactoryBuildingInfo = (infoPanel, factoryState, syncResult, collectableAmount) => {
    deps.renderFactoryBuildingInfoPanel?.(infoPanel, deps.createFactoryBuildingInfoViewModel?.({
      factoryState,
      syncResult,
      collectableAmount,
      config: deps.FACTORY_CONFIG,
      formatCurrency: deps.formatCurrency,
      formatDurationLabel: deps.formatDurationLabel,
      getFactoryUpgradeCost: deps.getFactoryUpgradeCost,
      getFactoryLevelMultiplier: deps.getFactoryLevelMultiplier
    }));
  };

  const bindFactoryPopup = (root) => {
    const openButton = root?.querySelector?.(selectors.open);
    const popup = root?.querySelector?.(selectors.popup);
    const closeElements = queryAll(root, selectors.close);
    const slotList = root?.querySelector?.(selectors.slotList);
    const levelElement = root?.querySelector?.(selectors.level);
    const headerLevelElement = root?.querySelector?.(selectors.headerLevel);
    const multiplierElement = root?.querySelector?.(selectors.multiplier);
    const ownedCountElement = root?.querySelector?.(selectors.ownedCount);
    const upgradeCostElement = root?.querySelector?.(selectors.upgradeCost);
    const metalElement = root?.querySelector?.(selectors.metal);
    const techElement = root?.querySelector?.(selectors.tech);
    const combatElement = root?.querySelector?.(selectors.combat);
    const supplyMetalElement = root?.querySelector?.(selectors.supplyMetal);
    const supplyTechElement = root?.querySelector?.(selectors.supplyTech);
    const supplyCombatElement = root?.querySelector?.(selectors.supplyCombat);
    const effectsLabelElement = root?.querySelector?.(selectors.effectsLabel);
    const upgradeButton = root?.querySelector?.(selectors.upgrade);
    const collectButton = root?.querySelector?.(selectors.collect);

    if (
      !openButton || !popup || closeElements.length === 0 || !slotList || !levelElement || !multiplierElement
      || !ownedCountElement || !upgradeCostElement || !metalElement || !techElement || !combatElement
      || !effectsLabelElement || !upgradeButton
      || !collectButton
    ) {
      return false;
    }

    const tabButtons = queryAll(popup, selectors.tab);
    const panels = queryAll(popup, selectors.panel);
    const infoPanel = popup.querySelector('[data-factory-panel="info"]');

    const setActiveTab = (tabName = "stats") => {
      for (const button of tabButtons) {
        const isActive = button.dataset.factoryTab === tabName;
        button.classList.toggle("is-active", isActive);
        button.setAttribute("aria-selected", isActive ? "true" : "false");
      }

      for (const panel of panels) {
        panel.hidden = panel.dataset.factoryPanel !== tabName;
      }
    };

    const renderFactoryDashboard = () => {
      const syncResult = deps.syncFactoryProduction?.(deps.getStoredFactoryState?.()) || {};
      const factoryState = syncResult.state || {};
      const supplyState = deps.getStoredFactorySupplies?.() || {};
      deps.setStoredFactoryState?.(factoryState);
      const collectableAmount = getFactoryCollectableAmount(factoryState);

      const setFactorySlotProduction = (slotId, isProducing) => {
        const nextState = deps.getStoredFactoryState?.() || {};
        const targetSlot = (nextState.slots || []).find((item) => item.id === slotId);
        if (!targetSlot) return;
        targetSlot.isProducing = isProducing;
        targetSlot.lastTick = Date.now();
        deps.setStoredFactoryState?.(nextState);
        renderFactoryDashboard();
      };
      const dashboardViewModel = deps.buildFactoryDashboardViewModel?.({
        factoryState,
        syncResult,
        supplyState,
        collectableAmount,
        config: deps.FACTORY_CONFIG,
        slotConfig: deps.FACTORY_SLOT_CONFIG,
        slotStorageCap: deps.FACTORY_SLOT_STORAGE_CAP,
        formatCurrency: deps.formatCurrency,
        formatDurationLabel: deps.formatDurationLabel,
        getFactoryUpgradeCost: deps.getFactoryUpgradeCost,
        normalizeResourceColorKey: deps.normalizeProductionResourceColorKey
      }) || {};
      deps.renderFactoryDashboardPanel?.({
        level: levelElement,
        headerLevel: headerLevelElement,
        multiplier: multiplierElement,
        ownedCount: ownedCountElement,
        upgradeCost: upgradeCostElement,
        metal: metalElement,
        tech: techElement,
        combat: combatElement,
        supplyMetal: supplyMetalElement,
        supplyTech: supplyTechElement,
        supplyCombat: supplyCombatElement,
        effectsLabel: effectsLabelElement,
        upgradeButton,
        collectButton,
        infoPanel,
        slotList
      }, dashboardViewModel, {
        renderFactoryBuildingInfo,
        renderFactorySlotList: deps.renderFactorySlotList,
        onPauseSlot: (slotView) => setFactorySlotProduction(slotView.slot?.id, false),
        onStartSlot: (slotView) => setFactorySlotProduction(slotView.slot?.id, true)
      });
    };

    const openPopup = () => {
      setActiveTab("stats");
      renderFactoryDashboard();
      popup.hidden = false;
      deps.syncBuildingDetailTopbarVisibility?.(root);
    };

    const closePopup = () => {
      popup.hidden = true;
      deps.syncBuildingDetailTopbarVisibility?.(root);
    };

    openButton.addEventListener("click", openPopup);

    for (const button of tabButtons) {
      button.addEventListener("click", () => {
        setActiveTab(button.dataset.factoryTab || "stats");
      });
    }

    collectButton.addEventListener("click", () => {
      const collected = deps.collectFactoryOutputsToSupplies?.() || { total: 0, items: [] };
      renderFactoryDashboard();

      if (collected.total <= 0) {
        deps.setBuildingActionFeedback?.(root, "warning", "Továrna", "Není nic hotového k vyzvednutí.");
        return;
      }

      deps.appendBuildingActionResultEntry?.(root, "police", deps.createStorageCollectResultPayload?.({
        buildingLabel: "Továrna",
        items: collected.items,
        meta: "Factory supplies"
      }), {}, { syncPreview: true, forceLog: true });
    });

    upgradeButton.addEventListener("click", () => {
      const factoryState = deps.getStoredFactoryState?.() || {};
      if (factoryState.level >= deps.FACTORY_CONFIG.maxLevel) {
        return;
      }
      const nextLevel = factoryState.level + 1;
      const upgradeCost = deps.getFactoryUpgradeCost?.(nextLevel) || 0;
      const economyState = deps.getResolvedEconomyState?.() || {};
      if (Number(economyState.cleanMoney || 0) < upgradeCost) {
        deps.setBuildingActionFeedback?.(root, "warning", "Továrna", `Na upgrade chybí ${deps.formatCurrency?.(upgradeCost - economyState.cleanMoney)}.`);
        return;
      }
      deps.setStoredEconomyState?.({
        ...economyState,
        cleanMoney: economyState.cleanMoney - upgradeCost
      });
      deps.applyTopbarEconomy?.(root);
      deps.setStoredFactoryState?.({
        ...factoryState,
        level: nextLevel,
        updatedAt: Date.now()
      });
      deps.setBuildingActionFeedback?.(root, "success", "Továrna", `Továrna byla upgradovaná na level ${nextLevel}.`);
      renderFactoryDashboard();
    });

    for (const closeElement of closeElements) {
      closeElement.addEventListener("click", closePopup);
    }

    documentRef?.addEventListener?.("keydown", (event) => {
      if (event.key === "Escape" && !popup.hidden) {
        closePopup();
      }
    });

    return true;
  };

  return {
    bindFactoryPopup
  };
}

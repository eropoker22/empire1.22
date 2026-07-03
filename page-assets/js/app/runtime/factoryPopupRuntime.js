import { createBuildingUpgradeConfirmationController } from "./buildingUpgradeConfirmation.js";
import { closeOverlay, openOverlay } from "../ui/legacyOverlayCoordinator.js";

function queryAll(root, selector) {
  return selector ? Array.from(root?.querySelectorAll?.(selector) || []) : [];
}

export function createFactoryPopupRuntime(deps = {}) {
  const selectors = deps.selectors || {};
  const documentRef = deps.documentRef || (typeof document !== "undefined" ? document : null);
  const allowLegacyLocalProduction = deps.allowLegacyLocalProduction !== false;
  const allowLegacyProductionUpgrade = deps.allowLegacyProductionUpgrade !== false;
  const productionBridgeMessage = "Továrna používá serverový production/craft flow. Legacy lokální výroba je vypnutá.";
  const productionUpgradeMessage = "Serverový upgrade Továrny se provádí přes konkrétní kartu budovy v districtu.";

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
      !openButton || !popup || closeElements.length === 0 || !slotList || !multiplierElement
      || !ownedCountElement || !upgradeCostElement || !metalElement || !techElement || !combatElement
      || !upgradeButton
      || !collectButton
    ) {
      return false;
    }

    const tabButtons = queryAll(popup, selectors.tab);
    const panels = queryAll(popup, selectors.panel);
    const infoPanel = popup.querySelector('[data-factory-panel="info"]');
    const upgradeConfirmation = deps.createUpgradeConfirmationController?.({
      documentRef,
      host: popup,
      variant: "factory"
    }) || createBuildingUpgradeConfirmationController({
      documentRef,
      host: popup,
      variant: "factory"
    });

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

      const cancelFactorySlotProduction = (slotId) => {
        if (!allowLegacyLocalProduction) {
          deps.setBuildingActionFeedback?.(root, "warning", "Továrna", productionBridgeMessage);
          return;
        }
        const nextState = deps.getStoredFactoryState?.() || {};
        const targetSlot = (nextState.slots || []).find((item) => item.id === slotId);
        if (!targetSlot) return;
        targetSlot.isProducing = false;
        targetSlot.queueMode = false;
        targetSlot.queuedAmount = 0;
        targetSlot.productionRemainder = 0;
        targetSlot.lastTick = Date.now();
        deps.setStoredFactoryState?.(nextState);
        renderFactoryDashboard();
      };
      const queueFactorySlotProduction = (slotView, batchCount = 1) => {
        if (!allowLegacyLocalProduction) {
          deps.setBuildingActionFeedback?.(root, "warning", "Továrna", productionBridgeMessage);
          return;
        }
        const nextState = deps.getStoredFactoryState?.() || {};
        const targetSlot = (nextState.slots || []).find((item) => item.id === slotView?.slot?.id);
        if (!targetSlot) return;
        const safeBatchCount = Math.max(1, Math.floor(Number(batchCount || 1)));
        const queueCap = Math.max(1, Math.floor(Number(targetSlot.queueCap || slotView?.queueCap || targetSlot.slotCap || slotView?.slotStorageCap || 1)));
        const currentQueue = Math.max(0, Math.floor(Number(targetSlot.queuedAmount || 0)));
        const acceptedBatchCount = Math.min(safeBatchCount, Math.max(0, queueCap - currentQueue));
        if (acceptedBatchCount <= 0) {
          deps.setBuildingActionFeedback?.(root, "warning", "Továrna", "Fronta je plná.");
          renderFactoryDashboard();
          return;
        }
        targetSlot.queueMode = true;
        targetSlot.queuedAmount = currentQueue + acceptedBatchCount;
        targetSlot.isProducing = true;
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
        onPauseSlot: (slotView) => cancelFactorySlotProduction(slotView.slot?.id),
        onStartSlot: (slotView, payload) => queueFactorySlotProduction(slotView, payload?.batchCount || 1)
      });
      if (!allowLegacyLocalProduction && collectButton) {
        collectButton.disabled = true;
        collectButton.title = productionBridgeMessage;
        collectButton.setAttribute?.("aria-label", productionBridgeMessage);
      }
      if (!allowLegacyProductionUpgrade && upgradeButton && !upgradeButton.hidden) {
        upgradeButton.disabled = false;
        upgradeButton.title = productionUpgradeMessage;
        upgradeButton.setAttribute?.("aria-label", productionUpgradeMessage);
      }
    };

    const openPopup = () => {
      setActiveTab("stats");
      renderFactoryDashboard();
      popup.hidden = false;
      openOverlay(popup, { type: "modal", ariaModal: true, restoreFocusOnClose: false });
      deps.syncBuildingDetailTopbarVisibility?.(root);
    };

    const closePopup = () => {
      upgradeConfirmation.close?.();
      closeOverlay(popup, { restoreFocus: false });
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
      if (!allowLegacyLocalProduction) {
        deps.setBuildingActionFeedback?.(root, "warning", "Továrna", productionBridgeMessage);
        renderFactoryDashboard();
        return;
      }
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
      deps.documentRef?.dispatchEvent?.(new CustomEvent("empire:production-collected", {
        detail: {
          type: "production:collected",
          source: "factory-popup",
          buildingName: "factory",
          amount: collected.total,
          items: collected.items
        }
      }));
    });

    upgradeButton.addEventListener("click", async () => {
      if (!allowLegacyProductionUpgrade) {
        deps.setBuildingActionFeedback?.(root, "warning", "Továrna", productionUpgradeMessage);
        renderFactoryDashboard();
        return;
      }
      const factoryState = deps.getStoredFactoryState?.() || {};
      if (factoryState.level >= deps.FACTORY_CONFIG.maxLevel) {
        return;
      }
      const nextLevel = factoryState.level + 1;
      const upgradeCost = deps.getFactoryUpgradeCost?.(nextLevel) || 0;
      const economyState = deps.getResolvedEconomyState?.() || {};
      const currentMultiplier = deps.getFactoryLevelMultiplier?.(factoryState.level) || 1;
      const nextMultiplier = deps.getFactoryLevelMultiplier?.(nextLevel) || currentMultiplier;
      const speedGainPct = Math.max(0, Math.round((Number(nextMultiplier || currentMultiplier || 1) - Number(currentMultiplier || 1)) * 100));
      const hasEnoughMoney = Number(economyState.cleanMoney || 0) >= upgradeCost;
      const confirmed = await upgradeConfirmation.open({
        benefits: [{
          icon: "x",
          label: "Rychlost výroby",
          value: `+${speedGainPct}%`,
          detail: `x${Number(currentMultiplier || 1).toFixed(2)} → x${Number(nextMultiplier || currentMultiplier || 1).toFixed(2)}`
        }],
        buildingLabel: "Továrna",
        canConfirm: hasEnoughMoney,
        confirmLabel: hasEnoughMoney ? "Potvrdit upgrade" : "Nedostatek clean cash",
        costLabel: deps.formatCurrency?.(upgradeCost) || String(upgradeCost),
        description: "Potvrzením posuneš typ budovy na vyšší úroveň a okamžitě získáš nové bonusy.",
        noteLabel: hasEnoughMoney
          ? `Po potvrzení zaplatíš ${deps.formatCurrency?.(upgradeCost) || upgradeCost} clean cash.`
          : `Chybí ${deps.formatCurrency?.(upgradeCost - Number(economyState.cleanMoney || 0)) || (upgradeCost - Number(economyState.cleanMoney || 0))} clean cash.`,
        titleLabel: `Továrna · L${factoryState.level} → L${nextLevel}`,
        upgradeLabel: `L${factoryState.level} → L${nextLevel}`
      });

      if (!confirmed) {
        return;
      }

      const freshEconomyState = deps.getResolvedEconomyState?.() || {};
      if (Number(freshEconomyState.cleanMoney || 0) < upgradeCost) {
        deps.setBuildingActionFeedback?.(root, "warning", "Továrna", `Na upgrade chybí ${deps.formatCurrency?.(upgradeCost - freshEconomyState.cleanMoney)}.`);
        return;
      }
      deps.setStoredEconomyState?.({
        ...freshEconomyState,
        cleanMoney: freshEconomyState.cleanMoney - upgradeCost
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
        if (upgradeConfirmation.isOpen?.()) {
          upgradeConfirmation.close?.();
          return;
        }
        closePopup();
      }
    });

    return true;
  };

  return {
    bindFactoryPopup
  };
}

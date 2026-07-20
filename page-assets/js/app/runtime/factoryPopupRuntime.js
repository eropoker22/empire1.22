import { createBuildingUpgradeConfirmationController } from "./buildingUpgradeConfirmation.js";
import { closeOverlay, openOverlay } from "../ui/legacyOverlayCoordinator.js";

function queryAll(root, selector) {
  return selector ? Array.from(root?.querySelectorAll?.(selector) || []) : [];
}

const FACTORY_LOADING_SLOT_SPECS = Object.freeze([
  Object.freeze({ recipeId: "metal-parts", resourceKey: "metal-parts", label: "Metal Parts" }),
  Object.freeze({ recipeId: "tech-core", resourceKey: "tech-core", label: "Tech Core" }),
  Object.freeze({ recipeId: "combat-module", resourceKey: "combat-module", label: "Bojový modul" })
]);

// These cards preserve the Factory shell while the authoritative building view loads.
// They deliberately contain no balance values and cannot submit production commands.
const createFactoryLoadingLines = () => FACTORY_LOADING_SLOT_SPECS.map((line) => ({
  ...line,
  loading: true,
  queuedAmount: 0,
  queueCapacity: 0,
  activeAmount: 0,
  waitingAmount: 0,
  status: "loading",
  canStart: false,
  canCancelWaiting: false,
  canCollect: false,
  maxStartQuantity: 0,
  disabledReason: "Načítám detail Továrny."
}));

export function createFactoryPopupRuntime(deps = {}) {
  const selectors = deps.selectors || {};
  const documentRef = deps.documentRef || (typeof document !== "undefined" ? document : null);
  const allowLegacyLocalProduction = deps.allowLegacyLocalProduction !== false;
  const isServerAuthoritativeProductionReady = () => deps.isServerAuthoritativeGameplayRuntimeReady?.() === true;
  const isLegacyLocalProductionEnabled = () => allowLegacyLocalProduction && !isServerAuthoritativeProductionReady();
  const allowLegacyProductionUpgrade = deps.allowLegacyProductionUpgrade !== false;
  const isLegacyLocalProductionUpgradeEnabled = () => allowLegacyProductionUpgrade && !isServerAuthoritativeProductionReady();
  const productionBridgeMessage = "Výroba Továrny je v tomto režimu nedostupná.";
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
      || !ownedCountElement || !upgradeCostElement
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
    let lastServerFactory = null;
    let localCompletionTimer = null;

    const clearLocalCompletionTimer = () => {
      if (localCompletionTimer === null) return;
      (popup.ownerDocument?.defaultView || globalThis).clearTimeout?.(localCompletionTimer);
      localCompletionTimer = null;
    };

    const scheduleLocalCompletionRefresh = (dashboardViewModel = {}) => {
      clearLocalCompletionTimer();
      if (!isLegacyLocalProductionEnabled() || popup.hidden) return;
      const now = Date.now();
      const waits = (dashboardViewModel.slots || []).map((slotView) => {
        const slot = slotView.slot || {};
        if (!slot.isProducing || Number(slot.queuedAmount || 0) <= 0) return null;
        const durationMs = Math.max(1_000, Number(slotView.durationMs || 0));
        const elapsedMs = Math.max(0, now - Number(slot.lastTick || now));
        const progress = Math.max(0, Number(slot.productionRemainder || 0)) + elapsedMs / durationMs;
        const cycleProgress = progress - Math.floor(progress);
        return Math.max(20, Math.ceil(durationMs * (cycleProgress > 0 ? 1 - cycleProgress : 1)));
      }).filter(Number.isFinite);
      if (waits.length <= 0) return;
      const timerApi = popup.ownerDocument?.defaultView || globalThis;
      localCompletionTimer = timerApi.setTimeout?.(() => {
        localCompletionTimer = null;
        if (!popup.hidden) renderFactoryDashboard();
      }, Math.min(...waits)) ?? null;
    };

    const getAuthoritativeFactory = () => {
      if (isLegacyLocalProductionEnabled()) {
        return null;
      }
      const serverFactory = deps.getServerFactoryReadModel?.() || null;
      if (serverFactory && Array.isArray(serverFactory.productionLines) && serverFactory.productionLines.length > 0) {
        lastServerFactory = serverFactory;
      }
      return serverFactory || lastServerFactory;
    };

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
      const serverFactory = getAuthoritativeFactory();
      if (serverFactory) {
        const productionLines = Array.isArray(serverFactory.productionLines) ? serverFactory.productionLines : [];
        const produced = Object.fromEntries((serverFactory.producedSummary || []).map((item) => [item.resourceKey, item]));
        const formatProduced = (item) => item ? String(item.currentAmount) + " / " + String(item.capacity) : "0 / 0";
        if (levelElement) levelElement.textContent = String(serverFactory.level || 1);
        if (headerLevelElement) headerLevelElement.textContent = "Lv " + String(serverFactory.level || 1);
        if (multiplierElement) multiplierElement.textContent = "×" + Number(serverFactory.network?.networkSpeedMultiplier || 1).toFixed(2);
        if (ownedCountElement) ownedCountElement.textContent = String(serverFactory.network?.activeFactoryCount || 0);
        if (upgradeCostElement) upgradeCostElement.textContent = "SERVER";
        if (metalElement) metalElement.textContent = formatProduced(produced["metal-parts"]);
        if (techElement) techElement.textContent = formatProduced(produced["tech-core"]);
        if (combatElement) combatElement.textContent = formatProduced(produced["combat-module"]);
        if (collectButton) {
          collectButton.disabled = !(serverFactory.productionLines || []).some((line) => line.canCollect);
          collectButton.title = collectButton.disabled ? "Není nic hotového k vyzvednutí" : "Vybrat hotové do skladu";
        }
        if (upgradeButton) {
          upgradeButton.disabled = true;
          upgradeButton.title = productionUpgradeMessage;
          upgradeButton.setAttribute?.("aria-label", productionUpgradeMessage);
        }
        if (productionLines.length === 0) {
          deps.renderServerFactorySlotList?.(
            slotList,
            createFactoryLoadingLines(),
            {},
            { tickRateMs: deps.getServerTickRateMs?.() || 5000, formatDurationLabel: deps.formatDurationLabel }
          );
          return;
        }
        deps.renderServerFactorySlotList?.(slotList, productionLines, {
          onStartSlot: async (line, payload) => {
            const response = await deps.submitServerFactoryCommand?.({
              type: "craft-item",
              payload: {
                districtId: serverFactory.districtId,
                buildingId: serverFactory.buildingId,
                recipeId: line.recipeId,
                quantity: payload?.batchCount || 1
              }
            });
            const error = response?.errors?.[0];
            deps.setBuildingActionFeedback?.(root, error ? "warning" : "success", "Továrna", error?.message || "Výrobní linka byla aktualizována.");
            renderFactoryDashboard();
          },
          onPauseSlot: async (line) => {
            const response = await deps.submitServerFactoryCommand?.({
              type: "cancel-production-line",
              payload: {
                districtId: serverFactory.districtId,
                buildingId: serverFactory.buildingId,
                recipeId: line.recipeId
              }
            });
            const error = response?.errors?.[0];
            deps.setBuildingActionFeedback?.(root, error ? "warning" : "success", "Továrna", error?.message || "Čekající výroba byla zrušena.");
            renderFactoryDashboard();
          }
        }, { tickRateMs: deps.getServerTickRateMs?.() || 5000, formatDurationLabel: deps.formatDurationLabel });
        return;
      }
      if (!isLegacyLocalProductionEnabled()) {
        if (levelElement) levelElement.textContent = "—";
        if (headerLevelElement) headerLevelElement.textContent = "Lv —";
        if (multiplierElement) multiplierElement.textContent = "×—";
        if (ownedCountElement) ownedCountElement.textContent = "—";
        if (metalElement) metalElement.textContent = "— / —";
        if (techElement) techElement.textContent = "— / —";
        if (combatElement) combatElement.textContent = "— / —";
        if (collectButton) collectButton.disabled = true;
        if (upgradeButton) upgradeButton.disabled = true;
        deps.renderServerFactorySlotList?.(
          slotList,
          createFactoryLoadingLines(),
          {},
          { tickRateMs: deps.getServerTickRateMs?.() || 5000, formatDurationLabel: deps.formatDurationLabel }
        );
        return;
      }
      const syncResult = deps.syncFactoryProduction?.(deps.getStoredFactoryState?.()) || {};
      const factoryState = syncResult.state || {};
      const supplyState = deps.getStoredFactorySupplies?.() || {};
      const economyState = deps.getResolvedEconomyState?.() || {};
      deps.setStoredFactoryState?.(factoryState);
      const collectableAmount = getFactoryCollectableAmount(factoryState);

      const cancelFactorySlotProduction = (slotId) => {
        if (!isLegacyLocalProductionEnabled()) {
          deps.setBuildingActionFeedback?.(root, "warning", "Továrna", productionBridgeMessage);
          return;
        }
        const nextState = deps.getStoredFactoryState?.() || {};
        const targetSlot = (nextState.slots || []).find((item) => item.id === slotId);
        if (!targetSlot) return;
        const activeAmount = targetSlot.isProducing && Number(targetSlot.queuedAmount || 0) > 0 ? 1 : 0;
        const waitingAmount = Math.max(0, Math.floor(Number(targetSlot.queuedAmount || 0)) - activeAmount);
        if (waitingAmount <= 0) return;
        const slotView = dashboardViewModel.slots?.find((item) => item.slot?.id === slotId) || {};
        const unitCost = slotView.displayCost || {};
        const refundableCleanCash = Math.min(
          Math.max(0, Number(targetSlot.reservedCleanCash || 0)),
          waitingAmount * Math.max(0, Number(unitCost.cleanCash || 0))
        );
        const refundableInputs = {
          metalParts: Math.min(Math.max(0, Number(targetSlot.reservedInputs?.metalParts || 0)), waitingAmount * Math.max(0, Number(unitCost.metalParts || 0))),
          techCore: Math.min(Math.max(0, Number(targetSlot.reservedInputs?.techCore || 0)), waitingAmount * Math.max(0, Number(unitCost.techCore || 0)))
        };
        const currentEconomy = deps.getResolvedEconomyState?.() || {};
        const currentSupplies = deps.getStoredFactorySupplies?.() || {};
        deps.setStoredEconomyState?.({
          ...currentEconomy,
          cleanMoney: Math.max(0, Number(currentEconomy.cleanMoney || 0)) + refundableCleanCash
        });
        deps.setStoredFactorySupplies?.({
          ...currentSupplies,
          metalParts: Math.max(0, Number(currentSupplies.metalParts || 0)) + refundableInputs.metalParts,
          techCore: Math.max(0, Number(currentSupplies.techCore || 0)) + refundableInputs.techCore
        });
        targetSlot.queuedAmount = activeAmount;
        targetSlot.reservedCleanCash = Math.max(0, Number(targetSlot.reservedCleanCash || 0) - refundableCleanCash);
        targetSlot.reservedInputs = {
          ...targetSlot.reservedInputs,
          metalParts: Math.max(0, Number(targetSlot.reservedInputs?.metalParts || 0) - refundableInputs.metalParts),
          techCore: Math.max(0, Number(targetSlot.reservedInputs?.techCore || 0) - refundableInputs.techCore)
        };
        targetSlot.isProducing = activeAmount > 0;
        targetSlot.lastTick = Date.now();
        deps.setStoredFactoryState?.(nextState);
        deps.applyTopbarEconomy?.(root);
        renderFactoryDashboard();
      };
      const queueFactorySlotProduction = (slotView, batchCount = 1) => {
        if (!isLegacyLocalProductionEnabled()) {
          deps.setBuildingActionFeedback?.(root, "warning", "Továrna", productionBridgeMessage);
          return;
        }
        const nextState = deps.getStoredFactoryState?.() || {};
        const targetSlot = (nextState.slots || []).find((item) => item.id === slotView?.slot?.id);
        if (!targetSlot) return;
        const safeBatchCount = Math.max(1, Math.floor(Number(batchCount || 1)));
        const queueCap = Math.max(1, Math.floor(Number(slotView?.queueCap || targetSlot.queueCap || slotView?.slotStorageCap || targetSlot.slotCap || 1)));
        const currentQueue = Math.max(0, Math.floor(Number(targetSlot.queuedAmount || 0)));
        const queueSpace = Math.max(0, queueCap - currentQueue);
        if (safeBatchCount > queueSpace || !slotView?.canStart || safeBatchCount > Number(slotView.maxStartQuantity || 0)) {
          deps.setBuildingActionFeedback?.(root, "warning", "Továrna", "Fronta je plná.");
          renderFactoryDashboard();
          return;
        }
        const unitCost = slotView.displayCost || {};
        const totalCleanCash = safeBatchCount * Math.max(0, Number(unitCost.cleanCash || 0));
        const totalMetalParts = safeBatchCount * Math.max(0, Number(unitCost.metalParts || 0));
        const totalTechCore = safeBatchCount * Math.max(0, Number(unitCost.techCore || 0));
        const currentEconomy = deps.getResolvedEconomyState?.() || {};
        const currentSupplies = deps.getStoredFactorySupplies?.() || {};
        if (
          Number(currentEconomy.cleanMoney || 0) < totalCleanCash
          || Number(currentSupplies.metalParts || 0) < totalMetalParts
          || Number(currentSupplies.techCore || 0) < totalTechCore
        ) {
          deps.setBuildingActionFeedback?.(root, "warning", "Továrna", "Na vybranou výrobu nemáš dost peněz nebo materiálu.");
          renderFactoryDashboard();
          return;
        }
        deps.setStoredEconomyState?.({
          ...currentEconomy,
          cleanMoney: Number(currentEconomy.cleanMoney || 0) - totalCleanCash
        });
        deps.setStoredFactorySupplies?.({
          ...currentSupplies,
          metalParts: Number(currentSupplies.metalParts || 0) - totalMetalParts,
          techCore: Number(currentSupplies.techCore || 0) - totalTechCore
        });
        targetSlot.queueMode = true;
        targetSlot.queuedAmount = currentQueue + safeBatchCount;
        targetSlot.reservedCleanCash = Math.max(0, Number(targetSlot.reservedCleanCash || 0)) + totalCleanCash;
        targetSlot.reservedInputs = {
          ...targetSlot.reservedInputs,
          metalParts: Math.max(0, Number(targetSlot.reservedInputs?.metalParts || 0)) + totalMetalParts,
          techCore: Math.max(0, Number(targetSlot.reservedInputs?.techCore || 0)) + totalTechCore
        };
        targetSlot.isProducing = true;
        targetSlot.lastTick = Date.now();
        deps.setStoredFactoryState?.(nextState);
        deps.applyTopbarEconomy?.(root);
        renderFactoryDashboard();
      };
      const dashboardViewModel = deps.buildFactoryDashboardViewModel?.({
        factoryState,
        syncResult,
        supplyState,
        cleanMoney: economyState.cleanMoney,
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
      scheduleLocalCompletionRefresh(dashboardViewModel);
      if (!isLegacyLocalProductionEnabled() && collectButton) {
        collectButton.disabled = true;
        collectButton.title = productionBridgeMessage;
        collectButton.setAttribute?.("aria-label", productionBridgeMessage);
      }
      if (!isLegacyLocalProductionUpgradeEnabled() && upgradeButton && !upgradeButton.hidden) {
        upgradeButton.disabled = false;
        upgradeButton.title = productionUpgradeMessage;
        upgradeButton.setAttribute?.("aria-label", productionUpgradeMessage);
      }
    };

    const refreshAuthoritativeFactory = () => {
      if (isLegacyLocalProductionEnabled() || typeof deps.refreshServerFactoryReadModel !== "function") {
        return;
      }
      Promise.resolve(deps.refreshServerFactoryReadModel())
        .catch(() => null)
        .finally(() => {
          if (!popup.hidden) {
            renderFactoryDashboard();
          }
        });
    };

    const openPopup = () => {
      setActiveTab("stats");
      openOverlay(popup, { type: "modal", ariaModal: true, restoreFocusOnClose: false });
      popup.hidden = false;
      renderFactoryDashboard();
      deps.syncBuildingDetailTopbarVisibility?.(root);
      refreshAuthoritativeFactory();
    };

    documentRef?.addEventListener?.("empire:gameplay-slice-rendered", () => {
      if (!isLegacyLocalProductionEnabled() && !popup.hidden) {
        renderFactoryDashboard();
      }
    });

    documentRef?.addEventListener?.("empire:production-state-change", () => {
      if (isLegacyLocalProductionEnabled() && !popup.hidden) {
        renderFactoryDashboard();
      }
    });

    const closePopup = () => {
      clearLocalCompletionTimer();
      upgradeConfirmation.close?.();
      popup.hidden = true;
      closeOverlay(popup, { restoreFocus: false });
      deps.syncBuildingDetailTopbarVisibility?.(root);
    };

    openButton.addEventListener("click", openPopup);

    for (const button of tabButtons) {
      button.addEventListener("click", () => {
        setActiveTab(button.dataset.factoryTab || "stats");
      });
    }

    collectButton.addEventListener("click", () => {
      const serverFactory = getAuthoritativeFactory();
      if (serverFactory) {
        deps.submitServerFactoryCommand?.({
          type: "collect-production",
          payload: { districtId: serverFactory.districtId, buildingId: serverFactory.buildingId }
        }).then((response) => {
          const error = response?.errors?.[0];
          const updated = deps.getServerFactoryReadModel?.();
          const partial = updated?.productionLines?.some((line) => line.canCollect);
          deps.setBuildingActionFeedback?.(
            root,
            error ? "warning" : partial ? "warning" : "success",
            "Továrna",
            error?.message || (partial
              ? "Do skladu se vešla pouze část produkce. Zbytek zůstal v Továrně."
              : "Hotová produkce byla přesunuta do skladu.")
          );
          renderFactoryDashboard();
        });
        return;
      }
      if (!isLegacyLocalProductionEnabled()) {
        deps.setBuildingActionFeedback?.(root, "warning", "Továrna", productionBridgeMessage);
        renderFactoryDashboard();
        return;
      }
      const collected = deps.collectFactoryOutputsToSupplies?.() || { total: 0, items: [] };
      renderFactoryDashboard();

      if (collected.total <= 0) {
        deps.setBuildingActionFeedback?.(
          root,
          "warning",
          "Továrna",
          collected.remaining > 0 ? "Ve SKLADU není dost místa." : "Není nic hotového k vyzvednutí."
        );
        return;
      }

      deps.setBuildingActionFeedback?.(
        root,
        collected.partial ? "warning" : "success",
        "Továrna",
        collected.partial
          ? "Do SKLADU se vešla pouze část produkce. Zbytek zůstal v Továrně."
          : "Hotová produkce byla přesunuta do SKLADU."
      );

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
      if (!isLegacyLocalProductionUpgradeEnabled()) {
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
      const currentSpeedPct = Math.round((Number(currentMultiplier || 1) - 1) * 100);
      const nextSpeedPct = Math.round((Number(nextMultiplier || currentMultiplier || 1) - 1) * 100);
      const hasEnoughMoney = Number(economyState.cleanMoney || 0) >= upgradeCost;
      const confirmed = await upgradeConfirmation.open({
        benefits: [{
          icon: "x",
          label: "Rychlost výroby",
          value: `+${speedGainPct}%`,
          detail: `+${currentSpeedPct}% → +${nextSpeedPct}%`
        }],
        buildingLabel: "Továrna",
        canConfirm: hasEnoughMoney,
        confirmLabel: "Potvrdit upgrade",
        costLabel: deps.formatCurrency?.(upgradeCost) || String(upgradeCost),
        noteLabel: hasEnoughMoney
          ? `Po potvrzení zaplatíš ${deps.formatCurrency?.(upgradeCost) || upgradeCost} clean cash.`
          : `Chybí ${deps.formatCurrency?.(upgradeCost - Number(economyState.cleanMoney || 0)) || (upgradeCost - Number(economyState.cleanMoney || 0))} clean cash.`,
        titleLabel: "Továrna",
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

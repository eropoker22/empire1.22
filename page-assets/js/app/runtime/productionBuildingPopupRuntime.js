function isButtonElement(element, ButtonCtor) {
  if (!element) {
    return false;
  }

  return ButtonCtor ? element instanceof ButtonCtor : typeof element.addEventListener === "function";
}

function queryAll(root, selector) {
  return selector ? Array.from(root?.querySelectorAll?.(selector) || []) : [];
}

export function createProductionBuildingPopupRuntime(deps = {}) {
  const selectors = deps.selectors || {};
  const ButtonCtor = deps.HTMLButtonElement || (typeof HTMLButtonElement !== "undefined" ? HTMLButtonElement : null);
  const documentRef = deps.documentRef || (typeof document !== "undefined" ? document : null);
  const maxLevel = Number(deps.maxLevel || 14);

  const getProductionSlotState = (job) => {
    if (!job) {
      return { label: "Připraveno", isActive: false };
    }

    if (job.status === "running") {
      return { label: "Výroba", isActive: true };
    }

    return { label: "Hotovo", isActive: true };
  };

  const renderProductionBuildingInfo = ({
    infoTextElement,
    infoEffectsElement,
    infoActionsElement,
    buildingName,
    recipes,
    state,
    readyCount,
    upgradeCost,
    maxLevel: buildingMaxLevel
  }) => {
    deps.renderProductionBuildingInfoPanel?.({
      infoTextElement,
      infoEffectsElement,
      infoActionsElement,
      ...deps.createProductionBuildingInfoViewModel?.({
        buildingName,
        recipes,
        state,
        readyCount,
        upgradeCost,
        maxLevel: buildingMaxLevel,
        productionConfig: deps.PRODUCTION_BUILDING_CONFIG,
        getMultiplier: deps.getProductionBuildingMultiplier,
        formatCurrency: deps.formatCurrency,
        formatDurationLabel: deps.formatDurationLabel,
        getResourceLabel: deps.getProductionResourceLabel
      })
    }, {}, { formatCurrency: deps.formatCurrency });
  };

  const createProductionCard = (root, buildingName, recipeId, recipeKey, recipe, rerender) => {
    const job = deps.getProductionJob?.(recipeKey);
    const buildingState = deps.getStoredProductionBuildingState?.(buildingName) || {};
    const durationMultiplier = deps.getProductionBuildingMultiplier?.(buildingName, buildingState.level) || 1;
    const effectiveDurationMs = Math.max(1000, Math.round(Number(recipe?.durationMs || 0) / durationMultiplier));
    const inputAmounts = Object.fromEntries(
      Object.keys(recipe?.inputs || {}).map((itemId) => [itemId, deps.getInventoryAmount?.("materials", itemId) || 0])
    );
    const getMaxBatches = () => {
      const cleanCost = Math.max(0, Number(recipe?.cleanMoneyCost || 0));
      return Math.min(
        99,
        cleanCost ? Math.floor(Number(deps.getResolvedEconomyState?.().cleanMoney || 0) / cleanCost) : 99,
        ...Object.entries(recipe?.inputs || {}).map(([itemId, amount]) => Math.floor((deps.getInventoryAmount?.("materials", itemId) || 0) / Math.max(1, Number(amount || 0))))
      );
    };
    const viewModel = {
      root,
      buildingName,
      recipeId,
      recipeKey,
      recipe,
      job,
      effectiveDurationMs,
      slotState: getProductionSlotState(job),
      outputInventoryAmount: deps.getInventoryAmount?.(recipe?.output?.inventory, recipe?.output?.itemId) || 0,
      visual: deps.PRODUCTION_SLOT_VISUALS?.[buildingName]?.[recipeId] || null,
      inputAmounts,
      canStart: deps.hasEnoughMaterials?.(recipe?.inputs || {}) || false,
      maxBatches: getMaxBatches()
    };
    const card = deps.renderRecipeCard?.(viewModel, {
      getMaxBatches,
      onStart: ({ batchCount }) => {
        const requiredInputs = deps.getScaledProductionInputs?.(recipe?.inputs || {}, batchCount) || {};
        const durationMs = effectiveDurationMs * batchCount;
        const cleanCost = Math.max(0, Number(recipe?.cleanMoneyCost || 0) * batchCount);
        const economyState = deps.getResolvedEconomyState?.() || {};
        if (!deps.hasEnoughMaterials?.(requiredInputs) || Number(economyState.cleanMoney || 0) < cleanCost) {
          rerender?.();
          return;
        }

        deps.consumeMaterials?.(requiredInputs);
        if (cleanCost > 0) deps.setStoredEconomyState?.({ ...economyState, cleanMoney: economyState.cleanMoney - cleanCost });
        deps.persistProductionJob?.(recipeKey, {
          status: "running",
          readyAt: new Date(Date.now() + durationMs).toISOString(),
          output: { ...recipe.output, amount: Number(recipe.output.amount || 0) * batchCount },
          quantity: batchCount,
          durationMs
        });
        rerender?.();
        deps.scheduleProductionJob?.(recipeKey, rerender);
      },
      onStop: () => {
        const currentJob = deps.getProductionJob?.(recipeKey);
        if (!currentJob || currentJob.status !== "running") return rerender?.();
        deps.clearProductionJob?.(recipeKey);
        rerender?.();
      },
      onCollect: () => {
        const currentJob = deps.getProductionJob?.(recipeKey);
        if (!currentJob || currentJob.status !== "ready") return rerender?.();
        deps.applyInventoryOutput?.(currentJob.output);
        deps.clearProductionJob?.(recipeKey);
        deps.appendBuildingActionResultEntry?.(root, "police", deps.createStorageCollectResultPayload?.({
          buildingLabel: deps.PRODUCTION_BUILDING_CONFIG?.[buildingName]?.label || "Budova",
          items: [{
            label: deps.getProductionResourceLabel?.(currentJob.output?.itemId),
            amount: Math.max(0, Number(currentJob.output?.amount || 0))
          }],
          meta: "Hotová výroba"
        }), {}, { syncPreview: true, forceLog: true });
        rerender?.();
      }
    }, {
      mount: root,
      formatCurrency: deps.formatCurrency,
      formatDurationLabel: deps.formatDurationLabel,
      getResourceLabel: deps.getProductionResourceLabel,
      normalizeResourceColorKey: deps.normalizeProductionResourceColorKey
    });

    if (job?.status === "running") {
      deps.scheduleProductionJob?.(recipeKey, rerender);
    }

    return card;
  };

  const renderProductionPanel = (root, panelName, recipes, rerender) => {
    const mount = root?.querySelector?.(`[data-production-panel="${panelName}"]`);

    if (!mount) {
      return false;
    }

    deps.syncCompletedProductionJobs?.();

    const safeRerender = typeof rerender === "function"
      ? rerender
      : () => {
          renderProductionPanel(root, panelName, recipes);
        };

    return deps.renderProductionPanelUi?.({
      mount,
      recipes: Object.entries(recipes || {}).map(([recipeId, recipe]) => ({
        prebuiltCard: createProductionCard(root, panelName, recipeId, `${panelName}:${recipeId}`, recipe, safeRerender)
      }))
    }, {}, { mount });
  };

  const bindProductionBuildingPopup = (root, {
    buildingName,
    openSelector,
    popupSelector,
    closeSelector,
    recipes
  }) => {
    const openButton = root?.querySelector?.(openSelector);
    const popup = root?.querySelector?.(popupSelector);
    const closeElements = queryAll(root, closeSelector);

    if (!openButton || !popup || closeElements.length === 0) {
      return false;
    }

    const config = deps.PRODUCTION_BUILDING_CONFIG?.[buildingName];
    const levelElement = popup.querySelector(selectors.level);
    const headerLevelElement = popup.querySelector(selectors.headerLevel);
    const multiplierElement = popup.querySelector(selectors.multiplier);
    const readyElement = popup.querySelector(selectors.ready);
    const upgradeCostElement = popup.querySelector(selectors.upgradeCost);
    const effectsElement = popup.querySelector(selectors.effects);
    const collectButton = popup.querySelector(selectors.collect);
    const upgradeButton = popup.querySelector(selectors.upgrade);
    const infoTextElement = popup.querySelector(selectors.infoText);
    const infoEffectsElement = popup.querySelector(selectors.infoEffects);
    const infoActionsElement = popup.querySelector(selectors.infoActions);
    const tabButtons = queryAll(popup, selectors.tab)
      .filter((button) => String(button.dataset.productionBuildingTab || "").startsWith(`${buildingName}:`));
    const panels = queryAll(popup, selectors.panel)
      .filter((panel) => String(panel.dataset.productionBuildingPanel || "").startsWith(`${buildingName}:`));

    const setActiveTab = (tabName = "stats") => {
      for (const button of tabButtons) {
        const isActive = button.dataset.productionBuildingTab === `${buildingName}:${tabName}`;
        button.classList.toggle("is-active", isActive);
        button.setAttribute("aria-selected", isActive ? "true" : "false");
      }

      for (const panel of panels) {
        panel.hidden = panel.dataset.productionBuildingPanel !== `${buildingName}:${tabName}`;
      }
    };

    const renderDashboard = () => {
      deps.syncCompletedProductionJobs?.();
      const state = deps.getStoredProductionBuildingState?.(buildingName) || {};
      const multiplier = deps.getProductionBuildingMultiplier?.(buildingName, state.level) || 1;
      const readyCount = deps.getProductionBuildingReadyCount?.(buildingName, recipes) || 0;
      const upgradeCost = state.level < maxLevel ? deps.getProductionBuildingUpgradeCost?.(buildingName, state.level + 1) || 0 : 0;

      if (levelElement) levelElement.textContent = String(state.level);
      if (headerLevelElement) headerLevelElement.textContent = `Lv ${state.level}`;
      if (multiplierElement) multiplierElement.textContent = `${multiplier.toFixed(2)}x`;
      if (readyElement) readyElement.textContent = `${readyCount}/${Object.keys(recipes || {}).length}`;
      if (upgradeCostElement) upgradeCostElement.textContent = state.level < maxLevel ? deps.formatCurrency?.(upgradeCost) : "MAX";
      if (effectsElement) effectsElement.textContent = deps.getProductionBuildingEffectsLabel?.(buildingName, state.level);

      renderProductionBuildingInfo({
        infoTextElement,
        infoEffectsElement,
        infoActionsElement,
        buildingName,
        recipes,
        state,
        readyCount,
        upgradeCost,
        maxLevel
      });

      if (isButtonElement(collectButton, ButtonCtor)) {
        collectButton.disabled = readyCount <= 0;
        collectButton.textContent = "+";
        const collectLabel = readyCount > 0
          ? `Vybrat hotové do skladu (${readyCount})`
          : "Vybrat hotové do skladu";
        collectButton.title = collectLabel;
        collectButton.setAttribute("aria-label", collectLabel);
      }

      if (isButtonElement(upgradeButton, ButtonCtor)) {
        upgradeButton.disabled = state.level >= maxLevel;
        upgradeButton.textContent = state.level >= maxLevel ? "MAX" : "⇪";
        const upgradeLabel = state.level >= maxLevel
          ? "Max level"
          : `Upgrade budovy (${deps.formatCurrency?.(upgradeCost)})`;
        upgradeButton.title = upgradeLabel;
        upgradeButton.setAttribute("aria-label", upgradeLabel);
      }

      renderProductionPanel(root, buildingName, recipes, renderDashboard);
    };

    for (const button of tabButtons) {
      button.addEventListener("click", () => {
        const tabName = String(button.dataset.productionBuildingTab || "").split(":")[1] || "stats";
        setActiveTab(tabName);
      });
    }

    if (isButtonElement(collectButton, ButtonCtor)) {
      collectButton.addEventListener("click", () => {
        const collected = deps.collectReadyProductionForBuilding?.(buildingName, recipes) || { total: 0, items: [] };
        renderDashboard();

        if (collected.total <= 0) {
          deps.setBuildingActionFeedback?.(root, "warning", config?.label || "Budova", "Není nic hotového k vyzvednutí.");
          return;
        }

        deps.appendBuildingActionResultEntry?.(root, "police", deps.createStorageCollectResultPayload?.({
          buildingLabel: config?.label || "Budova",
          items: collected.items,
          meta: deps.getProductionBuildingEffectsLabel?.(buildingName, deps.getStoredProductionBuildingState?.(buildingName).level)
        }), {}, { syncPreview: true, forceLog: true });
        deps.documentRef?.dispatchEvent?.(new CustomEvent("empire:production-collected", {
          detail: {
            type: "production:collected",
            source: "production-building-popup",
            buildingName,
            amount: collected.total,
            items: collected.items
          }
        }));
      });
    }

    if (isButtonElement(upgradeButton, ButtonCtor)) {
      upgradeButton.addEventListener("click", () => {
        const currentState = deps.getStoredProductionBuildingState?.(buildingName) || {};

        if (currentState.level >= maxLevel) {
          renderDashboard();
          return;
        }

        const nextLevel = currentState.level + 1;
        const upgradeCost = deps.getProductionBuildingUpgradeCost?.(buildingName, nextLevel) || 0;
        const economyState = deps.getResolvedEconomyState?.() || {};

        if (Number(economyState.cleanMoney || 0) < upgradeCost) {
          deps.setBuildingActionFeedback?.(root, "warning", config?.label || "Budova", `Na upgrade chybí ${deps.formatCurrency?.(upgradeCost - economyState.cleanMoney)}.`);
          renderDashboard();
          return;
        }

        deps.setStoredEconomyState?.({
          ...economyState,
          cleanMoney: economyState.cleanMoney - upgradeCost
        });
        deps.setStoredProductionBuildingState?.(buildingName, {
          level: nextLevel
        });
        deps.applyTopbarEconomy?.(root);
        renderDashboard();
        deps.setBuildingActionFeedback?.(
          root,
          "success",
          config?.label || "Budova",
          `${config?.label || "Budova"} byla upgradovaná na level ${nextLevel}.`,
          `${deps.getProductionBuildingEffectsLabel?.(buildingName, nextLevel)}`
        );
      });
    }

    const openPopup = () => {
      setActiveTab("stats");
      renderDashboard();
      popup.hidden = false;
      deps.syncBuildingDetailTopbarVisibility?.(root);
    };

    const closePopup = () => {
      popup.hidden = true;
      deps.syncBuildingDetailTopbarVisibility?.(root);
    };

    openButton.addEventListener("click", openPopup);

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

  const bindArmoryPopup = (root) => bindProductionBuildingPopup(root, {
    buildingName: "armory",
    openSelector: deps.ARMORY_POPUP_OPEN_SELECTOR,
    popupSelector: deps.ARMORY_POPUP_SELECTOR,
    closeSelector: deps.ARMORY_POPUP_CLOSE_SELECTOR,
    recipes: deps.ARMORY_RECIPES
  });

  const bindPharmacyPopup = (root) => bindProductionBuildingPopup(root, {
    buildingName: "pharmacy",
    openSelector: deps.PHARMACY_POPUP_OPEN_SELECTOR,
    popupSelector: deps.PHARMACY_POPUP_SELECTOR,
    closeSelector: deps.PHARMACY_POPUP_CLOSE_SELECTOR,
    recipes: deps.PHARMACY_RECIPES
  });

  const bindDrugLabPopup = (root) => bindProductionBuildingPopup(root, {
    buildingName: "druglab",
    openSelector: deps.DRUGLAB_POPUP_OPEN_SELECTOR,
    popupSelector: deps.DRUGLAB_POPUP_SELECTOR,
    closeSelector: deps.DRUGLAB_POPUP_CLOSE_SELECTOR,
    recipes: deps.DRUGLAB_RECIPES
  });

  return {
    bindArmoryPopup,
    bindDrugLabPopup,
    bindPharmacyPopup,
    bindProductionBuildingPopup,
    createProductionCard,
    getProductionSlotState,
    renderProductionBuildingInfo,
    renderProductionPanel
  };
}

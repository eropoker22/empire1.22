import { createBuildingUpgradeConfirmationController } from "./buildingUpgradeConfirmation.js";
import { closeOverlay, openOverlay } from "../ui/legacyOverlayCoordinator.js";

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
  const allowLegacyLocalProduction = deps.allowLegacyLocalProduction !== false;
  const allowLegacyProductionUpgrade = deps.allowLegacyProductionUpgrade !== false;
  const productionBridgeMessage = "Výrobní panel používá serverový production/craft flow. Legacy lokální výroba je vypnutá.";
  const productionUpgradeMessage = "Serverový upgrade se provádí přes konkrétní kartu budovy v districtu.";
  const baseOwnedCount = Math.max(1, Math.floor(Number(deps.baseOwnedProductionBuildingCount || 1)));
  const defaultQueueCapPerExtraBuilding = Math.max(0, Math.floor(Number(deps.queueCapPerExtraProductionBuilding ?? 4)));
  const defaultOutputCapPerWarehouse = Math.max(0, Math.floor(Number(deps.outputCapPerWarehouse ?? 5)));
  const getServerLines = (production) => Array.isArray(production?.productionLines)
    ? production.productionLines
    : Array.isArray(production?.lines)
      ? production.lines
      : [];

  const getConfigNumber = (buildingName, key, fallback = 0) => {
    const value = Number(deps.PRODUCTION_BUILDING_CONFIG?.[buildingName]?.[key]);
    return Number.isFinite(value) ? value : fallback;
  };

  const normalizeCount = (value, fallback = 0, minValue = 0) => {
    const normalized = Math.floor(Number(value));
    if (Number.isFinite(normalized)) {
      return Math.max(minValue, normalized);
    }

    const normalizedFallback = Math.floor(Number(fallback));
    return Number.isFinite(normalizedFallback) ? Math.max(minValue, normalizedFallback) : minValue;
  };

  const formatProductionSpeedBonus = (multiplier = 1) => {
    const safeMultiplier = Number(multiplier);
    if (!Number.isFinite(safeMultiplier)) {
      return "+0%";
    }
    const pct = Math.round((safeMultiplier - 1) * 100);
    return `${pct >= 0 ? "+" : ""}${pct}%`;
  };

  const getOwnedWarehouseCount = () => normalizeCount(deps.getOwnedWarehouseCount?.(), 0, 0);

  const getOwnedProductionBuildingCount = (buildingName, fallbackLevel = 1) => {
    const fallback = normalizeCount(fallbackLevel, baseOwnedCount, baseOwnedCount);
    const rawCount = buildingName === "pharmacy"
      ? deps.getOwnedPharmacyCount?.()
      : buildingName === "druglab"
        ? deps.getOwnedDrugLabCount?.()
        : buildingName === "armory"
          ? deps.getOwnedArmoryCount?.()
          : fallback;
    return normalizeCount(rawCount, fallback, baseOwnedCount);
  };

  const getProductionOutputCap = (buildingName) => {
    const baseCap = Math.max(0, Math.floor(getConfigNumber(buildingName, "outputCap", 0)));
    const warehouseBonus = getOwnedWarehouseCount() * Math.max(0, Math.floor(getConfigNumber(
      buildingName,
      "outputCapPerWarehouse",
      defaultOutputCapPerWarehouse
    )));
    return baseCap > 0 ? baseCap + warehouseBonus : 0;
  };

  const getProductionQueueCap = (buildingName, ownedBuildingCount = baseOwnedCount) => {
    const baseCap = Math.max(0, Math.floor(getConfigNumber(
      buildingName,
      "queueCap",
      getConfigNumber(buildingName, "outputCap", 0)
    )));
    const extraBuildings = Math.max(0, Math.floor(Number(ownedBuildingCount || baseOwnedCount)) - baseOwnedCount);
    const perExtraBuilding = Math.max(0, Math.floor(getConfigNumber(
      buildingName,
      "queueCapPerExtraBuilding",
      defaultQueueCapPerExtraBuilding
    )));
    return baseCap > 0 ? baseCap + extraBuildings * perExtraBuilding : 0;
  };

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
    const legacyProductionEnabled = allowLegacyLocalProduction && buildingName !== "druglab";
    const job = deps.getProductionJob?.(recipeKey);
    const buildingState = deps.getStoredProductionBuildingState?.(buildingName) || {};
    const ownedBuildingCount = getOwnedProductionBuildingCount(buildingName, buildingState.level);
    const durationMultiplier = deps.getProductionBuildingMultiplier?.(buildingName, buildingState.level) || 1;
    const effectiveDurationMs = Math.max(1000, Math.round(Number(recipe?.durationMs || 0) / durationMultiplier));
    const outputUnitAmount = buildingName === "pharmacy" || buildingName === "armory"
      ? 1
      : Math.max(1, Math.floor(Number(recipe?.output?.amount || 1)));
    const outputCap = getProductionOutputCap(buildingName);
    const queueCap = getProductionQueueCap(buildingName, ownedBuildingCount);
    const getQueuedOutputAmount = (productionJob = null) => Math.max(0, Math.floor(Number(productionJob?.output?.amount || 0)));
    const getRemainingOutputSpace = (productionJob = null) => outputCap > 0
      ? Math.max(0, outputCap - getQueuedOutputAmount(productionJob))
      : Number.POSITIVE_INFINITY;
    const getRemainingQueueSpace = (productionJob = null) => {
      if (queueCap <= 0) {
        return Number.POSITIVE_INFINITY;
      }
      const queuedAmount = productionJob?.status === "running" ? getQueuedOutputAmount(productionJob) : 0;
      return Math.max(0, queueCap - queuedAmount);
    };
    const getRunningJobForCapacity = () => {
      const current = deps.getProductionJob?.(recipeKey);
      return current?.status === "running" ? current : null;
    };
    const inputAmounts = Object.fromEntries(
      Object.keys(recipe?.inputs || {}).map((itemId) => [itemId, deps.getInventoryAmount?.("materials", itemId) || 0])
    );
    const getMaxCapacityBatches = () => {
      return Math.min(
        99,
        outputCap > 0 ? Math.floor(getRemainingOutputSpace(getRunningJobForCapacity()) / outputUnitAmount) : 99,
        queueCap > 0 ? Math.floor(getRemainingQueueSpace(getRunningJobForCapacity()) / outputUnitAmount) : 99
      );
    };
    const getMaxBatches = () => {
      const cleanCost = Math.max(0, Number(recipe?.cleanMoneyCost || 0));
      return Math.min(
        getMaxCapacityBatches(),
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
      outputCap,
      queueCap,
      visual: deps.PRODUCTION_SLOT_VISUALS?.[buildingName]?.[recipeId] || null,
      armoryStrengthPreview: buildingName === "armory"
        ? deps.getArmoryRecipeStrengthPreview?.(recipeId, recipe) || null
        : null,
      inputAmounts,
      canStart: legacyProductionEnabled && (deps.hasEnoughMaterials?.(recipe?.inputs || {}) || false),
      maxBatches: legacyProductionEnabled ? getMaxBatches() : 0,
      maxSelectableBatches: legacyProductionEnabled ? getMaxBatches() : 0,
      allowStartWithMissingInputs: false
    };
    const card = deps.renderRecipeCard?.(viewModel, {
      getMaxBatches,
      onStart: ({ batchCount }) => {
        if (!legacyProductionEnabled) {
          deps.setBuildingActionFeedback?.(
            root,
            "warning",
            deps.PRODUCTION_BUILDING_CONFIG?.[buildingName]?.label || "Budova",
            productionBridgeMessage
          );
          rerender?.();
          return;
        }
        let currentJob = deps.getProductionJob?.(recipeKey);
        if (currentJob?.status === "ready") {
          deps.applyInventoryOutput?.(currentJob.output);
          deps.clearProductionJob?.(recipeKey);
          currentJob = null;
        } else if (currentJob && currentJob.status !== "running") {
          rerender?.();
          return;
        }

        const maxBatches = Math.max(0, Math.floor(Number(getMaxBatches() || 0)));
        const safeBatchCount = Math.min(
          Math.max(1, Math.floor(Number(batchCount || 1))),
          maxBatches
        );
        if (safeBatchCount <= 0) {
          deps.setBuildingActionFeedback?.(
            root,
            "warning",
            deps.PRODUCTION_BUILDING_CONFIG?.[buildingName]?.label || "Budova",
            "Chybí materiál pro spuštění výroby."
          );
          rerender?.();
          return;
        }

        const requiredInputs = deps.getScaledProductionInputs?.(recipe?.inputs || {}, safeBatchCount) || {};
        const durationMs = effectiveDurationMs * safeBatchCount;
        const cleanCost = Math.max(0, Number(recipe?.cleanMoneyCost || 0) * safeBatchCount);
        const economyState = deps.getResolvedEconomyState?.() || {};
        if (!deps.hasEnoughMaterials?.(requiredInputs) || Number(economyState.cleanMoney || 0) < cleanCost) {
          deps.setBuildingActionFeedback?.(
            root,
            "warning",
            deps.PRODUCTION_BUILDING_CONFIG?.[buildingName]?.label || "Budova",
            "Chybí materiál nebo clean cash pro zvolené množství."
          );
          rerender?.();
          return;
        }

        const remainingOutputSpace = getRemainingOutputSpace(currentJob);
        const remainingQueueSpace = getRemainingQueueSpace(currentJob);
        const outputAmount = Math.min(remainingOutputSpace, remainingQueueSpace, outputUnitAmount * safeBatchCount);
        if (outputAmount <= 0) {
          rerender?.();
          return;
        }
        deps.consumeMaterials?.(requiredInputs);
        if (cleanCost > 0) deps.setStoredEconomyState?.({ ...economyState, cleanMoney: economyState.cleanMoney - cleanCost });
        const baseReadyAt = currentJob?.status === "running"
          ? Math.max(Date.now(), new Date(currentJob.readyAt).getTime())
          : Date.now();
        const nextDurationMs = Math.max(0, Number(currentJob?.durationMs || 0)) + durationMs;
        const mergedInputs = {
          ...(currentJob?.inputs || {})
        };
        for (const [itemId, amount] of Object.entries(requiredInputs)) {
          mergedInputs[itemId] = Math.max(0, Number(mergedInputs[itemId] || 0) + Number(amount || 0));
        }
        deps.persistProductionJob?.(recipeKey, {
          ...(currentJob || {}),
          status: "running",
          readyAt: new Date(baseReadyAt + durationMs).toISOString(),
          output: {
            ...recipe.output,
            ...(currentJob?.output || {}),
            amount: outputCap > 0
              ? Math.min(outputCap, Math.max(0, Number(currentJob?.output?.amount || 0) + outputAmount))
              : Math.max(0, Number(currentJob?.output?.amount || 0) + outputAmount)
          },
          quantity: Math.max(0, Number(currentJob?.quantity || 0)) + safeBatchCount,
          inputs: mergedInputs,
          cleanMoneyCost: Math.max(0, Number(currentJob?.cleanMoneyCost || 0) + cleanCost),
          durationMs: nextDurationMs
        });
        rerender?.();
        deps.scheduleProductionJob?.(recipeKey, rerender);
      },
      onStop: () => {
        if (!legacyProductionEnabled) {
          deps.setBuildingActionFeedback?.(
            root,
            "warning",
            deps.PRODUCTION_BUILDING_CONFIG?.[buildingName]?.label || "Budova",
            productionBridgeMessage
          );
          rerender?.();
          return;
        }
        const currentJob = deps.getProductionJob?.(recipeKey);
        if (!currentJob || currentJob.status !== "running") return rerender?.();
        const quantity = Math.max(1, Math.floor(Number(currentJob.quantity || 1)));
        const inputRefunds = currentJob.inputs && typeof currentJob.inputs === "object"
          ? currentJob.inputs
          : deps.getScaledProductionInputs?.(recipe?.inputs || {}, quantity) || {};
        for (const [itemId, amount] of Object.entries(inputRefunds)) {
          const refundAmount = Math.max(0, Number(amount || 0));
          if (refundAmount > 0) {
            deps.setInventoryAmount?.("materials", itemId, Number(deps.getInventoryAmount?.("materials", itemId) || 0) + refundAmount);
          }
        }

        const fallbackCleanCost = Math.max(0, Number(recipe?.cleanMoneyCost || 0) * quantity);
        const cleanRefund = Math.max(0, Number(currentJob.cleanMoneyCost ?? fallbackCleanCost));
        if (cleanRefund > 0) {
          const economyState = deps.getResolvedEconomyState?.() || {};
          deps.setStoredEconomyState?.({
            ...economyState,
            cleanMoney: Number(economyState.cleanMoney || 0) + cleanRefund
          });
          deps.applyTopbarEconomy?.(root);
        }
        deps.clearProductionJob?.(recipeKey);
        rerender?.();
      },
      onCollect: () => {
        if (!legacyProductionEnabled) {
          deps.setBuildingActionFeedback?.(
            root,
            "warning",
            deps.PRODUCTION_BUILDING_CONFIG?.[buildingName]?.label || "Budova",
            productionBridgeMessage
          );
          rerender?.();
          return;
        }
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

  const createServerPharmacyCard = (root, pharmacy, line, rerender) => {
    const recipe = {
      name: line.label,
      cleanMoneyCost: line.unitCleanCashCost,
      output: { itemId: line.resourceKey, amount: 1 }
    };
    return deps.renderRecipeCard?.({
      root,
      buildingName: "pharmacy",
      recipeId: line.recipeId,
      recipe,
      serverLine: line,
      tickRateMs: deps.getServerTickRateMs?.() || 5000,
      visual: deps.PRODUCTION_SLOT_VISUALS?.pharmacy?.[line.recipeId] || null
    }, {
      onStart: async ({ batchCount }) => {
        const response = await deps.submitServerPharmacyCommand?.({
          type: "craft-item",
          payload: {
            districtId: pharmacy.districtId,
            buildingId: pharmacy.buildingId,
            recipeId: line.recipeId,
            quantity: batchCount
          }
        });
        reportServerPharmacyResult(root, response, line.label);
        rerender?.();
      },
      onStop: async () => {
        const response = await deps.submitServerPharmacyCommand?.({
          type: "cancel-pharmacy-production",
          payload: {
            districtId: pharmacy.districtId,
            buildingId: pharmacy.buildingId,
            recipeId: line.recipeId
          }
        });
        reportServerPharmacyResult(root, response, line.label);
        rerender?.();
      }
    }, {
      mount: root,
      formatCurrency: deps.formatCurrency,
      formatDurationLabel: deps.formatDurationLabel
    });
  };

  const createServerDrugLabCard = (root, drugLab, line, rerender) => {
    const recipe = {
      name: line.label,
      cleanMoneyCost: line.unitCleanCashCost,
      output: { itemId: line.resourceKey, amount: 1 }
    };
    return deps.renderRecipeCard?.({
      root,
      buildingName: "druglab",
      recipeId: line.recipeId,
      recipe,
      serverLine: line,
      cleanCashAmount: drugLab.cleanCashAmount,
      tickRateMs: deps.getServerTickRateMs?.() || 5000,
      visual: deps.PRODUCTION_SLOT_VISUALS?.druglab?.[line.recipeId] || null
    }, {
      onStart: async ({ batchCount }) => {
        const response = await deps.submitServerDrugLabCommand?.({
          type: "craft-item",
          payload: {
            districtId: drugLab.districtId,
            buildingId: drugLab.buildingId,
            recipeId: line.recipeId,
            quantity: batchCount
          }
        });
        reportServerDrugLabResult(root, response, line.label);
        rerender?.();
      },
      onStop: async () => {
        const response = await deps.submitServerDrugLabCommand?.({
          type: "cancel-drug-lab-production",
          payload: {
            districtId: drugLab.districtId,
            buildingId: drugLab.buildingId,
            recipeId: line.recipeId
          }
        });
        reportServerDrugLabResult(root, response, line.label);
        rerender?.();
      }
    }, {
      mount: root,
      formatCurrency: deps.formatCurrency,
      formatDurationLabel: deps.formatDurationLabel
    });
  };

  const createServerArmoryCard = (root, armory, line, rerender) => {
    const recipe = {
      name: line.label,
      cleanMoneyCost: 0,
      output: { itemId: line.resourceKey, amount: 1 }
    };
    return deps.renderRecipeCard?.({
      root,
      buildingName: "armory",
      recipeId: line.recipeId,
      recipe,
      serverLine: line,
      tickRateMs: deps.getServerTickRateMs?.() || 5000,
      visual: deps.PRODUCTION_SLOT_VISUALS?.armory?.[line.recipeId] || null
    }, {
      onStart: async ({ batchCount }) => {
        const response = await deps.submitServerArmoryCommand?.({
          type: "craft-item",
          payload: {
            districtId: armory.districtId,
            buildingId: armory.buildingId,
            recipeId: line.recipeId,
            quantity: batchCount
          }
        });
        reportServerArmoryResult(root, response, line.label);
        rerender?.();
      },
      onStop: async () => {
        const response = await deps.submitServerArmoryCommand?.({
          type: "cancel-production-line",
          payload: {
            districtId: armory.districtId,
            buildingId: armory.buildingId,
            recipeId: line.recipeId
          }
        });
        reportServerArmoryResult(root, response, line.label);
        rerender?.();
      }
    }, {
      mount: root,
      formatCurrency: deps.formatCurrency,
      formatDurationLabel: deps.formatDurationLabel
    });
  };

  const reportServerPharmacyResult = (root, response, label) => {
    const error = response?.errors?.[0];
    if (error) {
      deps.setBuildingActionFeedback?.(root, "warning", "Lékárna", error.message || "Akci se nepodařilo provést.");
      return;
    }
    deps.setBuildingActionFeedback?.(root, "success", "Lékárna", label + " byl aktualizován.");
  };

  const reportServerDrugLabResult = (root, response, label) => {
    const error = response?.errors?.[0];
    if (error) {
      deps.setBuildingActionFeedback?.(root, "warning", "Lab", error.message || "Akci se nepodařilo provést.");
      return;
    }
    deps.setBuildingActionFeedback?.(root, "success", "Lab", label + " byl aktualizován.");
  };

  const reportServerArmoryResult = (root, response, label) => {
    const error = response?.errors?.[0];
    if (error) {
      deps.setBuildingActionFeedback?.(root, "warning", "Zbrojovka", error.message || "Akci se nepodařilo provést.");
      return;
    }
    deps.setBuildingActionFeedback?.(root, "success", "Zbrojovka", label + " byl aktualizován.");
  };

  const renderProductionPanel = (root, panelName, recipes, rerender) => {
    const mount = root?.querySelector?.(`[data-production-panel="${panelName}"]`);

    if (!mount) {
      return false;
    }

    const serverPharmacy = panelName === "pharmacy" && !allowLegacyLocalProduction
      ? deps.getServerPharmacyReadModel?.()
      : null;
    const serverDrugLab = panelName === "druglab"
      ? deps.getServerDrugLabReadModel?.()
      : null;
    const serverArmory = panelName === "armory"
      ? deps.getServerArmoryReadModel?.()
      : null;
    const serverProduction = serverPharmacy || serverDrugLab || serverArmory;
    if (serverProduction) {
      const safeRerender = typeof rerender === "function" ? rerender : () => renderProductionPanel(root, panelName, recipes);
      return deps.renderProductionPanelUi?.({
        mount,
        recipes: getServerLines(serverProduction).map((line) => ({
          prebuiltCard: serverArmory
            ? createServerArmoryCard(root, serverArmory, line, safeRerender)
            : serverDrugLab
            ? createServerDrugLabCard(root, serverDrugLab, line, safeRerender)
            : createServerPharmacyCard(root, serverPharmacy, line, safeRerender)
        }))
      }, {}, { mount });
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
    const infoUpgradeCostElement = popup.querySelector("[data-production-building-info-upgrade-cost]");
    const infoUpgradeBenefitElement = popup.querySelector("[data-production-building-info-upgrade-benefit]");
    const tabButtons = queryAll(popup, selectors.tab)
      .filter((button) => String(button.dataset.productionBuildingTab || "").startsWith(`${buildingName}:`));
    const panels = queryAll(popup, selectors.panel)
      .filter((panel) => String(panel.dataset.productionBuildingPanel || "").startsWith(`${buildingName}:`));
    const upgradeConfirmation = deps.createUpgradeConfirmationController?.({
      documentRef,
      host: popup,
      variant: "production"
    }) || createBuildingUpgradeConfirmationController({
      documentRef,
      host: popup,
      variant: "production"
    });

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
      const serverPharmacy = buildingName === "pharmacy" && !allowLegacyLocalProduction
        ? deps.getServerPharmacyReadModel?.()
        : null;
      const serverDrugLab = buildingName === "druglab"
        ? deps.getServerDrugLabReadModel?.()
        : null;
      const serverArmory = buildingName === "armory"
        ? deps.getServerArmoryReadModel?.()
        : null;
      const serverProduction = serverPharmacy || serverDrugLab || serverArmory;
      deps.syncCompletedProductionJobs?.();
      const state = serverProduction
        ? { level: serverProduction.level || 1 }
        : deps.getStoredProductionBuildingState?.(buildingName) || {};
      const multiplier = deps.getProductionBuildingMultiplier?.(buildingName, state.level) || 1;
      const nextMultiplier = state.level < maxLevel
        ? deps.getProductionBuildingMultiplier?.(buildingName, state.level + 1) || multiplier
        : multiplier;
      const readyCount = serverProduction
        ? getServerLines(serverProduction).filter((line) => Number(line.producedAmount || 0) > 0).length
        : deps.getProductionBuildingReadyCount?.(buildingName, recipes) || 0;
      const upgradeCost = state.level < maxLevel ? deps.getProductionBuildingUpgradeCost?.(buildingName, state.level + 1) || 0 : 0;
      const ownedBuildingCount = getOwnedProductionBuildingCount(buildingName, state.level);
      const speedGainPct = Math.max(0, Math.round((Number(nextMultiplier || multiplier || 1) - Number(multiplier || 1)) * 100));
      const upgradeBenefitLabel = state.level < maxLevel
        ? `+${speedGainPct}% rychlost · celkem ${formatProductionSpeedBonus(nextMultiplier || multiplier || 1)}`
        : "Maximální level";

      if (levelElement) levelElement.textContent = String(ownedBuildingCount);
      if (headerLevelElement) headerLevelElement.textContent = `Lv ${state.level}`;
      if (multiplierElement) multiplierElement.textContent = formatProductionSpeedBonus(multiplier);
      if (readyElement) readyElement.textContent = `${readyCount}/${Object.keys(recipes || {}).length}`;
      if (upgradeCostElement) upgradeCostElement.textContent = state.level < maxLevel ? deps.formatCurrency?.(upgradeCost) : "MAX";
      if (infoUpgradeCostElement) infoUpgradeCostElement.textContent = state.level < maxLevel ? deps.formatCurrency?.(upgradeCost) : "MAX";
      if (infoUpgradeBenefitElement) {
        infoUpgradeBenefitElement.textContent = upgradeBenefitLabel;
      }
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
        collectButton.disabled = serverProduction ? readyCount <= 0 : !allowLegacyLocalProduction || buildingName === "druglab" || readyCount <= 0;
        collectButton.textContent = "+";
        const collectLabel = serverProduction
          ? readyCount > 0 ? "Vybrat hotovou produkci do skladu" : "Není nic hotového k vyzvednutí"
          : !allowLegacyLocalProduction
          ? productionBridgeMessage
          : readyCount > 0
          ? `Vybrat hotové do skladu (${readyCount})`
          : "Vybrat hotové do skladu";
        collectButton.title = collectLabel;
        collectButton.setAttribute("aria-label", collectLabel);
      }

      if (isButtonElement(upgradeButton, ButtonCtor)) {
        const hasNextUpgrade = state.level < maxLevel;
        upgradeButton.hidden = !hasNextUpgrade;
        upgradeButton.style.display = hasNextUpgrade ? "" : "none";
        upgradeButton.disabled = !hasNextUpgrade || (allowLegacyProductionUpgrade && state.level >= maxLevel);
        upgradeButton.textContent = "⇪";
        const upgradeLabel = !allowLegacyProductionUpgrade
          ? productionUpgradeMessage
          : !hasNextUpgrade
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
      collectButton.addEventListener("click", async () => {
        const serverPharmacy = buildingName === "pharmacy" && !allowLegacyLocalProduction
          ? deps.getServerPharmacyReadModel?.()
          : null;
        const serverDrugLab = buildingName === "druglab"
          ? deps.getServerDrugLabReadModel?.()
          : null;
        const serverArmory = buildingName === "armory"
          ? deps.getServerArmoryReadModel?.()
          : null;
        const serverProduction = serverPharmacy || serverDrugLab || serverArmory;
        if (serverProduction) {
          const submit = serverArmory
            ? deps.submitServerArmoryCommand
            : serverDrugLab
              ? deps.submitServerDrugLabCommand
              : deps.submitServerPharmacyCommand;
          const report = serverArmory
            ? reportServerArmoryResult
            : serverDrugLab
              ? reportServerDrugLabResult
              : reportServerPharmacyResult;
          for (const line of getServerLines(serverProduction).filter((item) => item.canCollect)) {
            const response = await submit?.({
              type: "collect-production",
              payload: {
                districtId: serverProduction.districtId,
                buildingId: serverProduction.buildingId,
                resourceKey: line.resourceKey
              }
            });
            if (response?.errors?.length) {
              report(root, response, line.label);
              renderDashboard();
              return;
            }
          }
          const updated = serverArmory
            ? deps.getServerArmoryReadModel?.()
            : serverDrugLab
              ? deps.getServerDrugLabReadModel?.()
              : deps.getServerPharmacyReadModel?.();
          const partial = getServerLines(updated).some((line) => Number(line.producedAmount || 0) > 0);
          const buildingLabel = serverArmory ? "Zbrojovka" : serverDrugLab ? "Lab" : "Lékárna";
          deps.setBuildingActionFeedback?.(
            root,
            partial ? "warning" : "success",
            buildingLabel,
            partial
              ? "Do skladu se vešla pouze část produkce. Zbytek zůstal v " + (serverArmory ? "Zbrojovce." : serverDrugLab ? "Labu." : "Lékárně.")
              : "Hotová produkce byla přesunuta do skladu."
          );
          renderDashboard();
          return;
        }
        if (!allowLegacyLocalProduction || buildingName === "druglab") {
          deps.setBuildingActionFeedback?.(root, "warning", config?.label || "Budova", productionBridgeMessage);
          renderDashboard();
          return;
        }
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
      upgradeButton.addEventListener("click", async () => {
        if (!allowLegacyProductionUpgrade || buildingName === "druglab") {
          deps.setBuildingActionFeedback?.(root, "warning", config?.label || "Budova", productionUpgradeMessage);
          renderDashboard();
          return;
        }
        const currentState = deps.getStoredProductionBuildingState?.(buildingName) || {};

        if (currentState.level >= maxLevel) {
          renderDashboard();
          return;
        }

        const nextLevel = currentState.level + 1;
        const upgradeCost = deps.getProductionBuildingUpgradeCost?.(buildingName, nextLevel) || 0;
        const economyState = deps.getResolvedEconomyState?.() || {};
        const currentMultiplier = deps.getProductionBuildingMultiplier?.(buildingName, currentState.level) || 1;
        const nextMultiplier = deps.getProductionBuildingMultiplier?.(buildingName, nextLevel) || currentMultiplier;
        const speedGainPct = Math.max(0, Math.round((Number(nextMultiplier || currentMultiplier || 1) - Number(currentMultiplier || 1)) * 100));
        const currentSpeedLabel = formatProductionSpeedBonus(currentMultiplier || 1);
        const nextSpeedLabel = formatProductionSpeedBonus(nextMultiplier || currentMultiplier || 1);
        const hasEnoughMoney = Number(economyState.cleanMoney || 0) >= upgradeCost;
        const confirmed = await upgradeConfirmation.open({
          benefits: [{
            icon: "x",
            label: "Rychlost výroby",
            value: `+${speedGainPct}%`,
            detail: `${currentSpeedLabel} → ${nextSpeedLabel}`
          }],
          buildingLabel: config?.label || "Budova",
          canConfirm: hasEnoughMoney,
          confirmLabel: hasEnoughMoney ? "Potvrdit upgrade" : "Nedostatek clean cash",
          costLabel: deps.formatCurrency?.(upgradeCost) || String(upgradeCost),
          description: "Potvrzením posuneš typ budovy na vyšší úroveň a okamžitě získáš nové bonusy.",
          noteLabel: hasEnoughMoney
            ? `Po potvrzení zaplatíš ${deps.formatCurrency?.(upgradeCost) || upgradeCost} clean cash.`
            : `Chybí ${deps.formatCurrency?.(upgradeCost - Number(economyState.cleanMoney || 0)) || (upgradeCost - Number(economyState.cleanMoney || 0))} clean cash.`,
          titleLabel: `${config?.label || "Budova"} · L${currentState.level} → L${nextLevel}`,
          upgradeLabel: `L${currentState.level} → L${nextLevel}`
        });

        if (!confirmed) {
          return;
        }

        const freshEconomyState = deps.getResolvedEconomyState?.() || {};

        if (Number(freshEconomyState.cleanMoney || 0) < upgradeCost) {
          deps.setBuildingActionFeedback?.(root, "warning", config?.label || "Budova", `Na upgrade chybí ${deps.formatCurrency?.(upgradeCost - freshEconomyState.cleanMoney)}.`);
          renderDashboard();
          return;
        }

        deps.setStoredEconomyState?.({
          ...freshEconomyState,
          cleanMoney: freshEconomyState.cleanMoney - upgradeCost
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
      openOverlay(popup, { type: "modal", ariaModal: true, restoreFocusOnClose: false });
      popup.hidden = false;
      deps.syncBuildingDetailTopbarVisibility?.(root);
    };

    const closePopup = () => {
      upgradeConfirmation.close?.();
      popup.hidden = true;
      closeOverlay(popup, { restoreFocus: false });
      deps.syncBuildingDetailTopbarVisibility?.(root);
    };

    openButton.addEventListener("click", openPopup);

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
    createServerArmoryCard,
    createServerPharmacyCard,
    getProductionSlotState,
    renderProductionBuildingInfo,
    renderProductionPanel
  };
}

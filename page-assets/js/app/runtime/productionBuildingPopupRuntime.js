import { createBuildingUpgradeConfirmationController } from "./buildingUpgradeConfirmation.js";
import { FREE_GAMEPLAY_TICK_MS } from "../../../../packages/game-config/src/legacy-page/economy-config.js";
import {
  cancelWaitingLocalProduction,
  collectLocalProduction,
  normalizeLocalProductionJob,
  queueLocalProduction
} from "./localProductionLineState.js";
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

function setElementPropertyIfChanged(element, propertyName, value) {
  if (!element || element[propertyName] === value) return false;
  element[propertyName] = value;
  return true;
}

function setElementStylePropertyIfChanged(element, propertyName, value) {
  if (!element?.style || element.style[propertyName] === value) return false;
  element.style[propertyName] = value;
  return true;
}

function setElementAttributeIfChanged(element, attributeName, value) {
  const normalizedValue = String(value);
  if (typeof element?.getAttribute === "function" && element.getAttribute(attributeName) === normalizedValue) {
    return false;
  }
  element?.setAttribute?.(attributeName, normalizedValue);
  return true;
}

function resolveBooleanPolicy(policy, defaultValue = true) {
  try {
    const value = typeof policy === "function" ? policy() : policy;
    return value === undefined ? defaultValue : value === true;
  } catch {
    return false;
  }
}

export function createProductionBuildingPopupRuntime(deps = {}) {
  const selectors = deps.selectors || {};
  const ButtonCtor = deps.HTMLButtonElement || (typeof HTMLButtonElement !== "undefined" ? HTMLButtonElement : null);
  const documentRef = deps.documentRef || (typeof document !== "undefined" ? document : null);
  const maxLevel = Number(deps.maxLevel || 14);
  const isServerAuthoritativeProductionReady = () => deps.isServerAuthoritativeGameplayRuntimeReady?.() === true;
  const isLegacyLocalProductionEnabled = () => resolveBooleanPolicy(
    deps.allowLegacyLocalProduction
  ) && !isServerAuthoritativeProductionReady();
  const shouldUseServerProduction = () => !isLegacyLocalProductionEnabled();
  const isLegacyLocalProductionUpgradeEnabled = () => resolveBooleanPolicy(
    deps.allowLegacyProductionUpgrade
  ) && !isServerAuthoritativeProductionReady();
  const productionBridgeMessage = "Výroba je v tomto režimu nedostupná.";
  const productionUpgradeMessage = "Serverový upgrade se provádí přes konkrétní kartu budovy v districtu.";
  const popupOpenersByRoot = new WeakMap();
  const baseOwnedCount = Math.max(1, Math.floor(Number(deps.baseOwnedProductionBuildingCount || 1)));
  const getServerLines = (production) => Array.isArray(production?.productionLines)
    ? production.productionLines
    : Array.isArray(production?.lines)
      ? production.lines
      : [];

  const serverProductionStatusLabels = Object.freeze({
    ready: "Připraveno",
    processing: "Výroba",
    waiting: "Čeká",
    full: "Plná kapacita",
    over_capacity: "Překročená kapacita",
    completed: "Hotovo"
  });

  const getServerProductionRecipe = (buildingName, recipes, line) => {
    const configuredRecipe = recipes?.[line.recipeId] || {};
    const inputAvailability = Array.isArray(line.inputAvailability) ? line.inputAvailability : [];
    const inputs = Object.fromEntries(inputAvailability.map((input) => [
      input.resourceKey,
      Math.max(0, Number(input.requiredPerUnit ?? input.requiredAmount ?? 0))
    ]));
    const tickRateMs = Math.max(1, Number(deps.getServerTickRateMs?.() || FREE_GAMEPLAY_TICK_MS));
    const effectiveDurationMs = Math.max(1000, Number(line.effectiveUnitDurationTicks || 0) * tickRateMs);
    const outputInventory = configuredRecipe.output?.inventory
      || (buildingName === "pharmacy" ? "materials" : buildingName === "armory" ? "weapons" : "drugs");
    return {
      ...configuredRecipe,
      name: String(line.label || configuredRecipe.name || ""),
      inputs,
      cleanMoneyCost: Math.max(0, Number(line.unitCleanCashCost || 0)),
      durationMs: effectiveDurationMs,
      localOutputCap: Math.max(0, Number(line.producedCapacity || 0)),
      queueCap: Math.max(0, Number(line.queueCapacity || 0)),
      output: {
        ...configuredRecipe.output,
        inventory: outputInventory,
        itemId: String(line.resourceKey || configuredRecipe.output?.itemId || line.recipeId || ""),
        amount: 1
      }
    };
  };

  const getServerProductionRecipeViewModel = (root, buildingName, building, line, recipes) => {
    const recipe = getServerProductionRecipe(buildingName, recipes, line);
    const tickRateMs = Math.max(1, Number(deps.getServerTickRateMs?.() || FREE_GAMEPLAY_TICK_MS));
    const effectiveDurationMs = Math.max(1000, Number(line.effectiveUnitDurationTicks || 0) * tickRateMs);
    const isProducing = Number(line.activeAmount || 0) > 0 || line.status === "processing";
    const remainingMs = Math.max(0, Number(line.remainingMs || 0));
    const inputAmounts = Object.fromEntries((Array.isArray(line.inputAvailability) ? line.inputAvailability : []).map((input) => [
      input.resourceKey,
      Math.max(0, Number(input.playerStoredAmount ?? input.availableAmount ?? 0))
    ]));
    const maxStartQuantity = Math.max(0, Math.floor(Number(line.maxStartQuantity || 0)));
    return {
      root,
      districtId: String(building.districtId || ""),
      buildingId: String(building.buildingId || ""),
      buildingName,
      recipeId: String(line.recipeId || ""),
      recipe,
      job: {
        status: isProducing ? "running" : "ready",
        isProducing,
        activeAmount: Math.max(0, Number(line.activeAmount || 0)),
        waitingAmount: Math.max(0, Number(line.waitingAmount || 0)),
        queuedAmount: Math.max(0, Number(line.queuedAmount || 0)),
        producedAmount: Math.max(0, Number(line.producedAmount || 0)),
        durationMs: effectiveDurationMs,
        readyAtMs: isProducing ? Date.now() + remainingMs : null,
        output: recipe.output
      },
      effectiveDurationMs,
      slotState: {
        label: serverProductionStatusLabels[line.status] || "Připraveno",
        isActive: line.status !== "ready"
      },
      outputInventoryAmount: Math.max(0, Number(line.playerStoredAmount || 0)),
      outputInventoryCapacity: Math.max(0, Number(line.playerStoredCapacity || 0)),
      outputCap: Math.max(0, Number(line.producedCapacity || 0)),
      queueCap: Math.max(0, Number(line.queueCapacity || 0)),
      visual: deps.PRODUCTION_SLOT_VISUALS?.[buildingName]?.[line.recipeId] || null,
      armoryStrengthPreview: buildingName === "armory"
        ? deps.getArmoryRecipeStrengthPreview?.(line.recipeId, recipe) || null
        : null,
      inputAmounts,
      canStart: line.canStart === true,
      canCancelWaiting: line.canCancelWaiting === true,
      disabledReason: line.disabledReason || null,
      maxBatches: maxStartQuantity,
      maxSelectableBatches: maxStartQuantity,
      allowStartWithMissingInputs: false
    };
  };

  const createServerLoadingCard = (mount, label) => {
    const card = documentRef?.createElement?.("article");
    if (!card) {
      return null;
    }
    card.className = "production-recipe-card production-recipe-card--loading buildings-popup__empty";
    card.setAttribute("role", "status");
    card.setAttribute("aria-live", "polite");
    card.textContent = `Načítám stav budovy ${label || ""}…`.replace(/\s+…/u, "…");
    return card;
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

  const getProductionOutputCap = (buildingName, recipe = {}) => {
    const recipeCap = Math.max(0, Math.floor(Number(recipe?.localOutputCap || 0)));
    if (recipeCap > 0) {
      return recipeCap;
    }
    return 0;
  };

  const getProductionQueueCap = (buildingName, ownedBuildingCount = baseOwnedCount, recipe = {}) => {
    const recipeCap = Math.max(0, Math.floor(Number(recipe?.queueCap || 0)));
    if (recipeCap > 0) {
      return recipeCap;
    }
    return 0;
  };

  const getProductionSlotState = (job) => {
    if (!job) {
      return { label: "Připraveno", isActive: false };
    }

    if (Number(job.producedAmount || 0) > Number(job.localOutputCap || 0)) {
      return { label: "Překročená kapacita", isActive: true };
    }
    if (Number(job.producedAmount || 0) === Number(job.localOutputCap || 0) && Number(job.localOutputCap || 0) > 0) {
      return { label: "Plná kapacita", isActive: true };
    }
    if (job.status === "running" || job.isProducing) {
      return { label: "Výroba", isActive: true };
    }
    if (Number(job.queuedAmount || 0) > 0) {
      return { label: "Čeká", isActive: true };
    }
    if (Number(job.producedAmount || 0) > 0) {
      return { label: "Hotovo", isActive: true };
    }
    if (job.status === "ready") {
      return { label: "Hotovo", isActive: true };
    }
    return { label: "Připraveno", isActive: false };
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
    const legacyProductionEnabled = isLegacyLocalProductionEnabled();
    const buildingState = deps.getStoredProductionBuildingState?.(buildingName) || {};
    const ownedBuildingCount = getOwnedProductionBuildingCount(buildingName, buildingState.level);
    const durationMultiplier = deps.getProductionBuildingMultiplier?.(buildingName, buildingState.level) || 1;
    const productionBoost = deps.getPlayerProductionBoostSnapshot?.() || { multiplier: 1, expiresAtMs: null };
    const baseEffectiveDurationMs = Math.max(1000, Math.round(Number(recipe?.durationMs || 0) / durationMultiplier));
    const effectiveDurationMs = Math.max(1000, Math.round(baseEffectiveDurationMs / Math.max(1, Number(productionBoost.multiplier || 1))));
    const durationReductionPct = Math.max(0, Math.round((1 - effectiveDurationMs / baseEffectiveDurationMs) * 100));
    const outputUnitAmount = buildingName === "pharmacy" || buildingName === "armory"
      ? 1
      : Math.max(1, Math.floor(Number(recipe?.output?.amount || 1)));
    const outputCap = getProductionOutputCap(buildingName, recipe);
    const queueCap = getProductionQueueCap(buildingName, ownedBuildingCount, recipe);
    const jobDefaults = {
      unitDurationMs: baseEffectiveDurationMs,
      localOutputCap: outputCap || 99,
      queueCapacity: queueCap || 99,
      unitCleanMoneyCost: Math.max(0, Number(recipe?.cleanMoneyCost || 0)),
      unitInputs: recipe?.inputs || {},
      output: recipe?.output
    };
    const job = normalizeLocalProductionJob(deps.getProductionJob?.(recipeKey), jobDefaults);
    const getRemainingQueueSpace = (productionJob = null) => {
      if (queueCap <= 0) {
        return Number.POSITIVE_INFINITY;
      }
      const queuedAmount = Math.max(0, Math.floor(Number(productionJob?.queuedAmount || 0)));
      return Math.max(0, queueCap - queuedAmount);
    };
    const getCurrentJob = () => normalizeLocalProductionJob(deps.getProductionJob?.(recipeKey), jobDefaults);
    const inputAmounts = Object.fromEntries(
      Object.keys(recipe?.inputs || {}).map((itemId) => [itemId, deps.getInventoryAmount?.("materials", itemId) || 0])
    );
    const getMaxCapacityBatches = () => {
      const current = getCurrentJob();
      if (current && outputCap > 0 && current.producedAmount >= outputCap) return 0;
      return Math.min(
        99,
        queueCap > 0 ? Math.floor(getRemainingQueueSpace(current) / outputUnitAmount) : 99
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
    const maxBatches = legacyProductionEnabled ? getMaxBatches() : 0;
    const viewModel = {
      root,
      buildingName,
      recipeId,
      recipeKey,
      recipe,
      job,
      effectiveDurationMs,
      durationBonusLabel: durationReductionPct > 0 ? `−${durationReductionPct} %` : "",
      slotState: getProductionSlotState(job),
      outputInventoryAmount: deps.getInventoryAmount?.(recipe?.output?.inventory, recipe?.output?.itemId) || 0,
      outputInventoryCapacity: deps.getInventoryCapacity?.(recipe?.output?.itemId) || 0,
      outputCap,
      queueCap,
      visual: deps.PRODUCTION_SLOT_VISUALS?.[buildingName]?.[recipeId] || null,
      armoryStrengthPreview: buildingName === "armory"
        ? deps.getArmoryRecipeStrengthPreview?.(recipeId, recipe) || null
        : null,
      inputAmounts,
      canStart: legacyProductionEnabled
        && maxBatches > 0
        && (deps.hasEnoughMaterials?.(recipe?.inputs || {}) || false),
      maxBatches,
      maxSelectableBatches: maxBatches,
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
        const currentJob = getCurrentJob();

        const maxBatches = Math.max(0, Math.floor(Number(getMaxBatches() || 0)));
        const requestedBatchCount = Math.max(1, Math.floor(Number(batchCount || 1)));
        if (requestedBatchCount > maxBatches) {
          const queueSpace = Math.max(0, Math.floor(Number(getRemainingQueueSpace(currentJob) || 0)));
          const message = queueCap > 0 && requestedBatchCount * outputUnitAmount > queueSpace
            ? "Výrobní fronta je plná nebo v ní není místo pro celé zvolené množství."
            : "Chybí materiál nebo clean cash pro celé zvolené množství.";
          deps.setBuildingActionFeedback?.(
            root,
            "warning",
            deps.PRODUCTION_BUILDING_CONFIG?.[buildingName]?.label || "Budova",
            message
          );
          rerender?.();
          return;
        }
        const safeBatchCount = requestedBatchCount;

        const requiredInputs = deps.getScaledProductionInputs?.(recipe?.inputs || {}, safeBatchCount) || {};
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

        const remainingQueueSpace = getRemainingQueueSpace(currentJob);
        const outputAmount = outputUnitAmount * safeBatchCount;
        if (outputAmount <= 0 || outputAmount > remainingQueueSpace || (currentJob && outputCap > 0 && currentJob.producedAmount >= outputCap)) {
          deps.setBuildingActionFeedback?.(
            root,
            "warning",
            deps.PRODUCTION_BUILDING_CONFIG?.[buildingName]?.label || "Budova",
            "Výrobní fronta je plná nebo v ní není místo pro celé zvolené množství."
          );
          rerender?.();
          return;
        }
        deps.consumeMaterials?.(requiredInputs);
        if (cleanCost > 0) deps.setStoredEconomyState?.({ ...economyState, cleanMoney: economyState.cleanMoney - cleanCost });
        const queued = queueLocalProduction(currentJob, {
          ...jobDefaults,
          quantity: safeBatchCount,
          now: Date.now(),
          productionSpeedMultiplier: productionBoost.multiplier,
          productionSpeedExpiresAtMs: productionBoost.expiresAtMs,
          unitCleanMoneyCost: Math.max(0, Number(recipe?.cleanMoneyCost || 0)),
          unitInputs: recipe?.inputs || {}
        });
        if (!queued.ok) {
          // This guard can only be reached after a concurrent local update. Restore the debit.
          for (const [itemId, amount] of Object.entries(requiredInputs)) {
            deps.setInventoryAmount?.("materials", itemId, Number(deps.getInventoryAmount?.("materials", itemId) || 0) + Number(amount || 0));
          }
          if (cleanCost > 0) deps.setStoredEconomyState?.({ ...economyState });
          rerender?.();
          return;
        }
        deps.persistProductionJob?.(recipeKey, queued.job);
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
        const currentJob = getCurrentJob();
        const cancelled = cancelWaitingLocalProduction(currentJob);
        if (!cancelled.ok) return rerender?.();
        for (const [itemId, amount] of Object.entries(cancelled.refund.inputs)) {
          const refundAmount = Math.max(0, Number(amount || 0));
          if (refundAmount > 0) {
            deps.setInventoryAmount?.("materials", itemId, Number(deps.getInventoryAmount?.("materials", itemId) || 0) + refundAmount);
          }
        }

        const cleanRefund = Math.max(0, Number(cancelled.refund.cleanMoney || 0));
        if (cleanRefund > 0) {
          const economyState = deps.getResolvedEconomyState?.() || {};
          deps.setStoredEconomyState?.({
            ...economyState,
            cleanMoney: Number(economyState.cleanMoney || 0) + cleanRefund
          });
          deps.applyTopbarEconomy?.(root);
        }
        deps.persistProductionJob?.(recipeKey, cancelled.job);
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
        const normalizedJob = normalizeLocalProductionJob(currentJob, jobDefaults);
        if (!normalizedJob || normalizedJob.producedAmount <= 0) return rerender?.();
        const receivableAmount = deps.getReceivableInventoryOutputAmount?.(
          normalizedJob.output,
          normalizedJob.producedAmount
        ) ?? normalizedJob.producedAmount;
        const collected = collectLocalProduction(normalizedJob, receivableAmount, Date.now(), {
          productionSpeedMultiplier: productionBoost.multiplier,
          productionSpeedExpiresAtMs: productionBoost.expiresAtMs
        });
        if (collected.collectedAmount <= 0) {
          deps.setBuildingActionFeedback?.(
            root,
            "warning",
            deps.PRODUCTION_BUILDING_CONFIG?.[buildingName]?.label || "Budova",
            "Ve SKLADU není pro tento produkt dost místa."
          );
          rerender?.();
          return;
        }
        deps.applyInventoryOutput?.({ ...normalizedJob.output, amount: collected.collectedAmount });
        if (collected.job?.queuedAmount > 0 || collected.job?.producedAmount > 0) {
          deps.persistProductionJob?.(recipeKey, collected.job);
          if (collected.job.isProducing) {
            deps.scheduleProductionJob?.(recipeKey, rerender);
          }
        } else {
          deps.clearProductionJob?.(recipeKey);
        }
        deps.appendBuildingActionResultEntry?.(root, "police", deps.createStorageCollectResultPayload?.({
          buildingLabel: deps.PRODUCTION_BUILDING_CONFIG?.[buildingName]?.label || "Budova",
          hideBadge: buildingName === "pharmacy",
          items: [{
            label: deps.getProductionResourceLabel?.(currentJob.output?.itemId),
            amount: collected.collectedAmount
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

  const createServerPharmacyCard = (root, pharmacy, line, recipes, rerender) => {
    return deps.renderRecipeCard?.(getServerProductionRecipeViewModel(root, "pharmacy", pharmacy, line, recipes), {
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
      formatDurationLabel: deps.formatDurationLabel,
      getResourceLabel: deps.getProductionResourceLabel,
      normalizeResourceColorKey: deps.normalizeProductionResourceColorKey
    });
  };

  const createServerDrugLabCard = (root, drugLab, line, recipes, rerender) => {
    return deps.renderRecipeCard?.(getServerProductionRecipeViewModel(root, "druglab", drugLab, line, recipes), {
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
      formatDurationLabel: deps.formatDurationLabel,
      getResourceLabel: deps.getProductionResourceLabel,
      normalizeResourceColorKey: deps.normalizeProductionResourceColorKey
    });
  };

  const createServerArmoryCard = (root, armory, line, recipes, rerender) => {
    return deps.renderRecipeCard?.(getServerProductionRecipeViewModel(root, "armory", armory, line, recipes), {
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
      formatDurationLabel: deps.formatDurationLabel,
      getResourceLabel: deps.getProductionResourceLabel,
      normalizeResourceColorKey: deps.normalizeProductionResourceColorKey
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

    const serverPharmacy = panelName === "pharmacy" && shouldUseServerProduction()
      ? deps.getServerPharmacyReadModel?.()
      : null;
    const serverDrugLab = panelName === "druglab" && shouldUseServerProduction()
      ? deps.getServerDrugLabReadModel?.()
      : null;
    const serverArmory = panelName === "armory" && shouldUseServerProduction()
      ? deps.getServerArmoryReadModel?.()
      : null;
    const serverProduction = serverPharmacy || serverDrugLab || serverArmory;
    if (serverProduction) {
      const safeRerender = typeof rerender === "function" ? rerender : () => renderProductionPanel(root, panelName, recipes);
      return deps.renderProductionPanelUi?.({
        mount,
        recipes: getServerLines(serverProduction).map((line) => ({
          prebuiltCard: serverArmory
            ? createServerArmoryCard(root, serverArmory, line, recipes, safeRerender)
            : serverDrugLab
            ? createServerDrugLabCard(root, serverDrugLab, line, recipes, safeRerender)
            : createServerPharmacyCard(root, serverPharmacy, line, recipes, safeRerender)
        }))
      }, {}, {
        mount,
        presentationScopeKey: `${panelName}:${serverProduction.districtId || "district"}:${serverProduction.buildingId || "server"}`
      });
    }
    if (shouldUseServerProduction()) {
      const label = deps.PRODUCTION_BUILDING_CONFIG?.[panelName]?.label || "budovy";
      const loadingCard = createServerLoadingCard(mount, label);
      return deps.renderProductionPanelUi?.({
        mount,
        recipes: loadingCard ? [{ prebuiltCard: loadingCard }] : []
      }, {}, { mount, presentationScopeKey: `${panelName}:server-loading` });
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
    }, {}, { mount, presentationScopeKey: `${panelName}:local-demo` });
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
    popup.dataset.uiOwner = "legacy-shared";

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
      const serverPharmacy = buildingName === "pharmacy" && shouldUseServerProduction()
        ? deps.getServerPharmacyReadModel?.()
        : null;
      const serverDrugLab = buildingName === "druglab" && shouldUseServerProduction()
        ? deps.getServerDrugLabReadModel?.()
        : null;
      const serverArmory = buildingName === "armory" && shouldUseServerProduction()
        ? deps.getServerArmoryReadModel?.()
        : null;
      const serverProduction = serverPharmacy || serverDrugLab || serverArmory;
      const serverLoading = shouldUseServerProduction() && !serverProduction;
      popup.dataset.executionMode = shouldUseServerProduction()
        ? "server-authoritative"
        : "local-demo";
      if (serverProduction) {
        popup.dataset.serverDistrictId = String(serverProduction.districtId || "");
        popup.dataset.serverBuildingId = String(serverProduction.buildingId || "");
        popup.dataset.serverBuildingTypeId = buildingName === "druglab" ? "drug_lab" : buildingName;
      } else {
        delete popup.dataset.serverDistrictId;
        delete popup.dataset.serverBuildingId;
        delete popup.dataset.serverBuildingTypeId;
      }
      if (isLegacyLocalProductionEnabled()) {
        deps.syncCompletedProductionJobs?.();
      }
      const state = serverProduction
        ? { level: serverProduction.level || 1 }
        : serverLoading
          ? { level: 1 }
          : deps.getStoredProductionBuildingState?.(buildingName) || {};
      const multiplier = deps.getProductionBuildingMultiplier?.(buildingName, state.level) || 1;
      const nextMultiplier = state.level < maxLevel
        ? deps.getProductionBuildingMultiplier?.(buildingName, state.level + 1) || multiplier
        : multiplier;
      const readyCount = serverProduction
        ? getServerLines(serverProduction).filter((line) => line.canCollect === true).length
        : deps.getProductionBuildingReadyCount?.(buildingName, recipes) || 0;
      const upgradeCost = state.level < maxLevel ? deps.getProductionBuildingUpgradeCost?.(buildingName, state.level + 1) || 0 : 0;
      const ownedBuildingCount = getOwnedProductionBuildingCount(buildingName, state.level);
      const speedGainPct = Math.max(0, Math.round((Number(nextMultiplier || multiplier || 1) - Number(multiplier || 1)) * 100));
      const upgradeBenefitLabel = state.level < maxLevel
        ? `+${speedGainPct}% rychlost · celkem ${formatProductionSpeedBonus(nextMultiplier || multiplier || 1)}`
        : "Maximální level";

      setElementPropertyIfChanged(levelElement, "textContent", serverLoading ? "—" : String(ownedBuildingCount));
      setElementPropertyIfChanged(headerLevelElement, "textContent", serverLoading ? "Lv —" : `Lv ${state.level}`);
      setElementPropertyIfChanged(multiplierElement, "textContent", serverLoading ? "—" : formatProductionSpeedBonus(multiplier));
      setElementPropertyIfChanged(readyElement, "textContent", serverLoading ? "—" : `${readyCount}/${Object.keys(recipes || {}).length}`);
      setElementPropertyIfChanged(upgradeCostElement, "textContent", serverLoading
        ? "—"
        : state.level < maxLevel ? deps.formatCurrency?.(upgradeCost) : "MAX");
      setElementPropertyIfChanged(infoUpgradeCostElement, "textContent", serverLoading
        ? "—"
        : state.level < maxLevel ? deps.formatCurrency?.(upgradeCost) : "MAX");
      setElementPropertyIfChanged(
        infoUpgradeBenefitElement,
        "textContent",
        serverLoading ? "Načítám stav budovy…" : upgradeBenefitLabel
      );
      setElementPropertyIfChanged(effectsElement, "textContent", serverLoading
        ? "Načítám stav budovy…"
        : deps.getProductionBuildingEffectsLabel?.(buildingName, state.level));

      if (serverLoading) {
        setElementPropertyIfChanged(infoTextElement, "textContent", "Načítám stav budovy…");
        if (infoEffectsElement) infoEffectsElement.replaceChildren?.();
        if (infoActionsElement) infoActionsElement.replaceChildren?.();
      } else {
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
      }

      if (isButtonElement(collectButton, ButtonCtor)) {
        const collectDisabled = serverLoading
          || (serverProduction ? readyCount <= 0 : !isLegacyLocalProductionEnabled() || readyCount <= 0);
        const collectLabel = serverLoading
          ? "Načítám stav budovy…"
          : !serverProduction && !isLegacyLocalProductionEnabled()
          ? productionBridgeMessage
          : readyCount > 0
          ? `Vybrat hotové do skladu (${readyCount})`
          : "Vybrat hotové do skladu";
        setElementPropertyIfChanged(collectButton, "disabled", collectDisabled);
        setElementPropertyIfChanged(collectButton, "textContent", "+");
        setElementPropertyIfChanged(collectButton, "title", collectLabel);
        setElementAttributeIfChanged(collectButton, "aria-label", collectLabel);
      }

      if (isButtonElement(upgradeButton, ButtonCtor)) {
        const hasNextUpgrade = state.level < maxLevel;
        const upgradeDisabled = serverLoading
          || !hasNextUpgrade
          || (isLegacyLocalProductionUpgradeEnabled() && state.level >= maxLevel);
        const upgradeLabel = serverLoading
          ? "Načítám stav budovy…"
          : serverProduction
          ? `Upgrade budovy (${deps.formatCurrency?.(upgradeCost)})`
          : !isLegacyLocalProductionUpgradeEnabled()
          ? productionUpgradeMessage
          : !hasNextUpgrade
          ? "Max level"
          : `Upgrade budovy (${deps.formatCurrency?.(upgradeCost)})`;
        setElementPropertyIfChanged(upgradeButton, "hidden", !hasNextUpgrade);
        setElementStylePropertyIfChanged(upgradeButton, "display", hasNextUpgrade ? "" : "none");
        setElementPropertyIfChanged(upgradeButton, "disabled", upgradeDisabled);
        setElementPropertyIfChanged(upgradeButton, "textContent", "⇪");
        setElementPropertyIfChanged(upgradeButton, "title", upgradeLabel);
        setElementAttributeIfChanged(upgradeButton, "aria-label", upgradeLabel);
      }

      renderProductionPanel(root, buildingName, recipes, renderDashboard);
    };

    documentRef?.addEventListener?.("empire:gameplay-slice-rendered", () => {
      if (!isLegacyLocalProductionEnabled() && !popup.hidden) {
        renderDashboard();
      }
    });

    documentRef?.addEventListener?.("empire:production-state-change", () => {
      if (isLegacyLocalProductionEnabled() && !popup.hidden) {
        renderDashboard();
      }
    });

    for (const button of tabButtons) {
      button.addEventListener("click", () => {
        const tabName = String(button.dataset.productionBuildingTab || "").split(":")[1] || "stats";
        setActiveTab(tabName);
      });
    }

    if (isButtonElement(collectButton, ButtonCtor)) {
      collectButton.addEventListener("click", async () => {
        const serverPharmacy = buildingName === "pharmacy" && shouldUseServerProduction()
          ? deps.getServerPharmacyReadModel?.()
          : null;
        const serverDrugLab = buildingName === "druglab" && shouldUseServerProduction()
          ? deps.getServerDrugLabReadModel?.()
          : null;
        const serverArmory = buildingName === "armory" && shouldUseServerProduction()
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
        if (!isLegacyLocalProductionEnabled()) {
          deps.setBuildingActionFeedback?.(root, "warning", config?.label || "Budova", productionBridgeMessage);
          renderDashboard();
          return;
        }
        const collected = deps.collectReadyProductionForBuilding?.(buildingName, recipes) || { total: 0, items: [] };
        renderDashboard();

        if (collected.total <= 0) {
          deps.setBuildingActionFeedback?.(
            root,
            "warning",
            config?.label || "Budova",
            collected.remaining > 0 ? "Ve SKLADU není dost místa." : "Není nic hotového k vyzvednutí."
          );
          return;
        }

        deps.setBuildingActionFeedback?.(
          root,
          collected.partial ? "warning" : "success",
          config?.label || "Budova",
          collected.partial
            ? `Do SKLADU se vešla pouze část produkce. Zbytek zůstal v ${buildingName === "druglab" ? "Labu" : buildingName === "armory" ? "Zbrojovce" : "Lékárně"}.`
            : "Hotová produkce byla přesunuta do SKLADU."
        );

        deps.appendBuildingActionResultEntry?.(root, "police", deps.createStorageCollectResultPayload?.({
          buildingLabel: config?.label || "Budova",
          hideBadge: buildingName === "pharmacy",
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
        const serverPharmacy = buildingName === "pharmacy" && shouldUseServerProduction()
          ? deps.getServerPharmacyReadModel?.()
          : null;
        const serverDrugLab = buildingName === "druglab" && shouldUseServerProduction()
          ? deps.getServerDrugLabReadModel?.()
          : null;
        const serverArmory = buildingName === "armory" && shouldUseServerProduction()
          ? deps.getServerArmoryReadModel?.()
          : null;
        const serverProduction = serverPharmacy || serverDrugLab || serverArmory;
        if (!serverProduction && !isLegacyLocalProductionUpgradeEnabled()) {
          deps.setBuildingActionFeedback?.(root, "warning", config?.label || "Budova", productionUpgradeMessage);
          renderDashboard();
          return;
        }
        const currentState = serverProduction
          ? { level: Math.max(1, Number(serverProduction.level || 1)) }
          : deps.getStoredProductionBuildingState?.(buildingName) || {};

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
          confirmLabel: "Potvrdit upgrade",
          costLabel: deps.formatCurrency?.(upgradeCost) || String(upgradeCost),
          noteLabel: hasEnoughMoney
            ? `Po potvrzení zaplatíš ${deps.formatCurrency?.(upgradeCost) || upgradeCost} clean cash.`
            : `Chybí ${deps.formatCurrency?.(upgradeCost - Number(economyState.cleanMoney || 0)) || (upgradeCost - Number(economyState.cleanMoney || 0))} clean cash.`,
          titleLabel: config?.label || "Budova",
          upgradeLabel: `L${currentState.level} → L${nextLevel}`
        });

        if (!confirmed) {
          return;
        }

        if (serverProduction) {
          upgradeButton.disabled = true;
          try {
            const response = await deps.submitServerProductionBuildingUpgrade?.({
              districtId: serverProduction.districtId,
              buildingId: serverProduction.buildingId
            });
            const error = response?.errors?.[0];
            deps.setBuildingActionFeedback?.(
              root,
              response?.accepted && !error ? "success" : "warning",
              config?.label || "Budova",
              error?.message || (response?.accepted
                ? `${config?.label || "Budova"} byla upgradovaná.`
                : "Upgrade se nepodařilo potvrdit.")
            );
          } catch {
            deps.setBuildingActionFeedback?.(
              root,
              "warning",
              config?.label || "Budova",
              "Upgrade se nepodařilo bezpečně odeslat."
            );
          } finally {
            renderDashboard();
          }
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

    const openPopup = async (request = null) => {
      const shouldPrepareServerBuilding = shouldUseServerProduction()
        && typeof deps.prepareServerProductionBuilding === "function";
      let preparedServerBuilding = null;
      const wasDisabled = openButton.disabled;
      if (shouldPrepareServerBuilding) {
        openButton.disabled = true;
        openButton.setAttribute?.("aria-busy", "true");
      }
      try {
        if (shouldPrepareServerBuilding) {
          preparedServerBuilding = request?.serverTarget
            ? await deps.prepareServerProductionBuilding(buildingName, {
                serverTarget: request.serverTarget
              })
            : await deps.prepareServerProductionBuilding(buildingName);
          if (preparedServerBuilding?.accepted !== true) {
            deps.setBuildingActionFeedback?.(
              root,
              "warning",
              config?.label || "Budova",
              preparedServerBuilding?.errors?.[0]?.message || "Serverovou budovu se nepodařilo načíst."
            );
            return false;
          }
        }
        setActiveTab("stats");
        renderDashboard();
        openOverlay(popup, { type: "modal", ariaModal: true, restoreFocusOnClose: false });
        popup.hidden = false;
        deps.syncBuildingDetailTopbarVisibility?.(root);
        return true;
      } finally {
        if (shouldPrepareServerBuilding) {
          openButton.disabled = wasDisabled;
          openButton.removeAttribute?.("aria-busy");
        }
      }
    };

    const closePopup = () => {
      upgradeConfirmation.close?.();
      popup.hidden = true;
      closeOverlay(popup, { restoreFocus: false });
      deps.syncBuildingDetailTopbarVisibility?.(root);
    };

    const popupOpeners = popupOpenersByRoot.get(root) || new Map();
    popupOpeners.set(buildingName, openPopup);
    popupOpenersByRoot.set(root, popupOpeners);
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

  const openProductionBuildingPopup = (root, buildingName, request = null) => {
    const opener = popupOpenersByRoot.get(root)?.get(String(buildingName || "").trim());
    return typeof opener === "function" ? opener(request) : null;
  };

  const clearProductionBuildingPopupOpeners = (root) => {
    if (!root) {
      return false;
    }
    return popupOpenersByRoot.delete(root);
  };

  return {
    bindArmoryPopup,
    bindDrugLabPopup,
    bindPharmacyPopup,
    bindProductionBuildingPopup,
    clearProductionBuildingPopupOpeners,
    createProductionCard,
    createServerArmoryCard,
    createServerPharmacyCard,
    getProductionSlotState,
    openProductionBuildingPopup,
    renderProductionBuildingInfo,
    renderProductionPanel
  };
}

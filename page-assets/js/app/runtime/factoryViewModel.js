function getFactorySlotPerHour(slot = {}, rates = {}) {
  if (slot.resourceKey === "metalParts") return rates.metalPartsPerHour;
  if (slot.resourceKey === "techCore") return rates.techCorePerHour;
  return rates.combatModulePerHour;
}

function formatFactorySpeedBonus(multiplier = 1) {
  const safeMultiplier = Number(multiplier);
  if (!Number.isFinite(safeMultiplier)) {
    return "+0%";
  }
  const pct = Math.round((safeMultiplier - 1) * 100);
  return `${pct >= 0 ? "+" : ""}${pct}%`;
}

const FACTORY_LEGACY_KEY_BY_CANONICAL_KEY = Object.freeze({
  "metal-parts": "metalParts",
  "tech-core": "techCore",
  "combat-module": "combatModule"
});

const FACTORY_CANONICAL_KEY_BY_LEGACY_KEY = Object.freeze({
  metalParts: "metal-parts",
  techCore: "tech-core",
  combatModule: "combat-module"
});

function getFactoryRecipe(slot = {}, config = {}) {
  const recipeId = slot.recipeId || FACTORY_CANONICAL_KEY_BY_LEGACY_KEY[slot.resourceKey] || slot.resourceKey;
  return config.recipes?.[recipeId] || null;
}

function getFactorySlotDisplayInfo(slot = {}, config = {}) {
  const recipe = getFactoryRecipe(slot, config) || {};
  const inputs = recipe.inputs || {};
  const displayCost = {
    cleanCash: Math.max(0, Math.floor(Number(recipe.cleanMoneyCost || 0))),
    metalParts: Math.max(0, Math.floor(Number(inputs["metal-parts"] || 0))),
    techCore: Math.max(0, Math.floor(Number(inputs["tech-core"] || 0)))
  };
  const priceParts = [
    displayCost.cleanCash > 0 ? `$${displayCost.cleanCash} clean` : "",
    displayCost.metalParts > 0 ? `${displayCost.metalParts}× Metal Parts` : "",
    displayCost.techCore > 0 ? `${displayCost.techCore}× Tech Core` : ""
  ].filter(Boolean);
  return {
    displayCost,
    priceLabel: priceParts.join(" · ") || "bez ceny",
    primaryLine: priceParts.join(" · ") || "bez ceny",
    secondaryLine: "",
    storageCap: Math.max(1, Math.floor(Number(recipe.localOutputCap || slot.slotCap || 1))),
    recipe
  };
}

function formatFactoryReadyLabel(amount, resourceKey, capOverride = null) {
  const cap = Math.max(0, Math.floor(Number(capOverride || 0)));
  const safeAmount = Math.max(0, Math.floor(Number(amount || 0)));
  return cap > 0 ? `${safeAmount}/${cap}` : String(safeAmount);
}

function getFactoryReadyResourceTotals(slots = []) {
  return (Array.isArray(slots) ? slots : []).reduce((totals, slot) => {
    const key = String(slot?.resourceKey || "").trim();
    if (!key) return totals;
    totals[key] = Math.max(0, Math.floor(Number(totals[key] || 0) + Number(slot?.producedAmount || 0)));
    return totals;
  }, {});
}

function getFactorySlotVisual(slot = {}, config = {}, formatDurationLabel = (value) => `${value}ms`) {
  const displayInfo = getFactorySlotDisplayInfo(slot, config);
  if (slot.resourceKey === "metalParts") {
    return {
      iconToneClass: "drug-production-slot__icon--amber",
      iconGlyphClass: "drug-production-slot__icon--crate",
      typeLabel: "",
      profileLabel: "Profil",
      primaryLine: displayInfo.primaryLine,
      secondaryLine: displayInfo.secondaryLine
    };
  }

  if (slot.resourceKey === "techCore") {
    return {
      iconToneClass: "drug-production-slot__icon--cyan",
      iconGlyphClass: "drug-production-slot__icon--chip",
      typeLabel: "",
      profileLabel: "Profil",
      primaryLine: displayInfo.primaryLine,
      secondaryLine: displayInfo.secondaryLine
    };
  }

  return {
    iconToneClass: "drug-production-slot__icon--red",
    iconGlyphClass: "drug-production-slot__icon--crosshair",
    typeLabel: "",
    profileLabel: "Recept",
    primaryLine: displayInfo.primaryLine,
    secondaryLine: displayInfo.secondaryLine || `${formatDurationLabel(getFactorySlotDurationMs(slot, config))} / kus`
  };
}

function getFactorySlotPriceLabel(slot = {}, config = {}) {
  return getFactorySlotDisplayInfo(slot, config).priceLabel || "bez ceny";
}

function getFactorySlotDurationMs(slot = {}, config = {}) {
  const configuredDuration = Number(config.slotDurationMs?.[slot.resourceKey]);
  if (Number.isFinite(configuredDuration) && configuredDuration > 0) {
    return configuredDuration;
  }
  return (
    slot.resourceKey === "metalParts"
      ? 4 * 60 * 1000
      : slot.resourceKey === "techCore"
        ? 8 * 60 * 1000
        : 15 * 60 * 1000
  );
}

function getEffectiveFactorySlotDurationMs(slot = {}, config = {}, productionMultiplier = 1) {
  return Math.max(1000, Math.round(getFactorySlotDurationMs(slot, config) / Math.max(0.1, Number(productionMultiplier) || 1)));
}

function formatFactoryDurationBonus(baseDurationMs = 0, effectiveDurationMs = 0) {
  const reductionPct = Math.max(0, Math.round((1 - Number(effectiveDurationMs || 0) / Math.max(1, Number(baseDurationMs || 0))) * 100));
  return reductionPct > 0 ? `−${reductionPct} %` : "";
}

function resolveFactoryLineSpeedMultiplier(line = {}) {
  const projectedMultiplier = Number(line.effectiveSpeedMultiplier);
  if (Number.isFinite(projectedMultiplier) && projectedMultiplier > 0) {
    return projectedMultiplier;
  }
  const baseDurationTicks = Number(line.baseUnitDurationTicks);
  const effectiveDurationTicks = Number(line.effectiveUnitDurationTicks);
  return Number.isFinite(baseDurationTicks) && baseDurationTicks > 0
    && Number.isFinite(effectiveDurationTicks) && effectiveDurationTicks > 0
    ? baseDurationTicks / effectiveDurationTicks
    : null;
}

function resolveFactoryLineUnitsPerHour(line = {}, tickRateMs = 5000) {
  const projectedRate = Number(line.unitsPerHour);
  if (Number.isFinite(projectedRate) && projectedRate >= 0) {
    return projectedRate;
  }
  const effectiveDurationTicks = Number(line.effectiveUnitDurationTicks);
  return Number.isFinite(effectiveDurationTicks) && effectiveDurationTicks > 0
    ? 60 * 60 * 1000 / (effectiveDurationTicks * Math.max(1, Number(tickRateMs) || 5000))
    : 0;
}

export function buildFactoryDashboardViewModel({
  factoryState = {},
  syncResult = {},
  supplyState = {},
  cleanMoney = 0,
  collectableAmount = 0,
  config = {},
  slotConfig = [],
  slotStorageCap = 0,
  formatCurrency = (value) => String(value),
  formatDurationLabel = (value) => `${value}ms`,
  getFactoryUpgradeCost = () => 0,
  normalizeResourceColorKey = (value) => value
} = {}) {
  const level = Math.max(1, Math.floor(Number(factoryState.level || 1)));
  const isMaxLevel = level >= Math.max(1, Number(config.maxLevel || level));
  const nextUpgradeCost = isMaxLevel ? null : getFactoryUpgradeCost(level + 1);
  const slots = Array.isArray(factoryState.slots) ? factoryState.slots : [];
  const readyResources = getFactoryReadyResourceTotals(slots);
  const outputCapsByResource = slots.reduce((caps, slot) => {
    const key = String(slot?.resourceKey || "").trim();
    if (!key) return caps;
    caps[key] = Math.max(
      Number(caps[key] || 0),
      Math.max(0, Math.floor(Number(getFactorySlotDisplayInfo(slot, config).storageCap || slot?.slotCap || slotStorageCap || 0)))
    );
    return caps;
  }, {});

  return {
    factoryState,
    syncResult,
    collectableAmount: Math.max(0, Math.floor(Number(collectableAmount || 0))),
    levelLabel: String(level),
    headerLevelLabel: `Lv ${level}`,
    multiplierLabel: formatFactorySpeedBonus(syncResult.productionMultiplier || 1),
    ownedCountLabel: String(Math.max(0, Math.floor(Number(syncResult.ownedFactoryCount || 0)))),
    upgradeCostLabel: isMaxLevel ? "MAX" : formatCurrency(nextUpgradeCost),
    resources: {
      metalParts: formatFactoryReadyLabel(readyResources.metalParts, "metalParts", outputCapsByResource.metalParts),
      techCore: formatFactoryReadyLabel(readyResources.techCore, "techCore", outputCapsByResource.techCore),
      combatModule: formatFactoryReadyLabel(readyResources.combatModule, "combatModule", outputCapsByResource.combatModule)
    },
    supplies: {
      metalParts: String(supplyState.metalParts || 0),
      techCore: String(supplyState.techCore || 0),
      combatModule: String(supplyState.combatModule || 0)
    },
    effectsLabel: "",
    upgradeButton: {
      visible: !isMaxLevel,
      disabled: isMaxLevel,
      text: "⇪",
      title: isMaxLevel ? "Max level" : `Upgrade budovy (${formatCurrency(nextUpgradeCost)})`
    },
    collectButton: {
      disabled: Math.max(0, Math.floor(Number(collectableAmount || 0))) <= 0,
      text: "+",
      title: Math.max(0, Math.floor(Number(collectableAmount || 0))) > 0
        ? `Vybrat hotové do skladu (${Math.max(0, Math.floor(Number(collectableAmount || 0)))})`
        : "Vybrat hotové do skladu"
    },
    slots: slots.map((slot) => {
      const slotMeta = slotConfig.find((item) => item.id === slot.id) || null;
      const displayInfo = getFactorySlotDisplayInfo(slot, config);
      const outputCap = Math.max(1, Math.floor(Number(displayInfo.storageCap || slot.slotCap || 1)));
      const queueCap = Math.max(1, Math.floor(Number(displayInfo.recipe?.queueCap || slot.queueCap || 1)));
      const queuedAmount = Math.max(0, Math.floor(Number(slot.queuedAmount || 0)));
      const outputIsFull = Math.max(0, Math.floor(Number(slot.producedAmount || 0))) >= outputCap;
      const affordableByCash = displayInfo.displayCost.cleanCash > 0
        ? Math.floor(Math.max(0, Number(cleanMoney || 0)) / displayInfo.displayCost.cleanCash)
        : Number.POSITIVE_INFINITY;
      const affordableByMetal = displayInfo.displayCost.metalParts > 0
        ? Math.floor(Math.max(0, Number(supplyState.metalParts || 0)) / displayInfo.displayCost.metalParts)
        : Number.POSITIVE_INFINITY;
      const affordableByTech = displayInfo.displayCost.techCore > 0
        ? Math.floor(Math.max(0, Number(supplyState.techCore || 0)) / displayInfo.displayCost.techCore)
        : Number.POSITIVE_INFINITY;
      const maxStartQuantity = outputIsFull ? 0 : Math.max(0, Math.min(
        queueCap - queuedAmount,
        affordableByCash,
        affordableByMetal,
        affordableByTech
      ));
      const baseDurationMs = getEffectiveFactorySlotDurationMs(slot, config, syncResult.baseProductionMultiplier || syncResult.productionMultiplier);
      const projectedBaseDurationMs = Number(slot.baseDurationMs);
      const projectedDurationMs = Number(slot.effectiveDurationMs);
      const resolvedBaseDurationMs = Number.isFinite(projectedBaseDurationMs) && projectedBaseDurationMs > 0
        ? projectedBaseDurationMs
        : baseDurationMs;
      const durationMs = Number.isFinite(projectedDurationMs) && projectedDurationMs > 0
        ? projectedDurationMs
        : getEffectiveFactorySlotDurationMs(slot, config, syncResult.productionMultiplier);
      return {
        slot,
        serverLine: slot.serverLine || null,
        title: slotMeta?.label || slot.resourceKey,
        perHour: getFactorySlotPerHour(slot, syncResult.rates || {}),
        slotStorageCap: queueCap,
        slotOutputCap: outputCap,
        queueCap,
        resourceColor: normalizeResourceColorKey(slot.resourceKey),
        queuedAmount,
        canStart: maxStartQuantity > 0,
        maxStartQuantity,
        unitCost: {
          metalParts: displayInfo.displayCost.metalParts,
          techCore: displayInfo.displayCost.techCore
        },
        inputAmounts: {
          metalParts: Math.max(0, Number(supplyState.metalParts || 0)),
          techCore: Math.max(0, Number(supplyState.techCore || 0))
        },
        displayCost: displayInfo.displayCost,
        priceLabel: getFactorySlotPriceLabel(slot, config),
        durationMs,
        durationBonusLabel: formatFactoryDurationBonus(resolvedBaseDurationMs, durationMs),
        ...getFactorySlotVisual(slot, config, formatDurationLabel)
      };
    })
  };
}

export function buildServerFactoryDashboardViewModel({
  serverFactory = {},
  tickRateMs = 5000,
  config = {},
  slotConfig = [],
  slotStorageCap = 0,
  formatCurrency = (value) => String(value),
  formatDurationLabel = (value) => `${value}ms`,
  getFactoryUpgradeCost = () => 0,
  normalizeResourceColorKey = (value) => value
} = {}) {
  const productionLines = Array.isArray(serverFactory.productionLines)
    ? serverFactory.productionLines
    : [];
  const producedByResource = Object.fromEntries((serverFactory.producedSummary || []).map((item) => [
    item.resourceKey,
    item
  ]));
  const safeTickRateMs = Math.max(1, Number(tickRateMs) || 5000);
  const supplyState = {};
  let cleanMoney = 0;
  const slots = productionLines.map((line) => {
    const resourceKey = FACTORY_LEGACY_KEY_BY_CANONICAL_KEY[line.resourceKey] || line.resourceKey;
    const slotMeta = slotConfig.find((item) => item.recipeId === line.recipeId || item.resourceKey === resourceKey) || {};
    for (const row of line.costDisplayRows || []) {
      if (row.resourceKey === "cash") {
        cleanMoney = Math.max(cleanMoney, Math.max(0, Number(row.availableAmount || 0)));
        continue;
      }
      const legacyInputKey = FACTORY_LEGACY_KEY_BY_CANONICAL_KEY[row.resourceKey] || row.resourceKey;
      supplyState[legacyInputKey] = Math.max(
        Number(supplyState[legacyInputKey] || 0),
        Math.max(0, Number(row.availableAmount || 0))
      );
    }
    const producedSummary = producedByResource[line.resourceKey] || {};
    const baseDurationTicks = Number(line.baseUnitDurationTicks);
    const effectiveDurationTicks = Number(line.effectiveUnitDurationTicks);
    return {
      id: slotMeta.id ?? line.recipeId,
      recipeId: line.recipeId,
      resourceKey,
      producedAmount: Math.max(0, Number(line.producedAmount ?? producedSummary.currentAmount ?? 0)),
      queuedAmount: Math.max(0, Number(line.queuedAmount || 0)),
      queueCap: Math.max(0, Number(line.queueCapacity || 0)),
      slotCap: Math.max(0, Number(line.producedCapacity ?? producedSummary.capacity ?? 0)),
      isProducing: line.status === "processing",
      baseDurationMs: Number.isFinite(baseDurationTicks) && baseDurationTicks > 0
        ? baseDurationTicks * safeTickRateMs
        : undefined,
      effectiveDurationMs: Number.isFinite(effectiveDurationTicks) && effectiveDurationTicks > 0
        ? effectiveDurationTicks * safeTickRateMs
        : undefined,
      effectiveSpeedMultiplier: resolveFactoryLineSpeedMultiplier(line),
      unitsPerHour: resolveFactoryLineUnitsPerHour(line, safeTickRateMs),
      serverLine: line
    };
  });
  const projectedBuildingMultiplier = Number(serverFactory.effectiveProductionSpeedMultiplier);
  const lineMultiplier = slots.find((slot) => Number.isFinite(slot.effectiveSpeedMultiplier) && slot.effectiveSpeedMultiplier > 0)
    ?.effectiveSpeedMultiplier;
  const projectedNetworkMultiplier = Number(
    serverFactory.network?.effectiveSpeedMultiplier
    ?? Number(serverFactory.network?.networkSpeedMultiplier || 1) * Number(serverFactory.network?.levelSpeedMultiplier || 1)
  );
  const effectiveSpeedMultiplier = Math.max(0.01,
    Number.isFinite(projectedBuildingMultiplier) && projectedBuildingMultiplier > 0
      ? projectedBuildingMultiplier
      : Number.isFinite(lineMultiplier) && lineMultiplier > 0
        ? lineMultiplier
        : Number.isFinite(projectedNetworkMultiplier) && projectedNetworkMultiplier > 0
          ? projectedNetworkMultiplier
          : 1
  );
  const slotsByResource = Object.fromEntries(slots.map((slot) => [slot.resourceKey, slot]));
  const rates = {
    metalPartsPerHour: Math.max(0, Number(slotsByResource.metalParts?.unitsPerHour || 0)),
    techCorePerHour: Math.max(0, Number(slotsByResource.techCore?.unitsPerHour || 0)),
    combatModulePerHour: Math.max(0, Number(slotsByResource.combatModule?.unitsPerHour || 0))
  };
  const fallbackCollectableAmount = slots.reduce((total, slot) => (
    total + (slot.serverLine?.canCollect === true ? slot.producedAmount : 0)
  ), 0);
  const projectedCollectableAmount = Number(serverFactory.collectableAmount);
  const collectableAmount = Math.max(0, Math.floor(
    Number.isFinite(projectedCollectableAmount)
      ? projectedCollectableAmount
      : fallbackCollectableAmount
  ));
  const canCollect = typeof serverFactory.canCollect === "boolean"
    ? serverFactory.canCollect
    : productionLines.some((line) => line.canCollect === true);
  const collectDisabledReason = serverFactory.collectDisabledReason
    || productionLines.find((line) => line.canCollect !== true && line.collectDisabledReason)?.collectDisabledReason
    || productionLines.find((line) => line.canCollect !== true && Number(line.producedAmount || 0) > 0)?.disabledReason
    || "Zatím není nic hotového k vyzvednutí.";
  const dashboard = buildFactoryDashboardViewModel({
    factoryState: {
      level: Math.max(1, Number(serverFactory.level || 1)),
      slots
    },
    syncResult: {
      productionMultiplier: effectiveSpeedMultiplier,
      baseProductionMultiplier: effectiveSpeedMultiplier,
      ownedFactoryCount: Math.max(0, Number(serverFactory.network?.activeFactoryCount || 0)),
      rates
    },
    supplyState,
    cleanMoney,
    collectableAmount,
    config,
    slotConfig,
    slotStorageCap,
    formatCurrency,
    formatDurationLabel,
    getFactoryUpgradeCost,
    normalizeResourceColorKey
  });

  return {
    ...dashboard,
    resources: {
      metalParts: slotsByResource.metalParts
        ? formatFactoryReadyLabel(slotsByResource.metalParts.producedAmount, "metalParts", slotsByResource.metalParts.slotCap)
        : dashboard.resources.metalParts,
      techCore: slotsByResource.techCore
        ? formatFactoryReadyLabel(slotsByResource.techCore.producedAmount, "techCore", slotsByResource.techCore.slotCap)
        : dashboard.resources.techCore,
      combatModule: slotsByResource.combatModule
        ? formatFactoryReadyLabel(slotsByResource.combatModule.producedAmount, "combatModule", slotsByResource.combatModule.slotCap)
        : dashboard.resources.combatModule
    },
    collectableAmount,
    collectButton: {
      ...dashboard.collectButton,
      disabled: !canCollect,
      title: canCollect
        ? `Vybrat hotové do skladu${collectableAmount > 0 ? ` (${collectableAmount})` : ""}`
        : collectDisabledReason
    },
    slots: dashboard.slots.map((slotView) => ({
      ...slotView,
      perHour: Math.max(0, Number(slotView.slot?.unitsPerHour || 0)),
      slotStorageCap: Math.max(0, Number(slotView.slot?.queueCap || 0)),
      slotOutputCap: Math.max(0, Number(slotView.slot?.slotCap || 0)),
      queueCap: Math.max(0, Number(slotView.slot?.queueCap || 0)),
      queuedAmount: Math.max(0, Number(slotView.slot?.queuedAmount || 0)),
      secondaryLine: slotView.slot?.resourceKey === "combatModule" && Number(slotView.durationMs || 0) > 0
        ? `${formatDurationLabel(slotView.durationMs)} / kus`
        : slotView.secondaryLine,
      canStart: slotView.serverLine?.canStart === true,
      maxStartQuantity: Math.max(0, Number(slotView.serverLine?.maxStartQuantity || 0)),
      disabledReason: slotView.serverLine?.disabledReason || null
    }))
  };
}

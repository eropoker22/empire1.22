function getFactorySlotPerHour(slot = {}, rates = {}) {
  if (slot.resourceKey === "metalParts") return rates.metalPartsPerHour;
  if (slot.resourceKey === "techCore") return rates.techCorePerHour;
  return rates.combatModulePerHour;
}

const FACTORY_SLOT_DISPLAY_INFO = Object.freeze({
  metalParts: Object.freeze({
    durationLabel: "4 min",
    priceLabel: "120",
    storageCap: 20,
    displayCost: Object.freeze({ cleanCash: 120, techCore: 0 }),
    primaryLine: "120",
    secondaryLine: "4 min"
  }),
  techCore: Object.freeze({
    durationLabel: "8 min",
    priceLabel: "300",
    storageCap: 10,
    displayCost: Object.freeze({ cleanCash: 300, techCore: 0 }),
    primaryLine: "300",
    secondaryLine: "8 min"
  }),
  combatModule: Object.freeze({
    durationLabel: "15 min",
    priceLabel: "650 + 1 Tech Core",
    storageCap: 5,
    displayCost: Object.freeze({ cleanCash: 650, techCore: 1 }),
    primaryLine: "650 + 1 Tech Core",
    secondaryLine: "15 min"
  })
});

function getFactorySlotDisplayInfo(slot = {}) {
  return FACTORY_SLOT_DISPLAY_INFO[slot.resourceKey] || FACTORY_SLOT_DISPLAY_INFO.metalParts;
}

function formatFactoryReadyLabel(amount, resourceKey) {
  const cap = FACTORY_SLOT_DISPLAY_INFO[resourceKey]?.storageCap || 0;
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
  const displayInfo = getFactorySlotDisplayInfo(slot);
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
    secondaryLine: displayInfo.secondaryLine || `${formatDurationLabel(config.combatModule?.durationMs || 0)} / kus`
  };
}

function getFactorySlotPriceLabel(slot = {}) {
  return getFactorySlotDisplayInfo(slot).priceLabel || "bez ceny";
}

function getFactorySlotDurationMs(slot = {}, config = {}) {
  const configuredDuration = Number(config.slotDurationMs?.[slot.resourceKey]);
  if (Number.isFinite(configuredDuration) && configuredDuration > 0) {
    return configuredDuration;
  }
  return FACTORY_SLOT_DISPLAY_INFO[slot.resourceKey]?.durationMs || (
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

export function buildFactoryDashboardViewModel({
  factoryState = {},
  syncResult = {},
  supplyState = {},
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

  return {
    factoryState,
    syncResult,
    collectableAmount: Math.max(0, Math.floor(Number(collectableAmount || 0))),
    levelLabel: String(level),
    headerLevelLabel: `Lv ${level}`,
    multiplierLabel: `${Number(syncResult.productionMultiplier || 0).toFixed(2)}x`,
    ownedCountLabel: String(Math.max(0, Math.floor(Number(syncResult.ownedFactoryCount || 0)))),
    upgradeCostLabel: isMaxLevel ? "MAX" : formatCurrency(nextUpgradeCost),
    resources: {
      metalParts: formatFactoryReadyLabel(readyResources.metalParts, "metalParts"),
      techCore: formatFactoryReadyLabel(readyResources.techCore, "techCore"),
      combatModule: formatFactoryReadyLabel(readyResources.combatModule, "combatModule")
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
      return {
        slot,
        title: slotMeta?.label || slot.resourceKey,
        perHour: getFactorySlotPerHour(slot, syncResult.rates || {}),
        slotStorageCap: Math.max(1, Math.floor(Number(slot.slotCap || getFactorySlotDisplayInfo(slot).storageCap || slotStorageCap || 1))),
        resourceColor: normalizeResourceColorKey(slot.resourceKey),
        queuedAmount: Math.max(0, Math.floor(Number(slot.queuedAmount || 0))),
        unitCost: {
          metalParts: slot.mode === "craft" || slot.resourceKey === "combatModule" ? Math.max(0, Number(config.combatModule?.metalPartsCost || 0)) : 0,
          techCore: slot.mode === "craft" || slot.resourceKey === "combatModule" ? Math.max(0, Number(config.combatModule?.techCoreCost || 0)) : 0
        },
        displayCost: getFactorySlotDisplayInfo(slot).displayCost,
        priceLabel: getFactorySlotPriceLabel(slot, config),
        durationMs: getEffectiveFactorySlotDurationMs(slot, config, syncResult.productionMultiplier),
        ...getFactorySlotVisual(slot, config, formatDurationLabel)
      };
    })
  };
}

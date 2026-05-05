function getFactorySlotPerHour(slot = {}, rates = {}) {
  if (slot.resourceKey === "metalParts") return rates.metalPartsPerHour;
  if (slot.resourceKey === "techCore") return rates.techCorePerHour;
  return rates.combatModulePerHour;
}

function getFactorySlotVisual(slot = {}, config = {}, formatDurationLabel = (value) => `${value}ms`) {
  if (slot.resourceKey === "metalParts") {
    return {
      iconToneClass: "drug-production-slot__icon--amber",
      iconGlyphClass: "drug-production-slot__icon--crate",
      typeLabel: `Výrobní slot ${slot.id}`,
      profileLabel: "Profil",
      primaryLine: "Surovinový výstup",
      secondaryLine: "Základ pro další výrobu"
    };
  }

  if (slot.resourceKey === "techCore") {
    return {
      iconToneClass: "drug-production-slot__icon--cyan",
      iconGlyphClass: "drug-production-slot__icon--chip",
      typeLabel: `Výrobní slot ${slot.id}`,
      profileLabel: "Profil",
      primaryLine: "Pokročilé jádro",
      secondaryLine: "Support pro vyšší tier"
    };
  }

  return {
    iconToneClass: "drug-production-slot__icon--red",
    iconGlyphClass: "drug-production-slot__icon--crosshair",
    typeLabel: `Craft slot ${slot.id}`,
    profileLabel: "Recept",
    primaryLine: `${config.combatModule?.metalPartsCost || 0} MP + ${config.combatModule?.techCoreCost || 0} TC`,
    secondaryLine: `${formatDurationLabel(config.combatModule?.durationMs || 0)} / kus`
  };
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
      metalParts: String(factoryState.resources?.metalParts || 0),
      techCore: String(factoryState.resources?.techCore || 0),
      combatModule: String(factoryState.resources?.combatModule || 0)
    },
    supplies: {
      metalParts: String(supplyState.metalParts || 0),
      techCore: String(supplyState.techCore || 0),
      combatModule: String(supplyState.combatModule || 0)
    },
    effectsLabel: `Síť Továren: ${Math.max(0, Math.floor(Number(syncResult.ownedFactoryCount || 0)))} budova (+${Number(syncResult.networkProductionBonusPct || 0)}% rychlost výroby)`,
    upgradeButton: {
      disabled: isMaxLevel,
      text: isMaxLevel ? "MAX" : "⇪",
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
        slotStorageCap,
        resourceColor: normalizeResourceColorKey(slot.resourceKey),
        ...getFactorySlotVisual(slot, config, formatDurationLabel)
      };
    })
  };
}

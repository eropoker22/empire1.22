function safeObject(value) {
  return value && typeof value === "object" ? value : {};
}

function safeFunction(fn, fallback) {
  return typeof fn === "function" ? fn : fallback;
}

export function formatProductionRecipeInputList(recipe = {}, options = {}) {
  const formatCurrency = safeFunction(options.formatCurrency, (value) => String(value));
  const getResourceLabel = safeFunction(options.getResourceLabel, (itemId) => itemId);
  const inputs = safeObject(recipe.inputs);
  const cleanCost = Math.max(0, Math.floor(Number(recipe.cleanMoneyCost || 0)));
  const parts = [
    cleanCost > 0 ? `${formatCurrency(cleanCost)} clean` : "",
    ...Object.entries(inputs).map(([itemId, amount]) => `${getResourceLabel(itemId)} x${amount}`)
  ].filter(Boolean);

  return parts.join(" + ") || "Bez vstupu";
}

export function formatProductionRecipeInfoLine(recipe = {}, options = {}) {
  const getResourceLabel = safeFunction(options.getResourceLabel, (itemId) => itemId);
  const formatDurationLabel = safeFunction(options.formatDurationLabel, (value) => `${value}ms`);
  const outputLabel = getResourceLabel(recipe.output?.itemId || recipe.name);
  const outputAmount = Math.max(0, Number(recipe.output?.amount || 0));
  return `${recipe.name || outputLabel}: ${formatProductionRecipeInputList(recipe, options)} -> ${outputLabel} x${outputAmount} · ${formatDurationLabel(recipe.durationMs || 0)}`;
}

export function getProductionBuildingEffectsLabel(buildingName = "", level = 1, options = {}) {
  const productionConfig = safeObject(options.productionConfig);
  const getMultiplier = safeFunction(options.getMultiplier, () => 1);
  const multiplier = getMultiplier(buildingName, level);
  const bonusPct = Math.max(0, Math.round((multiplier - 1) * 100));
  const label = productionConfig[buildingName]?.label || "Budova";
  return bonusPct > 0
    ? `${label} · produkce +${bonusPct}%`
    : `${label} · základní produkční rychlost`;
}

export function createProductionBuildingInfoViewModel({
  buildingName = "",
  recipes = {},
  state = {},
  readyCount = 0,
  upgradeCost = 0,
  maxLevel = 14,
  productionConfig = {},
  getMultiplier = () => 1,
  formatCurrency = (value) => String(value),
  formatDurationLabel = (value) => `${value}ms`,
  getResourceLabel = (itemId) => itemId
} = {}) {
  const config = productionConfig[buildingName];
  const multiplier = getMultiplier(buildingName, state.level);
  const nextMultiplier = state.level < maxLevel
    ? getMultiplier(buildingName, state.level + 1)
    : multiplier;
  return {
    config,
    buildingName,
    recipes,
    state,
    readyCount,
    upgradeCost,
    maxLevel,
    multiplier,
    nextMultiplier,
    recipeLines: Object.values(safeObject(recipes)).map((recipe) => formatProductionRecipeInfoLine(recipe, {
      formatCurrency,
      formatDurationLabel,
      getResourceLabel
    })),
    effectsLabel: getProductionBuildingEffectsLabel(buildingName, state.level, {
      productionConfig,
      getMultiplier
    })
  };
}

export function createFactoryBuildingInfoViewModel({
  factoryState = {},
  syncResult = {},
  collectableAmount = 0,
  config = {},
  formatCurrency = (value) => String(value),
  formatDurationLabel = (value) => `${value}ms`,
  getFactoryUpgradeCost = () => 0,
  getFactoryLevelMultiplier = () => syncResult.productionMultiplier
} = {}) {
  const nextLevel = factoryState.level < config.maxLevel ? factoryState.level + 1 : null;
  const upgradeCost = nextLevel ? getFactoryUpgradeCost(nextLevel) : 0;
  const nextMultiplier = nextLevel ? getFactoryLevelMultiplier(nextLevel) : syncResult.productionMultiplier;
  const currentMultiplier = Number(syncResult.productionMultiplier || 0);
  const safeNextMultiplier = Number(nextMultiplier || 0);
  return {
    description: "Továrna vyrábí technické komponenty pro zbraně, obranu a vyšší tier výbavy.",
    effectsLabel: nextLevel
      ? `Multiplier x${currentMultiplier.toFixed(2)} · další level x${safeNextMultiplier.toFixed(2)}`
      : `Multiplier x${currentMultiplier.toFixed(2)} · max level`,
    upgrade: {
      costLabel: nextLevel ? formatCurrency(upgradeCost) : "MAX",
      benefitLabel: nextLevel ? `L${nextLevel} · x${safeNextMultiplier.toFixed(2)} rychlost` : "Max level"
    },
    products: [
      {
        id: "metal-parts",
        title: "Metal Parts",
        description: "Základní kovové díly pro výrobu zbraní, obrany a technického vybavení. Levný základ každé pouliční války.",
        durationLabel: "4 min",
        costLabel: "120 Dirty Cash"
      },
      {
        id: "tech-core",
        title: "Tech Core",
        description: "Pokročilé technologické jádro používané pro kamery, alarmy, turrety a silnější zbraně. Dražší, ale otevírá vyšší tier výbavy.",
        durationLabel: "8 min",
        costLabel: "300 Dirty Cash"
      },
      {
        id: "combat-module",
        title: "Combat Module",
        description: "Vojenský bojový modul pro high-tech zbraně, automatickou obranu a těžkou výbavu. Vzácný komponent pro hráče, kteří chtějí dominovat silou.",
        durationLabel: "15 min",
        costLabel: "650 Dirty Cash + 1 Tech Core"
      }
    ],
    rows: [
      { label: "Level", value: `L${factoryState.level} · multiplier x${currentMultiplier.toFixed(2)}` },
      { label: "Upgrade", value: nextLevel ? `${formatCurrency(upgradeCost)} -> L${nextLevel}` : "Max level" },
      { label: "Další level", value: nextLevel ? `Multiplier x${safeNextMultiplier.toFixed(2)}, vyšší rychlost linek.` : "Budova už je na maximu." },
      { label: "Výstup", value: `Metal Parts ${Number(syncResult.rates?.metalPartsPerHour || 0).toFixed(2)}/h · Tech Core ${Number(syncResult.rates?.techCorePerHour || 0).toFixed(2)}/h · Combat Module ${Number(syncResult.rates?.combatModulePerHour || 0).toFixed(2)}/h` },
      { label: "Vyzvednutí", value: collectableAmount > 0 ? `${collectableAmount} ks hotovo do skladu` : "Zatím nic hotového" },
      { label: "Combat Module", value: `${config.combatModule?.metalPartsCost || 0} Metal Parts + ${config.combatModule?.techCoreCost || 0} Tech Core · ${formatDurationLabel(config.combatModule?.durationMs || 0)} · heat +${config.combatModule?.heatPerUnit || 0}/ks` }
    ],
    actions: [
      { title: "+ Vybrat hotové", description: collectableAmount > 0 ? `Přesune ${collectableAmount} ks hotových továrních výstupů do skladu.` : "Přesune hotové tovární výstupy do skladu, až budou připravené." },
      { title: "⇪ Upgrade", description: nextLevel ? `Stojí ${formatCurrency(upgradeCost)} clean cash a zvedne multiplier na x${Number(nextMultiplier || 0).toFixed(2)}.` : "Max level, další upgrade není dostupný." },
      { title: "Spustit / Zrušit slot", description: "Řídí jednotlivé linky: Metal Parts, Tech Core a Combat Module. Zrušení smaže aktivní frontu slotu." }
    ]
  };
}

function safeObject(value) {
  return value && typeof value === "object" ? value : {};
}

function safeFunction(fn, fallback) {
  return typeof fn === "function" ? fn : fallback;
}

function formatMultiplierBonus(multiplier) {
  const numeric = Number(multiplier || 1);
  const bonusPct = Math.max(0, Math.round((numeric - 1) * 100));
  return bonusPct > 0 ? `+${bonusPct}%` : "základní rychlost";
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
  const outputLabel = getResourceLabel(recipe.output?.itemId || recipe.name);
  const outputAmount = Math.max(0, Number(recipe.output?.amount || 0));
  return `${recipe.name || outputLabel}: ${formatProductionRecipeInputList(recipe, options)} -> ${outputLabel} x${outputAmount} · okamžitě`;
}

export function getProductionBuildingEffectsLabel(buildingName = "", level = 1, options = {}) {
  const productionConfig = safeObject(options.productionConfig);
  const getMultiplier = safeFunction(options.getMultiplier, () => 1);
  const multiplier = getMultiplier(buildingName, level);
  const bonusPct = Math.max(0, Math.round((multiplier - 1) * 100));
  const label = productionConfig[buildingName]?.label || "Budova";
  return bonusPct > 0
    ? `${label} · pasivní produkce +${bonusPct}%`
    : `${label} · základní pasivní produkce`;
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
  config = {},
  formatCurrency = (value) => String(value),
  getResourceLabel = (resourceKey) => ({
    "metal-parts": "Metal Parts",
    "tech-core": "Tech Core",
    "combat-module": "Combat Module"
  })[resourceKey] || resourceKey,
  getFactoryUpgradeCost = () => 0,
  getFactoryLevelMultiplier = () => syncResult.productionMultiplier
} = {}) {
  const nextLevel = factoryState.level < config.maxLevel ? factoryState.level + 1 : null;
  const upgradeCost = nextLevel ? getFactoryUpgradeCost(nextLevel) : 0;
  const nextMultiplier = nextLevel ? getFactoryLevelMultiplier(nextLevel) : syncResult.productionMultiplier;
  const safeNextMultiplier = Number(nextMultiplier || 0);
  const recipeDescriptions = {
    "metal-parts": "Základní průmyslový materiál pro výrobu pokročilejších komponent a vybavení.",
    "tech-core": "Pokročilé technologické jádro používané ve výrobě zbraní, obran a dalších průmyslových komponent.",
    "combat-module": "Strategická průmyslová komponenta pro high-tier výzbroj a pokročilé boost protokoly."
  };
  const recipeOrder = ["metal-parts", "tech-core", "combat-module"];
  const recipes = safeObject(config.recipes);
  const products = recipeOrder.map((recipeId) => {
    const recipe = safeObject(recipes[recipeId]);
    return {
      id: recipeId,
      title: recipe.name || getResourceLabel(recipeId),
      description: recipeDescriptions[recipeId],
      durationLabel: recipe.name ? "Okamžitě" : "Načítám",
      costLabel: recipe.name ? formatProductionRecipeInputList(recipe, { formatCurrency, getResourceLabel }) : "Načítám"
    };
  });
  const combatModuleRecipe = safeObject(recipes["combat-module"]);
  return {
    description: "Továrna vyrábí Metal Parts, Tech Core a Combat Module okamžitě do skladu. Combat Module je vstup pro high-tier vybavení a pokročilé boost protokoly.",
    effectsLabel: nextLevel
      ? `Další level: pasivní produkce ${formatMultiplierBonus(safeNextMultiplier)}`
      : "Maximální level",
    upgrade: {
      costLabel: nextLevel ? formatCurrency(upgradeCost) : "MAX",
      benefitLabel: nextLevel ? `L${nextLevel} · pasivní produkce ${formatMultiplierBonus(safeNextMultiplier)}` : "Maximální level"
    },
    products,
    rows: [
      { label: "Level", value: `L${factoryState.level}` },
      { label: "Upgrade", value: nextLevel ? `${formatCurrency(upgradeCost)} -> L${nextLevel}` : "Maximální level" },
      { label: "Další level", value: nextLevel ? `Pasivní produkce budovy ${formatMultiplierBonus(safeNextMultiplier)}.` : "Budova už je na maximu." },
      { label: "Výstup", value: `Metal Parts ${Number(syncResult.rates?.metalPartsPerHour || 0).toFixed(2)}/h · Tech Core ${Number(syncResult.rates?.techCorePerHour || 0).toFixed(2)}/h · Bojový modul ${Number(syncResult.rates?.combatModulePerHour || 0).toFixed(2)}/h` },
      { label: "Ruční výroba", value: "Výstup se po potvrzení okamžitě uloží do skladu." },
      {
        label: "Bojový modul",
        value: combatModuleRecipe.name
          ? `${formatProductionRecipeInputList(combatModuleRecipe, { formatCurrency, getResourceLabel })} · okamžitě`
          : "Recept se načítá"
      }
    ],
    actions: [
      { title: "+ Vyrobit", description: "Po serverové kontrole vstupů a kapacity vznikne výstup okamžitě ve skladu." },
      { title: "⇪ Upgrade", description: nextLevel ? `Stojí ${formatCurrency(upgradeCost)} clean cash a zvedne pasivní produkci na ${formatMultiplierBonus(safeNextMultiplier)}.` : "Maximální level, další upgrade není dostupný." },
      { title: "Kapacita skladu", description: "Výroba se nespustí, pokud se celý výstup nevejde do skladu; vstupy se při odmítnutí neodečtou." }
    ]
  };
}

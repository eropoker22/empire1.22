export function formatDurationLabel(durationMs) {
  return `${Math.max(1, Math.round(durationMs / 1000))} s`;
}

export function formatRecipeInputs(inputs = {}) {
  return Object.entries(inputs)
    .map(([itemId, amount]) => `${amount} ${itemId}`)
    .join(" · ");
}

export function getProductionCatalog(recipeGroups) {
  return Object.fromEntries(
    Object.entries(recipeGroups).flatMap(([groupId, recipes]) =>
      Object.entries(recipes).map(([recipeId, recipe]) => [`${groupId}:${recipeId}`, recipe])
    )
  );
}

export function canStartProduction(inputs = {}, inventory = {}) {
  return Object.entries(inputs).every(([itemId, amount]) => (inventory[itemId] ?? 0) >= amount);
}

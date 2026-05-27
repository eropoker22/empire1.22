export function formatDurationLabel(durationMs) {
  const totalSeconds = Math.max(1, Math.round(Number(durationMs || 0) / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return seconds > 0
      ? `${hours} h ${minutes} min ${seconds} s`
      : minutes > 0
        ? `${hours} h ${minutes} min`
        : `${hours} h`;
  }

  if (minutes > 0) {
    return seconds > 0 ? `${minutes} min ${seconds} s` : `${minutes} min`;
  }

  return `${seconds} s`;
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

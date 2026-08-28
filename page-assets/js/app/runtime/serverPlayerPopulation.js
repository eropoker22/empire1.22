const toAvailablePopulation = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 ? Math.floor(amount) : null;
};

export function resolveServerPlayerPopulation(playerView) {
  if (!playerView || typeof playerView !== "object") return null;

  const candidates = [
    playerView.economy?.population,
    playerView.resourceBalances?.population,
    playerView.economy?.resources?.population,
    playerView.attackWeapons?.availablePopulation
  ];

  for (const candidate of candidates) {
    const population = toAvailablePopulation(candidate);
    if (population !== null) return population;
  }
  return null;
}

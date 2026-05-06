export function resolveSpyScenario(mission, options = {}) {
  const devOnlyFullSuccessChance = Math.max(0, Math.min(1, Number(options.devOnlyFullSuccessChance || 0)));
  if (devOnlyFullSuccessChance > 0) {
    const roll = Number.isFinite(Number(options.roll)) ? Number(options.roll) : Math.random();
    if (roll < devOnlyFullSuccessChance) {
      return "Úspěch";
    }
  }

  const targetDistrictId = Number.parseInt(String(mission?.targetDistrictId ?? "0"), 10) || 0;
  const scenarioIndex = ((targetDistrictId - 1) % 3) + 1;
  if (scenarioIndex === 1) return "Úspěch";
  if (scenarioIndex === 2) return "Částečný úspěch";
  return "Neúspěch";
}

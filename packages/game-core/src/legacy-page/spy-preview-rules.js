export function resolveSpyScenario(mission) {
  const targetDistrictId = Number.parseInt(String(mission?.targetDistrictId ?? "0"), 10) || 0;
  const scenarioIndex = ((targetDistrictId - 1) % 3) + 1;
  if (scenarioIndex === 1) return "Úspěch";
  if (scenarioIndex === 2) return "Částečný úspěch";
  return "Neúspěch";
}

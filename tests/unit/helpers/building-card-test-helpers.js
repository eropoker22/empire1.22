import { expect } from "vitest";

export const GENERIC_BUILDING_CARD_COPY = Object.freeze([
  "silnější cashflow",
  "lokální efekty",
  "posílí svoje efekty podle typu budovy"
]);

export function expectNoGenericBuildingCardCopy(value) {
  const serialized = JSON.stringify(value);
  for (const copy of GENERIC_BUILDING_CARD_COPY) {
    expect(serialized).not.toContain(copy);
  }
}

export function createBaseBuildingMechanics(overrides = {}) {
  return {
    level: 1,
    cleanHourly: 120,
    dirtyHourly: 0,
    dailyHeat: 1,
    dailyInfluence: 0,
    storedOutputLabel: "$0",
    nextLevel: 2,
    upgradeCostLabel: "$1,500",
    hasManualCollect: false,
    canCollect: false,
    mechanicsType: "generic",
    actionCooldowns: {},
    effectsLabel: "Žádné aktivní mechaniky.",
    ...overrides
  };
}

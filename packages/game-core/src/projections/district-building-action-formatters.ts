export const formatInputSummary = (inputCosts: Record<string, number>): string =>
  Object.entries(inputCosts)
    .map(([resourceKey, amount]) => `${amount} ${formatResourceLabel(resourceKey)}`)
    .join(" + ");

export const formatResourceLabel = (resourceKey: string): string =>
  resourceKey
    .split("-")
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");

export const formatCategoryList = (categories: string[]): string =>
  categories.length > 0
    ? categories.map((category) => GARAGE_CATEGORY_LABELS[category] ?? formatResourceLabel(category)).join(", ")
    : "none";

const GARAGE_CATEGORY_LABELS: Record<string, string> = {
  gangMovement: "Gang movement",
  attackPreparation: "Attack preparation",
  districtRobbery: "District robbery",
  equipmentTransfer: "Equipment transfer",
  resourceTransfer: "Resource transfer",
  defenseRepair: "Defense repair",
  defenseRestore: "Defense restore",
  districtSpy: "District spy",
  trapDetection: "Trap detection",
  clinicRecovery: "Clinic recovery",
  factoryProductionActions: "Factory production actions",
  armoryProductionActions: "Armory production actions",
  moneyLaundering: "Money laundering",
  casinoActions: "Casino actions",
  exchangeOfficeActions: "Exchange office actions",
  arcadeLaunderingActions: "Arcade laundering actions",
  vipBoosts: "VIP boosts",
  rumorGeneration: "Rumor generation",
  passiveProduction: "Passive production"
};

export const formatNumber = (value: number): string => {
  const normalized = Number(value || 0);
  return Number.isInteger(normalized) ? String(normalized) : normalized.toFixed(1);
};

export const formatTickLabel = (tickCount: number): string => `${tickCount} ${tickCount === 1 ? "tick" : "ticks"}`;


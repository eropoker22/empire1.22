export const formatInputSummary = (inputCosts: Record<string, number>): string =>
  Object.entries(inputCosts)
    .map(([resourceKey, amount]) => `${amount} ${formatResourceLabel(resourceKey)}`)
    .join(" + ");

export const formatResourceLabel = (resourceKey: string): string =>
  RESOURCE_LABELS[resourceKey] ??
  resourceKey
    .split("-")
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");

const RESOURCE_LABELS: Record<string, string> = {
  "combat-module": "Bojový modul",
  combatModule: "Bojový modul"
};

export const formatCategoryList = (categories: string[]): string =>
  categories.length > 0
    ? categories.map((category) => GARAGE_CATEGORY_LABELS[category] ?? formatResourceLabel(category)).join(", ")
    : "žádné";

const GARAGE_CATEGORY_LABELS: Record<string, string> = {
  gangMovement: "Pohyb gangu",
  attackPreparation: "Příprava útoku",
  districtRobbery: "Loupež districtu",
  equipmentTransfer: "Přesun výbavy",
  resourceTransfer: "Přesun surovin",
  defenseRepair: "Oprava obrany",
  defenseRestore: "Obnova obrany",
  districtSpy: "Špionáž districtu",
  trapDetection: "Detekce pastí",
  clinicRecovery: "Klinické zotavení",
  factoryProductionActions: "Akce továrny",
  armoryProductionActions: "Akce zbrojovky",
  moneyLaundering: "Praní peněz",
  casinoActions: "Akce kasina",
  exchangeOfficeActions: "Akce směnárny",
  arcadeLaunderingActions: "Praní v herně",
  vipBoosts: "VIP boosty",
  rumorGeneration: "Tvorba drbů",
  passiveProduction: "Pasivní produkce"
};

export const formatNumber = (value: number): string => {
  const normalized = Number(value || 0);
  return Number.isInteger(normalized) ? String(normalized) : normalized.toFixed(1);
};

export const formatTickLabel = (tickCount: number): string => {
  const normalized = Math.max(0, Math.floor(Number(tickCount || 0)));
  const suffix = normalized === 1 ? "tick" : normalized >= 2 && normalized <= 4 ? "ticky" : "ticků";
  return `${normalized} ${suffix}`;
};

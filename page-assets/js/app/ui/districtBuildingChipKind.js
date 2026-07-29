const ACTIVE_ACTION_BUILDINGS = new Set([
  "bytovy blok",
  "centralni banka",
  "energeticka stanice",
  "herna",
  "kasino",
  "klinika",
  "letiste",
  "lobby club",
  "lobby klub",
  "magistrat",
  "parlament",
  "pasovaci tunel",
  "poulicni dealeri",
  "pristav",
  "recyklacni centrum",
  "restaurace",
  "skola",
  "smenarna",
  "strip club",
  "burza"
]);

const PRODUCTION_BUILDINGS = new Set([
  "drug lab",
  "lab",
  "lekarna",
  "tovarna",
  "zbrojovka"
]);

const normalizeBuildingName = (value) => String(value || "")
  .trim()
  .toLowerCase()
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "");

export const resolveDistrictBuildingChipKind = (buildingName) => {
  const normalizedName = normalizeBuildingName(buildingName);
  if (PRODUCTION_BUILDINGS.has(normalizedName)) {
    return "Výroba";
  }
  if (ACTIVE_ACTION_BUILDINGS.has(normalizedName)) {
    return "Spustit akci";
  }
  return "Pasivní bonus";
};

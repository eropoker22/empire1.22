import { ATTACK_WEAPON_LABELS } from "./combatData.js";
// Preview-only legacy building detail model. Server projections own command availability and final action results.
import {
  DISTRICT_BUILDING_TYPE_META
} from "../map/mapConstants.js";
import {
  AUTO_SALON_SUPPORT_CONFIG,
  DISTRICT_BUILDING_DETAIL_ACTION_COOLDOWN_MS,
  FITNESS_CLUB_SUPPORT_CONFIG,
  GARAGE_SUPPORT_CONFIG,
  SCHOOL_CONFIG,
  SHOPPING_MALL_NETWORK_CONFIG,
  SMUGGLING_TUNNEL_CONFIG
} from "./buildingDetailData.js";
import { formatDistrictBuildingTierLabel } from "./districtBuildingData.js";
import {
  formatDistrictBuildingCooldown,
  formatDistrictBuildingMoney
} from "./formatters.js";
import {
  PRODUCTION_RESOURCE_LABELS
} from "./productionBuildingData.js";
import {
  formatBuildingActionCategoryLabels,
  getActionDescription,
  getActionDisabledReason,
  getBuildingActionUi
} from "../ui/buildingActionUiRegistry.js";

function normalizeBuildingLookupKey(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function createStat(label, value) {
  return { label, value };
}

function createMechanic(label, value) {
  return { label, value };
}

const FOCUSED_BUILDING_DETAIL_LABELS = Object.freeze({
  "apartment-block": "Bytový blok",
  garage: "Garáž",
  "recruitment-center": "Rekrutační centrum",
  clinic: "Klinika",
  arcade: "Herna",
  school: "Škola",
  restaurant: "Restaurace",
  "fitness-club": "Fitness Club",
  exchange: "Směnárna",
  "auto-salon": "Autosalon",
  retail: "Obchodní centrum",
  casino: "Kasino",
  warehouse: "Sklad",
  "power-plant": "Energetická stanice",
  "recycling-center": "Recyklační centrum",
  "street-dealers": "Pouliční dealeři",
  "convenience-store": "Večerka",
  "smuggling-tunnel": "Pašovací tunel",
  "strip-club": "Strip club"
});

const FOCUSED_BUILDING_DETAIL_BADGES = Object.freeze({
  "apartment-block": "Členové gangu",
  garage: "Logistika",
  "recruitment-center": "Nábor",
  clinic: "Recovery",
  arcade: "Dirty cash",
  school: "Talenty",
  restaurant: "Lokální cashflow",
  "fitness-club": "Síla gangu",
  exchange: "Praní peněz",
  "auto-salon": "Mobilita",
  retail: "Market",
  casino: "High-risk praní",
  warehouse: "Sklad zásob",
  "power-plant": "Infrastruktura",
  "recycling-center": "Salvage",
  "street-dealers": "Distribuce",
  "convenience-store": "Pouliční provoz",
  "smuggling-tunnel": "Pašování",
  "strip-club": "Noční provoz"
});

const SUPPRESS_SINGLE_PANEL_ACTIONS = new Set(["apartment-block", "garage", "recruitment-center"]);

function getProductionResourceLabel(itemId) {
  return PRODUCTION_RESOURCE_LABELS[itemId] || String(itemId || "").trim() || "Materiál";
}

function normalizeProductionResourceColorKey(itemId) {
  const normalized = String(itemId || "").trim();
  const aliases = {
    metalParts: "metal-parts",
    techCore: "tech-core",
    combatModule: "combat-module"
  };
  return aliases[normalized] || normalized;
}

export function getCasinoClientAuditRisk(entry, playerHeat = 0, now = Date.now()) {
  const activeEffects = Array.isArray(entry?.activeEffects) ? entry.activeEffects : [];
  let risk = 8;
  risk += activeEffects
    .filter((effect) => Number(effect.expiresAt || 0) > now)
    .reduce((total, effect) => total + Math.max(0, Number(effect.auditRiskBoostPct || 0)), 0);
  if (Number(playerHeat || 0) > 180) {
    risk += 20;
  } else if (Number(playerHeat || 0) > 100) {
    risk += 10;
  }
  const reductionPct = activeEffects
    .filter((effect) => Number(effect.expiresAt || 0) > now)
    .reduce((max, effect) => Math.max(max, Number(effect.auditRiskReductionPct || 0)), 0);
  if (reductionPct > 0) {
    risk *= 1 - reductionPct / 100;
  }
  return `${Math.max(0, Math.round(risk * 10) / 10)} %`;
}

function createBuildingActionUiFormatOptions(options = {}) {
  return {
    ...options,
    formatMoney: formatDistrictBuildingMoney,
    formatCooldown: formatDistrictBuildingCooldown,
    weaponLabels: ATTACK_WEAPON_LABELS,
    getResourceLabel: getProductionResourceLabel,
    normalizeResourceKey: normalizeProductionResourceColorKey
  };
}

export function createBuildingDetailStatRows({
  buildingName = "",
  mechanics = {},
  detailEntry = {},
  buildingProfile = {},
  playerHeat = 0,
  now = Date.now()
} = {}) {
  const buildingKey = normalizeBuildingLookupKey(buildingName);
  const statRows = [
    createStat("Čisté / hod", formatDistrictBuildingMoney(mechanics.cleanHourly)),
    createStat("Špinavé / hod", formatDistrictBuildingMoney(mechanics.dirtyHourly)),
    createStat("Heat / den", `+${mechanics.dailyHeat}`),
    createStat("Vliv / den", `+${mechanics.dailyInfluence}`),
    createStat("Zóna", DISTRICT_BUILDING_TYPE_META[buildingProfile?.typeKey]?.shortLabel || "District"),
    createStat("Tier", formatDistrictBuildingTierLabel(buildingProfile?.tier || "mid")),
    createStat("Připraveno", mechanics.storedOutputLabel),
    createStat("Upgrade", mechanics.nextLevel ? `${mechanics.upgradeCostLabel} -> L${mechanics.nextLevel}` : "Max level")
  ];

  if (mechanics.mechanicsType === "casino") {
    statRows.splice(0, statRows.length,
      createStat("Čisté / min", `+${formatDistrictBuildingMoney(mechanics.cleanHourly / 60)}`),
      createStat("Dirty / min", `+${formatDistrictBuildingMoney(mechanics.dirtyHourly / 60)}`),
      createStat("Heat / min", `+${(mechanics.dailyHeat / 1440).toFixed(3)}`),
      createStat("Kapacita praní", formatDistrictBuildingMoney(mechanics.casinoLaunderingCapacity)),
      createStat("Poplatek", `${mechanics.casinoLaunderingFeePct}%`),
      createStat("Audit risk", getCasinoClientAuditRisk(detailEntry, playerHeat, now)),
      createStat("Upgrade", mechanics.nextLevel ? `${mechanics.upgradeCostLabel} -> L${mechanics.nextLevel}` : "Max level")
    );
  } else if (mechanics.mechanicsType === "apartment-block") {
    statRows.splice(0, statRows.length,
      createStat("Obyvatelé", `${mechanics.apartmentWholePopulation}/${mechanics.apartmentCapacity}`),
      createStat("Populace / min", `+${mechanics.apartmentPopulationPerMinute.toFixed(2)}`),
      createStat("Do naplnění", mechanics.apartmentIsFull ? "Plná kapacita" : formatDistrictBuildingCooldown(mechanics.apartmentTimeToFullMs)),
      createStat("Bytové bloky", `${mechanics.ownedApartmentBlocks}/29`),
      createStat("Produkce network", `x${mechanics.apartmentNetwork.populationProductionMultiplier.toFixed(2)}`),
      createStat("Kapacita network", `x${mechanics.apartmentNetwork.capacityMultiplier.toFixed(2)}`),
      createStat("Cash / dirty / heat", "0 / 0 / 0"),
      createStat("Upgrade", "Bez upgradu")
    );
  } else if (mechanics.mechanicsType === "school") {
    statRows.splice(0, statRows.length,
      createStat("Clean / min", `+${formatDistrictBuildingMoney(mechanics.cleanHourly / 60)}`),
      createStat("Studenti", `${mechanics.schoolWholeStudents}/${mechanics.schoolCapacity}`),
      createStat("Do naplnění", mechanics.schoolIsFull ? "Plná kapacita" : formatDistrictBuildingCooldown(mechanics.schoolTimeToFullMs)),
      createStat("Talent", `${mechanics.schoolTalentChancePct}%`),
      createStat("Školy", `${mechanics.ownedSchools}/${SCHOOL_CONFIG.countOnMap}`)
    );
  } else if (mechanics.mechanicsType === "exchange") {
    statRows.splice(0, statRows.length,
      createStat("Čisté / min", `+${formatDistrictBuildingMoney(mechanics.cleanHourly / 60)}`),
      createStat("Dirty / min", `+${formatDistrictBuildingMoney(mechanics.dirtyHourly / 60)}`),
      createStat("Heat / min", `+${(mechanics.dailyHeat / 1440).toFixed(3)}`),
      createStat("Směnárny", `${mechanics.ownedExchangeOffices}/13`),
      createStat("Síť", `income x${mechanics.exchangeNetwork.incomeMultiplier.toFixed(2)} · limit x${mechanics.exchangeNetwork.launderingLimitMultiplier.toFixed(2)}`),
      createStat("Kapacita praní", formatDistrictBuildingMoney(mechanics.exchangeLaunderingCapacity)),
      createStat("Audit risk", mechanics.exchangeAuditRisk),
      createStat("Upgrade", mechanics.nextLevel ? `${mechanics.upgradeCostLabel} -> L${mechanics.nextLevel}` : "Max level")
    );
  } else if (mechanics.mechanicsType === "arcade") {
    statRows.splice(0, statRows.length,
      createStat("Clean / min", `+${formatDistrictBuildingMoney(mechanics.cleanHourly / 60)}`),
      createStat("Dirty / min", `+${formatDistrictBuildingMoney(mechanics.dirtyHourly / 60)}`),
      createStat("Heat / min", `+${(mechanics.dailyHeat / 1440).toFixed(3)}`),
      createStat("Herny", `${mechanics.ownedArcades}/20`),
      createStat("Kapacita praní", formatDistrictBuildingMoney(mechanics.arcadeLaunderingCapacity)),
      createStat("Audit risk", mechanics.arcadeAuditRisk)
    );
  } else if (mechanics.mechanicsType === "warehouse") {
    statRows.splice(0, statRows.length,
      createStat("Čisté / min", `+${formatDistrictBuildingMoney(45 * mechanics.warehouseNetwork.incomeMultiplier)}`),
      createStat("Heat / min", `+${(0.06 * mechanics.warehouseNetwork.heatMultiplier).toFixed(3)}`),
      createStat("Sklady", `${mechanics.ownedWarehouses}/18`),
      createStat("Síť skladu", `income x${mechanics.warehouseNetwork.incomeMultiplier.toFixed(2)} · kapacita x${mechanics.warehouseNetwork.storageCapacityMultiplier.toFixed(2)}`),
      createStat("Kapacita zásob", `+${mechanics.warehouseCapacity.genericResources}`),
      createStat("Dirty / vliv", "0 / 0"),
      createStat("Akce", "Žádné")
    );
  } else if (mechanics.mechanicsType === "clinic") {
    statRows.splice(0, statRows.length,
      createStat("Clean / min", `+${formatDistrictBuildingMoney(55 * mechanics.clinicNetwork.incomeMultiplier)}`),
      createStat("Heat / min", `+${(0.03 * mechanics.clinicNetwork.heatMultiplier).toFixed(3)}`),
      createStat("Recovery rate", `${mechanics.clinicRecoveryRatePct} %`),
      createStat("Recovery pool", `${mechanics.clinicRecoveryPool.totalFreshAmount} položek`),
      createStat("Kliniky", `${mechanics.ownedClinics}/14`)
    );
  } else if (mechanics.mechanicsType === "recruitment-center") {
    statRows.splice(0, statRows.length,
      createStat("Clean / min", `+${formatDistrictBuildingMoney(mechanics.cleanHourly / 60)}`),
      createStat("Heat / min", `+${(mechanics.dailyHeat / 1440).toFixed(3)}`),
      createStat("Úkol", "posílit gang"),
      createStat("Akce", "pasivní")
    );
  } else if (mechanics.mechanicsType === "garage") {
    statRows.splice(0, statRows.length,
      createStat("Clean / min", `+${formatDistrictBuildingMoney(mechanics.cleanHourly / 60)}`),
      createStat("Heat / min", `+${(mechanics.dailyHeat / 1440).toFixed(3)}`),
      createStat("Garáže", `${mechanics.ownedGarages}/${GARAGE_SUPPORT_CONFIG.countOnMap}`),
      createStat("Cooldowny", `-${mechanics.garageSupport.cooldownReductionPct}%`)
    );
  } else if (mechanics.mechanicsType === "retail" || buildingKey === "obchodni centrum") {
    statRows.splice(0, statRows.length,
      createStat("Market sleva", `${mechanics.shoppingMallMarketDiscount.discountPct}%`),
      createStat("Černý market", `${mechanics.shoppingMallBlackMarketDiscount.discountPct}%`),
      createStat("Poplatky", `-${mechanics.shoppingMallMarketDiscount.feeReductionPct}%`),
      createStat("Vlastněné mally", `${mechanics.ownedShoppingMalls}/${SHOPPING_MALL_NETWORK_CONFIG.countOnMap}`),
      createStat("Čistý výnos", `x${mechanics.shoppingMallNetwork.cleanIncomeMultiplier.toFixed(2)}`),
      createStat("Dirty výnos", `x${mechanics.shoppingMallNetwork.dirtyIncomeMultiplier.toFixed(2)}`),
      createStat("Vliv / heat", `x${mechanics.shoppingMallNetwork.influenceMultiplier.toFixed(2)} / x${mechanics.shoppingMallNetwork.heatMultiplier.toFixed(2)}`)
    );
  } else if (mechanics.mechanicsType === "auto-salon" || buildingKey === "autosalon") {
    statRows.splice(0, statRows.length,
      createStat("Čisté / min", `+${formatDistrictBuildingMoney(mechanics.cleanHourly / 60)}`),
      createStat("Špinavé / min", `+${formatDistrictBuildingMoney(mechanics.dirtyHourly / 60)}`),
      createStat("Heat / min", `+${(mechanics.dailyHeat / 1440).toFixed(3)}`),
      createStat("Autosalony", `${mechanics.ownedAutoSalons}/${AUTO_SALON_SUPPORT_CONFIG.countOnMap}`),
      createStat("Čisté peníze", `x${mechanics.autoSalonNetwork.cleanIncomeMultiplier.toFixed(2)}`),
      createStat("Špinavé peníze", `x${mechanics.autoSalonNetwork.dirtyIncomeMultiplier.toFixed(2)}`),
      createStat("Mobilita", `+${mechanics.autoSalonSupport.mobilityBonusPct}%`),
      createStat("Cooldown", `-${mechanics.autoSalonSupport.cooldownReductionPct}%`),
      createStat("Únik", `+${mechanics.autoSalonSupport.escapeChanceBonusPct}%`),
      createStat("Cooldown cap", `-${mechanics.autoSalonSupport.combinedGarageDealerMaxReductionPct}%`)
    );
  } else if (mechanics.mechanicsType === "fitness-club" || buildingKey === "fitness club") {
    statRows.splice(0, statRows.length,
      createStat("Čisté / min", `+${formatDistrictBuildingMoney(mechanics.cleanHourly / 60)}`),
      createStat("Heat / min", `+${(mechanics.dailyHeat / 1440).toFixed(3)}`),
      createStat("Fitness cluby", `${mechanics.ownedFitnessClubs}/${FITNESS_CLUB_SUPPORT_CONFIG.countOnMap}`),
      createStat("Síť výnosu", `x${mechanics.fitnessClubNetwork.incomeMultiplier.toFixed(2)}`),
      createStat("Síť heatu", `x${mechanics.fitnessClubNetwork.heatMultiplier.toFixed(2)}`),
      createStat("Útok", `+${mechanics.fitnessClubSupport.attackStrengthBonusPct}%`),
      createStat("Obrana", `+${mechanics.fitnessClubSupport.defenseStrengthBonusPct}%`),
      createStat("Cap s rekrutací", `+${mechanics.fitnessClubSupport.combinedRecruitmentFitnessAttackCapPct}% / +${mechanics.fitnessClubSupport.combinedRecruitmentFitnessDefenseCapPct}%`)
    );
  } else if (mechanics.mechanicsType === "restaurant" || buildingKey === "restaurace") {
    statRows.splice(0, statRows.length,
      createStat("Čisté / min", `+${formatDistrictBuildingMoney(mechanics.cleanHourly / 60)}`),
      createStat("Dirty / min", `+${formatDistrictBuildingMoney(mechanics.dirtyHourly / 60)}`),
      createStat("Heat / min", `+${(mechanics.dailyHeat / 1440).toFixed(3)}`),
      createStat("Vliv / den", `+${mechanics.dailyInfluence}`),
      createStat("Akce", "tržby / schůzky / síť"),
      createStat("Upgrade", mechanics.nextLevel ? `${mechanics.upgradeCostLabel} -> L${mechanics.nextLevel}` : "Max level")
    );
  } else if (mechanics.mechanicsType === "power-plant" || buildingKey === "energeticka stanice") {
    statRows.splice(0, statRows.length,
      createStat("Čisté / min", `+${formatDistrictBuildingMoney(mechanics.cleanHourly / 60)}`),
      createStat("Dirty / min", `+${formatDistrictBuildingMoney(mechanics.dirtyHourly / 60)}`),
      createStat("Heat / min", `+${(mechanics.dailyHeat / 1440).toFixed(3)}`),
      createStat("Vliv / den", `+${mechanics.dailyInfluence}`),
      createStat("Akce", "síť / výroba / výpadky"),
      createStat("Upgrade", mechanics.nextLevel ? `${mechanics.upgradeCostLabel} -> L${mechanics.nextLevel}` : "Max level")
    );
  } else if (mechanics.mechanicsType === "recycling-center" || buildingKey === "recyklacni centrum") {
    statRows.splice(0, statRows.length,
      createStat("Čisté / min", `+${formatDistrictBuildingMoney(mechanics.cleanHourly / 60)}`),
      createStat("Heat / min", `+${(mechanics.dailyHeat / 1440).toFixed(3)}`),
      createStat("Vliv / den", `+${mechanics.dailyInfluence}`),
      createStat("Akce", "salvage pool"),
      createStat("Nevrací", "lidi ani populaci"),
      createStat("Upgrade", mechanics.nextLevel ? `${mechanics.upgradeCostLabel} -> L${mechanics.nextLevel}` : "Max level")
    );
  } else if (mechanics.mechanicsType === "street-dealers" || buildingKey === "poulicni dealeri") {
    statRows.splice(0, statRows.length,
      createStat("Dirty / min", `+${formatDistrictBuildingMoney(mechanics.dirtyHourly / 60)}`),
      createStat("Heat / min", `+${(mechanics.dailyHeat / 1440).toFixed(3)}`),
      createStat("Vliv / den", `+${mechanics.dailyInfluence}`),
      createStat("Zdroj", "produkty z Labu"),
      createStat("Akce", "prodej / cash / stash"),
      createStat("Upgrade", mechanics.nextLevel ? `${mechanics.upgradeCostLabel} -> L${mechanics.nextLevel}` : "Max level")
    );
  } else if (mechanics.mechanicsType === "convenience-store" || buildingKey === "vecerka") {
    statRows.splice(0, statRows.length,
      createStat("Čisté / min", `+${formatDistrictBuildingMoney(mechanics.cleanHourly / 60)}`),
      createStat("Dirty / min", `+${formatDistrictBuildingMoney(mechanics.dirtyHourly / 60)}`),
      createStat("Heat / min", `+${(mechanics.dailyHeat / 1440).toFixed(3)}`),
      createStat("Vliv / den", `+${mechanics.dailyInfluence}`),
      createStat("Drby", "pasivní ulice"),
      createStat("Akce", "Žádné")
    );
  } else if (mechanics.mechanicsType === "strip-club" || buildingKey === "strip club") {
    statRows.splice(0, statRows.length,
      createStat("Čisté / min", `+${formatDistrictBuildingMoney(mechanics.cleanHourly / 60)}`),
      createStat("Dirty / min", `+${formatDistrictBuildingMoney(mechanics.dirtyHourly / 60)}`),
      createStat("Heat / min", `+${(mechanics.dailyHeat / 1440).toFixed(3)}`),
      createStat("Vliv / den", `+${mechanics.dailyInfluence}`),
      createStat("Akce", "cash / VIP / kompromat"),
      createStat("Upgrade", mechanics.nextLevel ? `${mechanics.upgradeCostLabel} -> L${mechanics.nextLevel}` : "Max level")
    );
  } else if (mechanics.mechanicsType === "smuggling-tunnel") {
    statRows.splice(0, statRows.length,
      createStat("Dirty / min", `+${formatDistrictBuildingMoney(mechanics.smugglingDirtyPerMinute)}`),
      createStat("Heat / min", `+${(mechanics.dailyHeat / 1440).toFixed(3)}`),
      createStat("Tunely", `${mechanics.ownedSmugglingTunnels}/${SMUGGLING_TUNNEL_CONFIG.countOnMap}`),
      createStat("Síť dirty", `x${mechanics.smugglingTunnelNetwork.dirtyProductionMultiplier.toFixed(2)}`),
      createStat("Síť heat", `x${(mechanics.smugglingTunnelNetwork.heatMultiplier || mechanics.smugglingTunnelNetwork.passiveHeatMultiplier).toFixed(2)}`),
      createStat("Dealer Supply", `+${mechanics.smugglingDealerSupplyBonusPct}%`),
      createStat("Kanál", mechanics.smugglingOpenChannelActive ? formatDistrictBuildingCooldown(mechanics.smugglingOpenChannelRemainingMs) : "Neaktivní")
    );
  }

  return statRows;
}

export function createBuildingDetailMechanicRows({
  buildingName = "",
  mechanics = {}
} = {}) {
  const buildingKey = normalizeBuildingLookupKey(buildingName);
  const mechanicRows = [];
  if (mechanics.mechanicsType === "apartment-block") {
    mechanicRows.push(
      createMechanic("Lokální zásobník", `${mechanics.apartmentWholePopulation}/${mechanics.apartmentCapacity}`),
      createMechanic("Produkce", `+${mechanics.apartmentPopulationPerMinute.toFixed(2)} obyv./min`)
    );
  } else if (mechanics.mechanicsType === "school") {
    mechanicRows.push(
      createMechanic("Produkce", `+${mechanics.schoolPopulationPerMinute.toFixed(2)} studentů/min`),
      createMechanic("Síť škol", `kapacita x${mechanics.schoolNetwork.studentCapacityMultiplier.toFixed(2)} · income x${mechanics.schoolNetwork.incomeMultiplier.toFixed(2)}`),
      createMechanic("Večerní kurz", mechanics.schoolEveningCourseActive ? `aktivní ${formatDistrictBuildingCooldown(mechanics.schoolEveningCourseRemainingMs)}` : "akce zrychlí studenty a talenty"),
      createMechanic("Pravidla", "žádný dirty cash · žádný heat · žádné praní")
    );
  } else if (mechanics.mechanicsType === "warehouse") {
    mechanicRows.push(
      createMechanic("Materiály", `chem ${mechanics.warehouseUsage.chemicals}/${mechanics.warehouseCapacity.chemicals} · bio ${mechanics.warehouseUsage.biomass}/${mechanics.warehouseCapacity.biomass}`),
      createMechanic("Průmysl", `metal ${mechanics.warehouseUsage.metalParts}/${mechanics.warehouseCapacity.metalParts} · tech ${mechanics.warehouseUsage.techCore}/${mechanics.warehouseCapacity.techCore}`),
      createMechanic("Výzbroj", `boosty/drogy ${mechanics.warehouseUsage.drugsAndBoosts}/${mechanics.warehouseCapacity.drugsAndBoosts} · zbraně ${mechanics.warehouseUsage.weaponsAndDefense}/${mechanics.warehouseCapacity.weaponsAndDefense}`),
      createMechanic("Kapacita", mechanics.warehouseWarnings.join(" · ") || "Kapacity jsou v pořádku.")
    );
  } else if (mechanics.mechanicsType === "clinic") {
    mechanicRows.push(
      createMechanic("Stabilizace", mechanics.clinicRecoveryPool.totalFreshAmount > 0 ? "připravená" : "čeká na čerstvé ztráty"),
      createMechanic("Expirace poolu", mechanics.clinicRecoveryPool.nextExpiryMs ? formatDistrictBuildingCooldown(mechanics.clinicRecoveryPool.nextExpiryMs) : "nic nečeká"),
      createMechanic("Síť klinik", `income x${mechanics.clinicNetwork.incomeMultiplier.toFixed(2)} · heat x${mechanics.clinicNetwork.heatMultiplier.toFixed(2)}`),
      createMechanic("Pravidla", "žádný dirty cash · žádné praní · žádný audit")
    );
  } else if (mechanics.mechanicsType === "recruitment-center") {
    mechanicRows.push(
      createMechanic("Populace", "zlepšuje tempo a kapacitu bytových bloků"),
      createMechanic("Útok", "posiluje efekt zbraní v boji"),
      createMechanic("Obrana", "zvedá hodnotu obranného vybavení"),
      createMechanic("Pravidla", "bez dirty cash · bez praní · bez speciální akce")
    );
  } else if (mechanics.mechanicsType === "garage") {
    mechanicRows.push(
      createMechanic("Síť garáží", `income x${mechanics.garageNetwork.incomeMultiplier.toFixed(2)} · heat x${mechanics.garageNetwork.heatMultiplier.toFixed(2)}`),
      createMechanic("Plný bonus", "pohyb, útok, obsazení, přesuny, obrana"),
      createMechanic("Poloviční bonus", "špionáž, pasti, klinika, továrna, zbrojovka"),
      createMechanic("Bez bonusu", "praní peněz, VIP, drby, pasivní produkce")
    );
  } else if (mechanics.mechanicsType === "retail" || buildingKey === "obchodni centrum") {
    mechanicRows.push(
      createMechanic("Market sleva", `${mechanics.shoppingMallMarketDiscount.discountPct}% regular · ${mechanics.shoppingMallBlackMarketDiscount.discountPct}% black market`),
      createMechanic("Poplatky", `-${mechanics.shoppingMallMarketDiscount.feeReductionPct}% market fees`),
      createMechanic("Síť", `${mechanics.ownedShoppingMalls}/${SHOPPING_MALL_NETWORK_CONFIG.countOnMap} obchodních center`),
      createMechanic("Výnos", `clean x${mechanics.shoppingMallNetwork.cleanIncomeMultiplier.toFixed(2)} · dirty x${mechanics.shoppingMallNetwork.dirtyIncomeMultiplier.toFixed(2)}`),
      createMechanic("Vliv / heat", `vliv x${mechanics.shoppingMallNetwork.influenceMultiplier.toFixed(2)} · heat x${mechanics.shoppingMallNetwork.heatMultiplier.toFixed(2)}`)
    );
  } else if (mechanics.mechanicsType === "auto-salon" || buildingKey === "autosalon") {
    mechanicRows.push(
      createMechanic("Plný bonus", formatBuildingActionCategoryLabels(AUTO_SALON_SUPPORT_CONFIG.fullBonusCategories)),
      createMechanic("Částečný bonus", formatBuildingActionCategoryLabels(AUTO_SALON_SUPPORT_CONFIG.halfBonusCategories.concat(AUTO_SALON_SUPPORT_CONFIG.smallBonusCategories))),
      createMechanic("Mobilita", `+${mechanics.autoSalonSupport.mobilityBonusPct}% pro přesuny a návraty`),
      createMechanic("Únik", `+${mechanics.autoSalonSupport.escapeChanceBonusPct}% lepší výsledek, ne jistota`),
      createMechanic("Mimo bonus", formatBuildingActionCategoryLabels(AUTO_SALON_SUPPORT_CONFIG.excludedCategories))
    );
  } else if (mechanics.mechanicsType === "fitness-club" || buildingKey === "fitness club") {
    mechanicRows.push(
      createMechanic("Útok 100 %", "gang a baseballová pálka"),
      createMechanic("Útok část", "pistole 50 % · granát 25 % · samopal 40 % · bazuka 15 %"),
      createMechanic("Obrana", "gang 100 % · vesta 60 % · barikády 35 %"),
      createMechanic("Bez bonusu", "kamery · alarm · kulometné stanoviště")
    );
  } else if (mechanics.mechanicsType === "restaurant" || buildingKey === "restaurace") {
    mechanicRows.push(
      createMechanic("Tržby", "přímý lokální clean a dirty příjem"),
      createMechanic("Schůzky", "dočasně zvednou income a přidají vliv"),
      createMechanic("Lokální síť", "krátký vlivový boost districtu"),
      createMechanic("Riziko", "akce přidávají heat")
    );
  } else if (mechanics.mechanicsType === "casino") {
    mechanicRows.push(
      createMechanic("Tichá herna", "pere část dirty cash za fee"),
      createMechanic("VIP noc", "dočasně zvedne income, vliv i heat"),
      createMechanic("Inspektor", "drahá ochrana s rizikem selhání"),
      createMechanic("Riziko", "vysoký heat a audit risk při praní")
    );
  } else if (mechanics.mechanicsType === "exchange") {
    mechanicRows.push(
      createMechanic("Výhodný kurz", "pere menší část dirty cash za fee"),
      createMechanic("Síť směnáren", `income x${mechanics.exchangeNetwork.incomeMultiplier.toFixed(2)} · limit x${mechanics.exchangeNetwork.launderingLimitMultiplier.toFixed(2)}`),
      createMechanic("Heat", `akce i síť drží heat x${mechanics.exchangeNetwork.heatMultiplier.toFixed(2)}`),
      createMechanic("Audit", `${mechanics.exchangeAuditRisk} · kontrola v časovém okně`)
    );
  } else if (mechanics.mechanicsType === "power-plant" || buildingKey === "energeticka stanice") {
    mechanicRows.push(
      createMechanic("Stabilizovat síť", "dočasně zvedne income districtu"),
      createMechanic("Napájet výrobu", "posílí čistý výrobní výkon"),
      createMechanic("Snížit výpadky", "okamžitě sníží heat"),
      createMechanic("Pravidla", "infrastruktura bez skladu, praní a populace")
    );
  } else if (mechanics.mechanicsType === "recycling-center" || buildingKey === "recyklacni centrum") {
    mechanicRows.push(
      createMechanic("Vytěžit ztráty", "vrací část itemových ztrát ze salvage poolu"),
      createMechanic("Nevrací", "populaci ani členy gangu"),
      createMechanic("Materiály", "železo, zbraně, moduly a obranné vybavení podle ztrát"),
      createMechanic("Riziko", "akce stojí clean cash a přidá heat")
    );
  } else if (mechanics.mechanicsType === "street-dealers" || buildingKey === "poulicni dealeri") {
    mechanicRows.push(
      createMechanic("Distribuce", "mění lab produkty na dirty cash"),
      createMechanic("Prodej", "spustí krátký dirty cash boost"),
      createMechanic("Stash", "může přesunout biomass do zásob"),
      createMechanic("Riziko", "prodej a stash přidávají heat")
    );
  } else if (mechanics.mechanicsType === "convenience-store" || buildingKey === "vecerka") {
    mechanicRows.push(
      createMechanic("Cashflow", "malý clean a dirty příjem"),
      createMechanic("Drby", "lokální pouliční signál pro district"),
      createMechanic("Vliv", "drobný pasivní vliv z provozu"),
      createMechanic("Pravidla", "bez speciální akce, praní a auditu")
    );
  } else if (mechanics.mechanicsType === "strip-club" || buildingKey === "strip club") {
    mechanicRows.push(
      createMechanic("Noční cash", "přímý dirty výběr"),
      createMechanic("VIP klienti", "dočasně zvednou income a vliv"),
      createMechanic("Kompromat", "přidá vliv za heat"),
      createMechanic("Riziko", "noční provoz zvedá tlak districtu")
    );
  } else if (mechanics.mechanicsType === "smuggling-tunnel") {
    mechanicRows.push(
      createMechanic("Dealer Supply", `sale price +${mechanics.smugglingDealerSupplyBonusPct * SMUGGLING_TUNNEL_CONFIG.dealerSupplySalePriceSharePct / 100}% · speed +${mechanics.smugglingDealerSupplyBonusPct * SMUGGLING_TUNNEL_CONFIG.dealerSupplySaleSpeedSharePct / 100}%`),
      createMechanic("Street risk", `-${mechanics.smugglingDealerSupplyBonusPct * SMUGGLING_TUNNEL_CONFIG.dealerSupplyStreetRiskReductionSharePct / 100}% relativně · heat +${mechanics.smugglingDealerSupplyBonusPct * SMUGGLING_TUNNEL_CONFIG.dealerSupplySaleHeatRiskSharePct / 100}%`),
      createMechanic("Otevřít kanál", mechanics.smugglingOpenChannelActive ? `Aktivní ${formatDistrictBuildingCooldown(mechanics.smugglingOpenChannelRemainingMs)}` : `Cena ${formatDistrictBuildingMoney(SMUGGLING_TUNNEL_CONFIG.openChannelDirtyCost)} dirty`),
      createMechanic("Boost risk", `heat +${SMUGGLING_TUNNEL_CONFIG.openChannelHeatGain} · incident risk +${SMUGGLING_TUNNEL_CONFIG.openChannelStreetIncidentFlatRiskPct}%`),
      createMechanic("Pravidla", "Pouze dirty cash a heat; žádné clean, vliv, populace, Intel, praní ani audit")
    );
  } else if (mechanics.mechanicsType === "arcade") {
    mechanicRows.push(
      createMechanic("Síť heren", `income x${mechanics.arcadeNetwork.incomeMultiplier.toFixed(2)} · limit x${mechanics.arcadeNetwork.launderingLimitMultiplier.toFixed(2)}`),
      createMechanic("Noční automaty", "dočasně zvednou income, vliv, heat a audit risk"),
      createMechanic("Zadní pokladna", "pere část dirty cash za fee"),
      createMechanic("Riziko", `audit ${mechanics.arcadeAuditRisk} · heat z akcí`)
    );
  } else {
    mechanicRows.push(
      createMechanic("Výnos", `${formatDistrictBuildingMoney(mechanics.cleanHourly + mechanics.dirtyHourly)} / hod`),
      createMechanic("Income", "Automaticky do zdrojů")
    );
    if (mechanics.hasManualCollect) {
      mechanicRows.push(createMechanic("Collect", mechanics.canCollect ? "Připraveno" : "Čeká na výstup"));
    }
    mechanicRows.push(createMechanic("Cooldown akce", formatDistrictBuildingCooldown(DISTRICT_BUILDING_DETAIL_ACTION_COOLDOWN_MS)));
  }
  return mechanicRows;
}

export function createBuildingDetailActionRows({
  buildingName = "",
  profile = {},
  mechanics = {},
  detailEntry = {},
  economyState = {},
  actionProfiles = [],
  now = Date.now()
} = {}) {
  return (Array.isArray(profile.actions) ? profile.actions : []).map((action, actionIndex) => {
    const cooldownUntil = Number(mechanics.actionCooldowns?.[actionIndex] || 0);
    const cooldownRemaining = Math.max(0, cooldownUntil - now);
    const actionProfile = actionProfiles[actionIndex] || null;
    const actionUiOptions = createBuildingActionUiFormatOptions({
      mechanics,
      buildingType: buildingName,
      actionIndex,
      actionProfile
    });
    const casinoDisabledReason = actionProfile?.casinoQuietBackroom && Number(economyState.dirtyMoney || 0) < Number(actionProfile.minimumDirty || 0)
      ? `Potřebuješ ${formatDistrictBuildingMoney(actionProfile.minimumDirty)} dirty cash.`
      : actionProfile?.exchangeOfficeGoodRate && Number(economyState.dirtyMoney || 0) < Number(actionProfile.minimumDirty || 0)
        ? `Potřebuješ ${formatDistrictBuildingMoney(actionProfile.minimumDirty)} dirty cash.`
      : actionProfile?.arcadeBackCashdesk && Number(economyState.dirtyMoney || 0) < Number(actionProfile.minimumDirty || 0)
        ? `Potřebuješ ${formatDistrictBuildingMoney(actionProfile.minimumDirty)} dirty cash.`
      : actionProfile?.casinoBribedInspector && Number(economyState.cleanMoney || 0) < Number(actionProfile.cleanCost || 0)
        ? `Potřebuješ ${formatDistrictBuildingMoney(actionProfile.cleanCost)} clean cash.`
      : actionProfile?.apartmentCollectPopulation && mechanics.apartmentWholePopulation <= 0
        ? "Bytový blok zatím nemá obyvatele k vybrání."
      : actionProfile?.smugglingOpenChannel && Number(economyState.dirtyMoney || 0) < SMUGGLING_TUNNEL_CONFIG.openChannelDirtyCost
        ? `Potřebuješ ${formatDistrictBuildingMoney(SMUGGLING_TUNNEL_CONFIG.openChannelDirtyCost)} dirty cash.`
      : actionProfile?.smugglingOpenChannel && mechanics.smugglingOpenChannelActive
        ? `Otevřený kanál běží. Zbývá ${formatDistrictBuildingCooldown(mechanics.smugglingOpenChannelRemainingMs)}.`
      : actionProfile?.schoolEveningCourse && Number(economyState.cleanMoney || 0) < Number(actionProfile.cleanCost || 0)
        ? `Potřebuješ ${formatDistrictBuildingMoney(actionProfile.cleanCost)} clean cash.`
      : actionProfile?.schoolEveningCourse && mechanics.schoolEveningCourseActive
        ? `Večerní kurz běží. Zbývá ${formatDistrictBuildingCooldown(mechanics.schoolEveningCourseRemainingMs)}.`
      : actionProfile?.clinicStabilizationProtocol && Number(economyState.cleanMoney || 0) < Number(actionProfile.cleanCost || 0)
        ? `Potřebuješ ${formatDistrictBuildingMoney(actionProfile.cleanCost)} clean cash.`
      : actionProfile?.clinicStabilizationProtocol && (!mechanics.clinicRecoveryPool || mechanics.clinicRecoveryPool.fresh.length <= 0)
        ? "Recovery pool je prázdný."
      : actionProfile?.recyclingExtractLosses
        ? "Salvage pool je prázdný. Recyklační centrum nevrací členy gangu ani populaci."
      : "";
    const activeSameCasinoBoost = actionProfile?.casinoVipNight
      && detailEntry.activeEffects?.some((effect) => effect.label === action && Number(effect.expiresAt || 0) > now);
    const activeSameArcadeBoost = actionProfile?.arcadeNightMachines
      && detailEntry.activeEffects?.some((effect) => effect.label === action && Number(effect.expiresAt || 0) > now);
    const activeBoostRemainingMs = activeSameCasinoBoost || activeSameArcadeBoost
      ? Number(detailEntry.activeEffects?.find((effect) => effect.label === action)?.expiresAt || 0) - now
      : 0;
    const actionUi = getBuildingActionUi(action, buildingName, {
      ...actionUiOptions,
      actionState: {
        disabledReason: casinoDisabledReason,
        activeBoostRemainingMs,
        formatCooldown: formatDistrictBuildingCooldown
      }
    });
    const activeBoostDescription = activeSameCasinoBoost || activeSameArcadeBoost
      ? getActionDisabledReason({
          activeBoostRemainingMs,
          formatCooldown: formatDistrictBuildingCooldown
        })
      : "";
    return {
      index: actionIndex,
      title: actionUi.label,
      disabled: cooldownRemaining > 0 || Boolean(activeSameCasinoBoost) || Boolean(activeSameArcadeBoost) || Boolean(casinoDisabledReason),
      description: activeBoostDescription || actionUi.disabledReason || getActionDescription(action, actionUiOptions),
      cooldownLabel: cooldownRemaining > 0
        ? `Cooldown: ${formatDistrictBuildingCooldown(cooldownRemaining)}`
        : activeSameCasinoBoost
          ? "Aktivní boost"
          : activeSameArcadeBoost
            ? "Aktivní boost"
            : `Cooldown: ${formatDistrictBuildingCooldown(
                actionProfile && Object.prototype.hasOwnProperty.call(actionProfile, "cooldownMs") ? actionProfile.cooldownMs : DISTRICT_BUILDING_DETAIL_ACTION_COOLDOWN_MS
              )}`
    };
  });
}

export function createBuildingDetailViewModel({
  district = null,
  buildingName = "",
  displayName = buildingName,
  profile = {},
  mechanics = {},
  detailEntry = {},
  buildingProfile = {},
  economyState = {},
  playerHeat = 0,
  actionProfiles = [],
  now = Date.now()
} = {}) {
  const focusedLabel = FOCUSED_BUILDING_DETAIL_LABELS[mechanics.mechanicsType] || "";
  const isGarage = mechanics.mechanicsType === "garage";
  const isFocusedBuilding = Boolean(focusedLabel);
  const districtType = String(buildingProfile?.typeKey || district?.districtType || "").trim().toLowerCase();
  const isDowntownBuilding = districtType === "downtown";
  const displayLabel = focusedLabel
    ? focusedLabel
    : String(displayName || buildingName || "Budova").trim() || "Budova";
  const showManualCollect = Boolean(mechanics.hasManualCollect);
  const hideUpgrade = isGarage;
  const collectTitle = showManualCollect
    ? (mechanics.canCollect
        ? `Vybrat připravený výstup: ${mechanics.storedOutputLabel}`
        : mechanics.mechanicsType === "school"
          ? "Škola zatím nemá celé studenty k vybrání."
          : mechanics.mechanicsType === "smuggling-tunnel"
            ? `V tunelu musí být alespoň ${formatDistrictBuildingMoney(SMUGGLING_TUNNEL_CONFIG.minCollectDirty)} dirty cash.`
            : "Populace zatím není připravená k vybrání.")
    : "";
  const metaText = isFocusedBuilding
    ? ""
    : [
      displayLabel !== buildingName ? buildingName : "",
      profile.role,
      district?.id ? `District ${district.id}` : "",
      buildingProfile?.setTitle || ""
    ].filter(Boolean).join(" · ");
  const badge = FOCUSED_BUILDING_DETAIL_BADGES[mechanics.mechanicsType] || profile.role;
  const suppressSinglePanelActions = SUPPRESS_SINGLE_PANEL_ACTIONS.has(mechanics.mechanicsType);

  return {
    title: displayLabel,
    badge,
    mechanicsType: mechanics.mechanicsType,
    districtType,
    isDowntownBuilding,
    levelLabel: `L${mechanics.level}`,
    name: displayLabel,
    meta: metaText,
    collect: {
      visible: showManualCollect,
      enabled: Boolean(mechanics.canCollect),
      title: collectTitle
    },
    upgrade: {
      visible: !hideUpgrade,
      disabled: hideUpgrade || !mechanics.nextLevel,
      title: mechanics.nextLevel
        ? `Upgrade na L${mechanics.nextLevel} za ${mechanics.upgradeCostLabel}`
        : hideUpgrade
          ? "Garáž je pasivní budova bez upgradu."
          : "Budova je na maximálním levelu."
    },
    stats: createBuildingDetailStatRows({ buildingName, mechanics, detailEntry, buildingProfile, playerHeat, now }),
    mechanics: createBuildingDetailMechanicRows({ buildingName, mechanics }),
    effectsLabel: mechanics.effectsLabel || "Žádné aktivní mechaniky.",
    intro: profile.info || "",
    showActionsInSinglePanel: !suppressSinglePanelActions,
    actions: suppressSinglePanelActions
      ? []
      : createBuildingDetailActionRows({ buildingName, profile, mechanics, detailEntry, economyState, actionProfiles, now })
  };
}

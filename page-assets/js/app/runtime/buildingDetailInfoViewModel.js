import { ATTACK_WEAPON_LABELS } from "./combatData.js";
import {
  AUTO_SALON_SUPPORT_CONFIG,
  DISTRICT_BUILDING_DETAIL_ACTION_COOLDOWN_MS,
  FITNESS_CLUB_SUPPORT_CONFIG,
  SHOPPING_MALL_NETWORK_CONFIG,
  SMUGGLING_TUNNEL_CONFIG
} from "./buildingDetailData.js";
import {
  formatDistrictBuildingCooldown,
  formatDistrictBuildingMoney
} from "./formatters.js";
import { PRODUCTION_RESOURCE_LABELS } from "./productionBuildingData.js";
import {
  formatBuildingActionCategoryLabels,
  formatBuildingActionOutputProfile,
  getActionDescription,
  getActionLabel
} from "../ui/buildingActionUiRegistry.js";
import { getCasinoClientAuditRisk } from "./buildingDetailViewModel.js";

function normalizeBuildingLookupKey(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function createInfoLine(label, value) {
  return { label, value };
}

function hasBuildingUpgradeCapability(mechanics = {}) {
  const maxLevel = Number(mechanics?.maxLevel);
  if (Number.isFinite(maxLevel)) {
    return maxLevel > 1;
  }
  return Boolean(mechanics?.nextLevel);
}

const SINGLE_PANEL_INFO_MECHANICS_TYPES = new Set([
  "apartment-block",
  "garage",
  "recruitment-center",
  "clinic",
  "arcade",
  "school",
  "restaurant",
  "fitness-club",
  "exchange",
  "auto-salon",
  "retail",
  "casino",
  "warehouse",
  "power-plant",
  "recycling-center",
  "street-dealers",
  "convenience-store",
  "smuggling-tunnel",
  "strip-club"
]);

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

function getNextLevelMultiplier(mechanics = {}) {
  if (!mechanics.nextLevel) {
    return null;
  }
  if (mechanics.mechanicsType === "casino") {
    return mechanics.nextCasinoUpgrade
      ? 1 + (mechanics.nextCasinoUpgrade.incomeBonusPct / 100)
      : null;
  }
  return 1 + ((mechanics.nextLevel - 1) * 0.14);
}

export function createBuildingDetailInfoRows({
  profile = {},
  mechanics = {},
  buildingName = "",
  entry = {},
  playerHeat = 0,
  now = Date.now()
} = {}) {
  const buildingKey = normalizeBuildingLookupKey(buildingName);
  const canUpgrade = hasBuildingUpgradeCapability(mechanics);
  const nextMultiplier = getNextLevelMultiplier(mechanics);
  const rows = [
    createInfoLine("Role", `${profile.role} · ${buildingName}`),
    createInfoLine("Pasivně", mechanics.effectsLabel || "Bez pasivního výstupu."),
    createInfoLine("Vybrání", mechanics.storedOutputLabel),
    createInfoLine("Riziko", `Heat +${mechanics.dailyHeat}/den · vliv +${mechanics.dailyInfluence}/den`)
  ];
  if (canUpgrade) {
    rows.splice(3, 0,
      createInfoLine("Upgrade", mechanics.nextLevel ? `${mechanics.upgradeCostLabel} -> L${mechanics.nextLevel}` : "Max level"),
      createInfoLine("Další level", nextMultiplier ? `Multiplier x${nextMultiplier.toFixed(2)}, vyšší výnos a akční hodnoty.` : "Budova už je na maximu.")
    );
  }

  if (SINGLE_PANEL_INFO_MECHANICS_TYPES.has(mechanics.mechanicsType) && mechanics.mechanicsType !== "apartment-block") {
    return [];
  }

  if (mechanics.mechanicsType === "casino") {
    const nextCasino = mechanics.nextCasinoUpgrade;
    rows.push(
      createInfoLine("Laundering kapacita", `${formatDistrictBuildingMoney(mechanics.casinoLaunderingCapacity)} dirty / akce`),
      createInfoLine("Poplatek", `${mechanics.casinoLaunderingFeePct} % z vyprané částky`),
      createInfoLine("Audit risk", `${getCasinoClientAuditRisk(entry, playerHeat, now)} · kontrola každých 5 min · okno 30 min`),
      createInfoLine("Další casino bonus", nextCasino ? `Income +${nextCasino.incomeBonusPct}% · limit +${nextCasino.launderingLimitBonusPct}% · fee -${nextCasino.launderingFeeReductionPct}% · heat akce -${nextCasino.actionHeatReductionPct}%` : "Max level bonus aktivní."),
      createInfoLine("Mapa", "Vzácná budova: 3x na mapě")
    );
  } else if (mechanics.mechanicsType === "exchange") {
    rows.push(
      createInfoLine("Vlastněné směnárny", `${mechanics.ownedExchangeOffices}/13`),
      createInfoLine("Network multiplier", `Income x${mechanics.exchangeNetwork.incomeMultiplier.toFixed(2)} · limit x${mechanics.exchangeNetwork.launderingLimitMultiplier.toFixed(2)} · heat x${mechanics.exchangeNetwork.heatMultiplier.toFixed(2)}`),
      createInfoLine("Laundering kapacita", `${formatDistrictBuildingMoney(mechanics.exchangeLaunderingCapacity)} dirty / akce`),
      createInfoLine("Audit risk", `${mechanics.exchangeAuditRisk} · kontrola každých 6 min · okno 30 min`),
      createInfoLine("Mapa", "Dostupná síťová budova: 13x na mapě")
    );
  } else if (mechanics.mechanicsType === "arcade") {
    return [];
  } else if (mechanics.mechanicsType === "apartment-block") {
    return [];
  } else if (mechanics.mechanicsType === "school") {
    return [
      createInfoLine("Výsledek talentu", "Úspěšný trénink: zapíše se do uličních zpráv."),
      createInfoLine("Pravidla", "Škola je podpůrná budova; autoritativní efekt dál potvrzuje server.")
    ];
  } else if (mechanics.mechanicsType === "warehouse") {
    rows.push(
      createInfoLine("Vlastněné sklady", `${mechanics.ownedWarehouses}/18`),
      createInfoLine("Network multiplier", `Income x${mechanics.warehouseNetwork.incomeMultiplier.toFixed(2)} · storage x${mechanics.warehouseNetwork.storageCapacityMultiplier.toFixed(2)} · heat x${mechanics.warehouseNetwork.heatMultiplier.toFixed(2)}`),
      createInfoLine("Kapacity", `Chem ${mechanics.warehouseCapacity.chemicals} · bio ${mechanics.warehouseCapacity.biomass} · metal ${mechanics.warehouseCapacity.metalParts} · tech ${mechanics.warehouseCapacity.techCore}`),
      createInfoLine("Výzbroj a balíky", `Boosty/drogy ${mechanics.warehouseCapacity.drugsAndBoosts} · zbraně/obrana ${mechanics.warehouseCapacity.weaponsAndDefense}`),
      createInfoLine("Warning", mechanics.warehouseWarnings.join(" · ") || "Kapacity jsou v pořádku."),
      createInfoLine("Pravidla", "Žádné dirty cash · žádný vliv · žádné akce · žádné praní · žádný audit")
    );
  } else if (mechanics.mechanicsType === "clinic") {
    return [];
  } else if (mechanics.mechanicsType === "garage") {
    return [];
  } else if (mechanics.mechanicsType === "recruitment-center") {
    return [];
  } else if (buildingKey === "obchodni centrum") {
    rows.push(
      createInfoLine("Vlastněné mally", `${mechanics.ownedShoppingMalls}/${SHOPPING_MALL_NETWORK_CONFIG.countOnMap}`),
      createInfoLine("Market sleva", `${mechanics.shoppingMallMarketDiscount.discountPct}% regular market · ${mechanics.shoppingMallBlackMarketDiscount.discountPct}% black market`),
      createInfoLine("Fee reduction", `-${mechanics.shoppingMallMarketDiscount.feeReductionPct}% market fees · minimální cena ${Math.round(mechanics.shoppingMallMarketDiscount.minFinalPriceMultiplier * 100)}%`),
      createInfoLine("Income network", `clean x${mechanics.shoppingMallNetwork.cleanIncomeMultiplier.toFixed(2)} · dirty x${mechanics.shoppingMallNetwork.dirtyIncomeMultiplier.toFixed(2)}`),
      createInfoLine("Vliv / heat", `vliv x${mechanics.shoppingMallNetwork.influenceMultiplier.toFixed(2)} · heat x${mechanics.shoppingMallNetwork.heatMultiplier.toFixed(2)}`),
      createInfoLine("Pasivní market bonus", "Sleva se aplikuje automaticky bez speciální akce."),
      createInfoLine("Pravidla", "Pasivní budova bez přímých akcí; bonus se projeví v marketu a server income projekci.")
    );
  } else if (buildingKey === "autosalon") {
    rows.push(
      createInfoLine("Síť autosalonů", `${mechanics.ownedAutoSalons}/${AUTO_SALON_SUPPORT_CONFIG.countOnMap} vlastněno`),
      createInfoLine("Výnos", `čisté x${mechanics.autoSalonNetwork.cleanIncomeMultiplier.toFixed(2)} · špinavé x${mechanics.autoSalonNetwork.dirtyIncomeMultiplier.toFixed(2)} · heat x${mechanics.autoSalonNetwork.heatMultiplier.toFixed(2)}`),
      createInfoLine("Mobilita a únik", `mobilita +${mechanics.autoSalonSupport.mobilityBonusPct}% · únik +${mechanics.autoSalonSupport.escapeChanceBonusPct}%`),
      createInfoLine("Cooldowny", `autosalon -${mechanics.autoSalonSupport.cooldownReductionPct}% · společný cap -${mechanics.autoSalonSupport.combinedGarageDealerMaxReductionPct}%`),
      createInfoLine("Kde pomáhá", formatBuildingActionCategoryLabels(AUTO_SALON_SUPPORT_CONFIG.fullBonusCategories.concat(AUTO_SALON_SUPPORT_CONFIG.halfBonusCategories, AUTO_SALON_SUPPORT_CONFIG.smallBonusCategories))),
      createInfoLine("Bez vlivu", formatBuildingActionCategoryLabels(AUTO_SALON_SUPPORT_CONFIG.excludedCategories)),
      createInfoLine("Pravidla", "Pasivní mobilita bez praní, auditu, vlivu, populace a Intel Power.")
    );
  } else if (buildingKey === "fitness club") {
    rows.push(
      createInfoLine("Síť fitness clubů", `${mechanics.ownedFitnessClubs}/${FITNESS_CLUB_SUPPORT_CONFIG.countOnMap} vlastněno`),
      createInfoLine("Výnos", `clean x${mechanics.fitnessClubNetwork.incomeMultiplier.toFixed(2)} · heat x${mechanics.fitnessClubNetwork.heatMultiplier.toFixed(2)}`),
      createInfoLine("Útok", `+${mechanics.fitnessClubSupport.attackStrengthBonusPct}% fyzická síla · cap s rekrutačním centrem +${mechanics.fitnessClubSupport.combinedRecruitmentFitnessAttackCapPct}%`),
      createInfoLine("Obrana", `+${mechanics.fitnessClubSupport.defenseStrengthBonusPct}% odolnost · cap s rekrutačním centrem +${mechanics.fitnessClubSupport.combinedRecruitmentFitnessDefenseCapPct}%`),
      createInfoLine("Platí na", "gang, pálky, pistole, granáty, samopaly, bazuky, vesty a barikády podle váhy"),
      createInfoLine("Bez bonusu", "bezpečnostní kamery, alarm a automatické kulometné stanoviště"),
      createInfoLine("Pravidla", "Žádné dirty cash, vliv, populace, Intel Power, praní, audit ani speciální akce.")
    );
  } else if (mechanics.mechanicsType === "smuggling-tunnel") {
    rows.push(
      createInfoLine("Dirty / min", `+${formatDistrictBuildingMoney(mechanics.smugglingDirtyPerMinute)}`),
      createInfoLine("Network multiplier", `dirty x${mechanics.smugglingTunnelNetwork.dirtyProductionMultiplier.toFixed(2)} · heat x${(mechanics.smugglingTunnelNetwork.heatMultiplier || mechanics.smugglingTunnelNetwork.passiveHeatMultiplier).toFixed(2)}`),
      createInfoLine("Vlastněné tunely", `${mechanics.ownedSmugglingTunnels}/${SMUGGLING_TUNNEL_CONFIG.countOnMap}`),
      createInfoLine("Dealer Supply", `+${mechanics.smugglingDealerSupplyBonusPct}% · price +${mechanics.smugglingDealerSupplyBonusPct * SMUGGLING_TUNNEL_CONFIG.dealerSupplySalePriceSharePct / 100}% · speed +${mechanics.smugglingDealerSupplyBonusPct * SMUGGLING_TUNNEL_CONFIG.dealerSupplySaleSpeedSharePct / 100}%`),
      createInfoLine("Kontraband Flow", mechanics.smugglingContrabandFlowLabel),
      createInfoLine("Otevřít kanál", mechanics.smugglingOpenChannelActive ? `Aktivní ještě ${formatDistrictBuildingCooldown(mechanics.smugglingOpenChannelRemainingMs)}` : `Cena ${formatDistrictBuildingMoney(SMUGGLING_TUNNEL_CONFIG.openChannelCleanCost)} clean · cooldown 30 min · incident risk +${SMUGGLING_TUNNEL_CONFIG.openChannelStreetIncidentFlatRiskPct}%`),
      createInfoLine("Pravidla", "Pouze dirty cash a heat; žádné clean cash, vliv, populace, Intel Power, praní ani audit")
    );
  }

  return rows;
}

export function createBuildingDetailInfoActionRows({
  profile = {},
  mechanics = {},
  buildingName = "",
  actionProfiles = []
} = {}) {
  return (Array.isArray(profile.actions) ? profile.actions : []).map((action, actionIndex) => {
    const actionProfile = actionProfiles[actionIndex] || null;
    const actionUiOptions = createBuildingActionUiFormatOptions({
      mechanics,
      buildingType: buildingName,
      actionIndex,
      actionProfile
    });
    return {
      title: getActionLabel(action),
      description: getActionDescription(action, actionUiOptions),
      result: [
        formatBuildingActionOutputProfile(actionProfile || {}, actionUiOptions),
        `Cooldown ${formatDistrictBuildingCooldown(actionProfile && Object.prototype.hasOwnProperty.call(actionProfile, "cooldownMs") ? actionProfile.cooldownMs : DISTRICT_BUILDING_DETAIL_ACTION_COOLDOWN_MS)}`
      ].join(" · ")
    };
  });
}

export function createBuildingDetailInfoViewModel({
  profile = {},
  mechanics = {},
  buildingName = "",
  entry = {},
  playerHeat = 0,
  actionProfiles = [],
  now = Date.now()
} = {}) {
  const isSinglePanelBuilding = SINGLE_PANEL_INFO_MECHANICS_TYPES.has(mechanics.mechanicsType);
  return {
    title: isSinglePanelBuilding ? "" : "Co hráč musí vědět",
    intro: profile.info,
    pinIntroToTop: isSinglePanelBuilding,
    rows: createBuildingDetailInfoRows({ profile, mechanics, buildingName, entry, playerHeat, now }),
    actionsTitle: isSinglePanelBuilding ? "" : "Akce",
    actions: isSinglePanelBuilding
      ? []
      : createBuildingDetailInfoActionRows({ profile, mechanics, buildingName, actionProfiles })
  };
}

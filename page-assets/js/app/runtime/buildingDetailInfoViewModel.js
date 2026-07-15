import { ATTACK_WEAPON_LABELS } from "./combatData.js";
import {
  AUTO_SALON_SUPPORT_CONFIG,
  DISTRICT_BUILDING_DETAIL_ACTION_COOLDOWN_MS,
  EXCHANGE_OFFICE_NETWORK_CONFIG,
  FITNESS_CLUB_SUPPORT_CONFIG,
  SMUGGLING_TUNNEL_CONFIG
} from "./buildingDetailData.js";
import {
  formatDistrictBuildingCooldown,
  formatDistrictBuildingMoney
} from "./formatters.js";
import {
  formatGarageEffectiveCooldownLabel,
  resolveAutoSalonCategoryForBuildingAction,
  resolveCombinedEffectiveCooldownMs,
  resolveGarageCategoryForBuildingAction
} from "./garageCooldownRuntime.js";
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

function formatMultiplierIncreasePercent(value = 1) {
  const multiplier = Number(value);
  if (!Number.isFinite(multiplier)) {
    return "+0 %";
  }
  const pct = Math.round((multiplier - 1) * 100);
  return `${pct >= 0 ? "+" : ""}${pct} %`;
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
      createInfoLine("Upgrade", mechanics.nextLevel ? `${mechanics.upgradeCostLabel} -> L${mechanics.nextLevel}` : "Maximální level"),
      createInfoLine("Další level", nextMultiplier ? `Bonus ${formatMultiplierIncreasePercent(nextMultiplier)}, vyšší výnos a akční hodnoty.` : "Budova už je na maximu.")
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
      createInfoLine("Vlastněné směnárny", `${mechanics.ownedExchangeOffices}/${EXCHANGE_OFFICE_NETWORK_CONFIG.countOnMap}`),
      createInfoLine("Síťový bonus", `income ${formatMultiplierIncreasePercent(mechanics.exchangeNetwork.incomeMultiplier)} · limit ${formatMultiplierIncreasePercent(mechanics.exchangeNetwork.launderingLimitMultiplier)} · heat ${formatMultiplierIncreasePercent(mechanics.exchangeNetwork.heatMultiplier)}`),
      createInfoLine("Laundering kapacita", `${formatDistrictBuildingMoney(mechanics.exchangeLaunderingCapacity)} dirty / akce`),
      createInfoLine("Audit risk", `${mechanics.exchangeAuditRisk} · kontrola každých 6 min · okno 30 min`),
      createInfoLine("Mapa", `Dostupná síťová budova: ${EXCHANGE_OFFICE_NETWORK_CONFIG.countOnMap}x na mapě`)
    );
  } else if (mechanics.mechanicsType === "arcade") {
    return [];
  } else if (mechanics.mechanicsType === "apartment-block") {
    return [];
  } else if (mechanics.mechanicsType === "school") {
    return [
      createInfoLine("Populace", "Škola pasivně zvyšuje lokální populační zásobu a podporuje bytové bloky."),
      createInfoLine("Pravidla", "Škola je podpůrná budova; autoritativní efekt potvrzuje server.")
    ];
  } else if (mechanics.mechanicsType === "warehouse") {
    const storage = mechanics.serverStorageSummary;
    const summary = storage?.warehouseSummary;
    if (!summary) return rows;
    const groups = Array.isArray(storage.groups) ? storage.groups : [];
    const materialRows = groups.flatMap((group) => (Array.isArray(group?.items) ? group.items : []).map((item) => (
      createInfoLine("Materiál", `${item.label || item.resourceKey || "Položka"} ${Math.max(0, Number(item.currentAmount || 0))}/${Math.max(0, Number(item.maxAmount || 0))}`)
    )));
    rows.push(
      createInfoLine("Síť skladišť", String(summary.ownedWarehouseCount)),
      createInfoLine("Nejvyšší level", `L${summary.highestWarehouseLevel}`),
      createInfoLine("Kapacity", groups.map((group) => `${group.label} ${group.currentCapacity} ks na položku`).join(" · ")),
      ...materialRows,
      createInfoLine("Pravidla", "SKLAD je globální inventář; Skladiště pouze zvyšuje maximum každé položky.")
    );
  } else if (mechanics.mechanicsType === "clinic") {
    return [];
  } else if (mechanics.mechanicsType === "garage") {
    return [];
  } else if (mechanics.mechanicsType === "recruitment-center") {
    return [];
  } else if (buildingKey === "autosalon") {
    rows.push(
      createInfoLine("Síť autosalonů", `${mechanics.ownedAutoSalons}/${AUTO_SALON_SUPPORT_CONFIG.countOnMap} vlastněno`),
      createInfoLine("Výnos", `čisté ${formatMultiplierIncreasePercent(mechanics.autoSalonNetwork.cleanIncomeMultiplier)} · špinavé ${formatMultiplierIncreasePercent(mechanics.autoSalonNetwork.dirtyIncomeMultiplier)} · heat ${formatMultiplierIncreasePercent(mechanics.autoSalonNetwork.heatMultiplier)} · vliv +${mechanics.dailyInfluence}/den`),
      createInfoLine("Čekání a únik", `čekání -${mechanics.autoSalonSupport.cooldownReductionPct}% · únik +${mechanics.autoSalonSupport.escapeChanceBonusPct}% při neúspěšném útoku`),
      createInfoLine("Čekání akcí", `autosalon -${mechanics.autoSalonSupport.cooldownReductionPct}% · společný strop -${mechanics.autoSalonSupport.combinedGarageDealerMaxReductionPct}%`),
      createInfoLine("Kde pomáhá", formatBuildingActionCategoryLabels(AUTO_SALON_SUPPORT_CONFIG.fullBonusCategories.concat(AUTO_SALON_SUPPORT_CONFIG.halfBonusCategories, AUTO_SALON_SUPPORT_CONFIG.smallBonusCategories))),
      createInfoLine("Bez zkrácení", formatBuildingActionCategoryLabels(AUTO_SALON_SUPPORT_CONFIG.excludedCategories)),
      createInfoLine("Pravidla", "Pasivní mobilita bez praní, auditu, populace a Intel Power. Vliv generuje automaticky.")
    );
  } else if (buildingKey === "fitness club") {
    rows.push(
      createInfoLine("Síť fitness clubů", `${mechanics.ownedFitnessClubs}/${FITNESS_CLUB_SUPPORT_CONFIG.countOnMap} vlastněno`),
      createInfoLine("Výnos", `clean ${formatMultiplierIncreasePercent(mechanics.fitnessClubNetwork.incomeMultiplier)} · heat ${formatMultiplierIncreasePercent(mechanics.fitnessClubNetwork.heatMultiplier)}`),
      createInfoLine("Útok", `+${mechanics.fitnessClubSupport.attackStrengthBonusPct}% fyzická síla · cap s rekrutačním centrem +${mechanics.fitnessClubSupport.combinedRecruitmentFitnessAttackCapPct}%`),
      createInfoLine("Obrana", `+${mechanics.fitnessClubSupport.defenseStrengthBonusPct}% odolnost · cap s rekrutačním centrem +${mechanics.fitnessClubSupport.combinedRecruitmentFitnessDefenseCapPct}%`),
      createInfoLine("Platí na", "gang, pálky, pistole, granáty, samopaly, bazuky, vesty a barikády podle váhy"),
      createInfoLine("Bez bonusu", "bezpečnostní kamery, alarm a automatické kulometné stanoviště"),
      createInfoLine("Pravidla", "Žádné dirty cash, vliv, populace, Intel Power, praní, audit ani speciální akce.")
    );
  } else if (mechanics.mechanicsType === "smuggling-tunnel") {
    rows.push(
      createInfoLine("Dirty / min", `+${formatDistrictBuildingMoney(mechanics.dirtyHourly / 60)}`),
      createInfoLine("Síťový bonus", `dirty ${formatMultiplierIncreasePercent(mechanics.smugglingTunnelNetwork.dirtyProductionMultiplier)} · heat ${formatMultiplierIncreasePercent(mechanics.smugglingTunnelNetwork.heatMultiplier || mechanics.smugglingTunnelNetwork.passiveHeatMultiplier)}`),
      createInfoLine("Vlastněné tunely", `${mechanics.ownedSmugglingTunnels}/${SMUGGLING_TUNNEL_CONFIG.countOnMap}`),
      createInfoLine("Pouliční dealeři", `podpora +${mechanics.smugglingDealerSupplyBonusPct}% · rychlost +${mechanics.smugglingDealerSupplyBonusPct * SMUGGLING_TUNNEL_CONFIG.dealerSupplySaleSpeedSharePct / 100}% · cena zůstává pevná`),
      createInfoLine("Otevřít kanál", mechanics.smugglingOpenChannelActive ? `Aktivní ještě ${formatDistrictBuildingCooldown(mechanics.smugglingOpenChannelRemainingMs)}` : `Cena ${formatDistrictBuildingMoney(SMUGGLING_TUNNEL_CONFIG.openChannelCleanCost)} clean · cooldown ${formatDistrictBuildingCooldown(SMUGGLING_TUNNEL_CONFIG.openChannelCooldownMs)} · riziko incidentu +${SMUGGLING_TUNNEL_CONFIG.openChannelStreetIncidentFlatRiskPct}%`),
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
    const baseCooldownMs = actionProfile && Object.prototype.hasOwnProperty.call(actionProfile, "cooldownMs")
      ? Math.max(0, Number(actionProfile.cooldownMs || 0))
      : DISTRICT_BUILDING_DETAIL_ACTION_COOLDOWN_MS;
    const actionDefinition = {
      actionId: actionProfile?.actionId || "",
      buildingTypeId: actionProfile?.buildingTypeId || ""
    };
    const garageCategory = resolveGarageCategoryForBuildingAction(buildingName, action, actionDefinition);
    const autoSalonCategory = resolveAutoSalonCategoryForBuildingAction(buildingName, action, actionDefinition);
    const cooldownReductionView = resolveCombinedEffectiveCooldownMs({
      baseCooldownMs,
      garageSupport: mechanics.garageSupport,
      garageCategory,
      autoSalonSupport: mechanics.autoSalonSupport,
      autoSalonCategory
    });
    const effectiveCooldownMs = cooldownReductionView.effectiveCooldownMs;
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
        `Čekání ${formatGarageEffectiveCooldownLabel({
          baseCooldownMs,
          effectiveCooldownMs,
          formatCooldown: formatDistrictBuildingCooldown
        })}`
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

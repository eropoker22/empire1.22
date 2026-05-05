import { ATTACK_WEAPON_LABELS } from "./combatData.js";
import {
  DISTRICT_BUILDING_TYPE_META
} from "../map/mapConstants.js";
import {
  AUTO_SALON_SUPPORT_CONFIG,
  DISTRICT_BUILDING_DETAIL_ACTION_COOLDOWN_MS,
  FITNESS_CLUB_SUPPORT_CONFIG,
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
    statRows.splice(6, 0,
      createStat("Kapacita praní", formatDistrictBuildingMoney(mechanics.casinoLaunderingCapacity)),
      createStat("Audit risk", getCasinoClientAuditRisk(detailEntry, playerHeat, now))
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
      createStat("Vliv / min", `+${SCHOOL_CONFIG.influencePerMinute.toFixed(2)}`),
      createStat("Studenti", `${mechanics.schoolWholeStudents}/${mechanics.schoolCapacity}`),
      createStat("Populace / min", `+${mechanics.schoolPopulationPerMinute.toFixed(2)}`),
      createStat("Do naplnění", mechanics.schoolIsFull ? "Plná kapacita" : formatDistrictBuildingCooldown(mechanics.schoolTimeToFullMs)),
      createStat("Školy", `${mechanics.ownedSchools}/${SCHOOL_CONFIG.countOnMap}`),
      createStat("Talent chance", `${mechanics.schoolTalentChancePct}%`),
      createStat("Income network", `x${mechanics.schoolNetwork.incomeMultiplier.toFixed(2)}`),
      createStat("Kapacita network", `x${mechanics.schoolNetwork.studentCapacityMultiplier.toFixed(2)}`),
      createStat("Večerní kurz", mechanics.schoolEveningCourseActive ? formatDistrictBuildingCooldown(mechanics.schoolEveningCourseRemainingMs) : "Neaktivní")
    );
  } else if (mechanics.mechanicsType === "exchange") {
    statRows.splice(6, 0,
      createStat("Směnárny", `${mechanics.ownedExchangeOffices}/13`),
      createStat("Network", `x${mechanics.exchangeNetwork.incomeMultiplier.toFixed(2)} / limit x${mechanics.exchangeNetwork.launderingLimitMultiplier.toFixed(2)}`),
      createStat("Kapacita praní", formatDistrictBuildingMoney(mechanics.exchangeLaunderingCapacity)),
      createStat("Audit risk", mechanics.exchangeAuditRisk)
    );
  } else if (mechanics.mechanicsType === "arcade") {
    statRows.splice(6, 0,
      createStat("Herny", `${mechanics.ownedArcades}/20`),
      createStat("Network", `x${mechanics.arcadeNetwork.incomeMultiplier.toFixed(2)} / limit x${mechanics.arcadeNetwork.launderingLimitMultiplier.toFixed(2)}`),
      createStat("Kapacita praní", formatDistrictBuildingMoney(mechanics.arcadeLaunderingCapacity)),
      createStat("Audit risk", mechanics.arcadeAuditRisk)
    );
  } else if (mechanics.mechanicsType === "warehouse") {
    statRows.splice(0, statRows.length,
      createStat("Clean / min", `+${formatDistrictBuildingMoney(45 * mechanics.warehouseNetwork.incomeMultiplier)}`),
      createStat("Heat / min", `+${(0.06 * mechanics.warehouseNetwork.heatMultiplier).toFixed(3)}`),
      createStat("Sklady", `${mechanics.ownedWarehouses}/18`),
      createStat("Income network", `x${mechanics.warehouseNetwork.incomeMultiplier.toFixed(2)}`),
      createStat("Storage network", `x${mechanics.warehouseNetwork.storageCapacityMultiplier.toFixed(2)}`),
      createStat("Kapacita bonus", `+${mechanics.warehouseCapacity.genericResources}`),
      createStat("Dirty / vliv", "0 / 0"),
      createStat("Akce", "Žádné")
    );
  } else if (mechanics.mechanicsType === "clinic") {
    statRows.splice(0, statRows.length,
      createStat("Clean / min", `+${formatDistrictBuildingMoney(55 * mechanics.clinicNetwork.incomeMultiplier)}`),
      createStat("Heat / min", `+${(0.03 * mechanics.clinicNetwork.heatMultiplier).toFixed(3)}`),
      createStat("Kliniky", `${mechanics.ownedClinics}/14`),
      createStat("Income network", `x${mechanics.clinicNetwork.incomeMultiplier.toFixed(2)}`),
      createStat("Recovery rate", `${mechanics.clinicRecoveryRatePct} %`),
      createStat("Recovery pool", `${mechanics.clinicRecoveryPool.totalFreshAmount} položek`),
      createStat("Cooldown akce", "18m 00s"),
      createStat("Cena akce", formatDistrictBuildingMoney(1200))
    );
  } else if (buildingKey === "obchodni centrum") {
    statRows.splice(0, statRows.length,
      createStat("Market sleva", `${mechanics.shoppingMallMarketDiscount.discountPct}%`),
      createStat("Black market", `${mechanics.shoppingMallBlackMarketDiscount.discountPct}%`),
      createStat("Market fee", `-${mechanics.shoppingMallMarketDiscount.feeReductionPct}%`),
      createStat("Vlastněné mally", `${mechanics.ownedShoppingMalls}/${SHOPPING_MALL_NETWORK_CONFIG.countOnMap}`),
      createStat("Clean network", `x${mechanics.shoppingMallNetwork.cleanIncomeMultiplier.toFixed(2)}`),
      createStat("Dirty network", `x${mechanics.shoppingMallNetwork.dirtyIncomeMultiplier.toFixed(2)}`),
      createStat("Vliv network", `x${mechanics.shoppingMallNetwork.influenceMultiplier.toFixed(2)}`),
      createStat("Heat network", `x${mechanics.shoppingMallNetwork.heatMultiplier.toFixed(2)}`)
    );
  } else if (buildingKey === "autosalon") {
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
  } else if (buildingKey === "fitness club") {
    statRows.splice(0, statRows.length,
      createStat("Clean / min", `+${formatDistrictBuildingMoney(mechanics.cleanHourly / 60)}`),
      createStat("Heat / min", `+${(mechanics.dailyHeat / 1440).toFixed(3)}`),
      createStat("Fitness Cluby", `${mechanics.ownedFitnessClubs}/${FITNESS_CLUB_SUPPORT_CONFIG.countOnMap}`),
      createStat("Income network", `x${mechanics.fitnessClubNetwork.incomeMultiplier.toFixed(2)}`),
      createStat("Heat network", `x${mechanics.fitnessClubNetwork.heatMultiplier.toFixed(2)}`),
      createStat("Útok", `+${mechanics.fitnessClubSupport.attackStrengthBonusPct}%`),
      createStat("Obrana", `+${mechanics.fitnessClubSupport.defenseStrengthBonusPct}%`),
      createStat("Cap s rekrutací", `+${mechanics.fitnessClubSupport.combinedRecruitmentFitnessAttackCapPct}% / +${mechanics.fitnessClubSupport.combinedRecruitmentFitnessDefenseCapPct}%`)
    );
  } else if (mechanics.mechanicsType === "smuggling-tunnel") {
    statRows.splice(0, statRows.length,
      createStat("Dirty / min", `+${formatDistrictBuildingMoney(mechanics.smugglingDirtyPerMinute)}`),
      createStat("Passive heat / min", `+${(mechanics.dailyHeat / 1440).toFixed(3)}`),
      createStat("Dávka", `${formatDistrictBuildingMoney(mechanics.smugglingWholeDirtyCash)} / ${formatDistrictBuildingMoney(mechanics.smugglingBatchCapacity)}`),
      createStat("Do naplnění", mechanics.smugglingIsFull ? "Dávka připravena" : formatDistrictBuildingCooldown(mechanics.smugglingTimeToFullMs)),
      createStat("Tunely", `${mechanics.ownedSmugglingTunnels}/${SMUGGLING_TUNNEL_CONFIG.countOnMap}`),
      createStat("Dirty network", `x${mechanics.smugglingTunnelNetwork.dirtyProductionMultiplier.toFixed(2)}`),
      createStat("Kapacita network", `x${mechanics.smugglingTunnelNetwork.batchCapacityMultiplier.toFixed(2)}`),
      createStat("Heat network", `x${mechanics.smugglingTunnelNetwork.passiveHeatMultiplier.toFixed(2)}`),
      createStat("Heat při výběru", `+${mechanics.smugglingCollectHeat}`),
      createStat("Tichý kanál", mechanics.smugglingSilentActive ? formatDistrictBuildingCooldown(mechanics.smugglingSilentRemainingMs) : "Neaktivní")
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
      createMechanic("Produkce", `+${mechanics.apartmentPopulationPerMinute.toFixed(2)} obyv./min`),
      createMechanic("Collect", mechanics.canCollect ? "Připraveno" : "Čeká na obyvatele"),
      createMechanic("Síť", mechanics.ownedApartmentBlocks > 1 ? "Zvyšuje produkci a kapacitu" : "První bytový blok")
    );
  } else if (mechanics.mechanicsType === "school") {
    mechanicRows.push(
      createMechanic("Lokální studenti", `${mechanics.schoolWholeStudents}/${mechanics.schoolCapacity}`),
      createMechanic("Produkce", `+${mechanics.schoolPopulationPerMinute.toFixed(2)} obyv./min`),
      createMechanic("Talent Pool", `${mechanics.schoolTalentChancePct}% při collectu`),
      createMechanic("Výsledek talentu", "zapíše se do uličních zpráv"),
      createMechanic("Pravidla", "žádný dirty cash · žádný heat · žádné praní · žádný audit")
    );
  } else if (mechanics.mechanicsType === "warehouse") {
    mechanicRows.push(
      createMechanic("Kapacita generic", `${mechanics.warehouseUsage.genericResources}/${mechanics.warehouseCapacity.genericResources}`),
      createMechanic("Chemicals", `${mechanics.warehouseUsage.chemicals}/${mechanics.warehouseCapacity.chemicals}`),
      createMechanic("Metal Parts", `${mechanics.warehouseUsage.metalParts}/${mechanics.warehouseCapacity.metalParts}`),
      createMechanic("Drugs/boosty", `${mechanics.warehouseUsage.drugsAndBoosts}/${mechanics.warehouseCapacity.drugsAndBoosts}`)
    );
  } else if (mechanics.mechanicsType === "clinic") {
    mechanicRows.push(
      createMechanic("Recovery pool", mechanics.clinicRecoveryPool.label),
      createMechanic("Nejbližší expirace", mechanics.clinicRecoveryPool.nextExpiryMs ? formatDistrictBuildingCooldown(mechanics.clinicRecoveryPool.nextExpiryMs) : "Žádná"),
      createMechanic("Síť klinik", `${mechanics.ownedClinics}/14`),
      createMechanic("Akce", mechanics.clinicRecoveryPool.totalFreshAmount > 0 ? "Připraveno" : "Čeká na ztráty")
    );
  } else if (buildingKey === "obchodni centrum") {
    mechanicRows.push(
      createMechanic("Market sleva", `${mechanics.shoppingMallMarketDiscount.discountPct}% regular · ${mechanics.shoppingMallBlackMarketDiscount.discountPct}% black market`),
      createMechanic("Fee reduction", `-${mechanics.shoppingMallMarketDiscount.feeReductionPct}% market fees`),
      createMechanic("Síť", `${mechanics.ownedShoppingMalls}/${SHOPPING_MALL_NETWORK_CONFIG.countOnMap} obchodních center`),
      createMechanic("Income network", `clean x${mechanics.shoppingMallNetwork.cleanIncomeMultiplier.toFixed(2)} · dirty x${mechanics.shoppingMallNetwork.dirtyIncomeMultiplier.toFixed(2)}`),
      createMechanic("Vliv / heat", `vliv x${mechanics.shoppingMallNetwork.influenceMultiplier.toFixed(2)} · heat x${mechanics.shoppingMallNetwork.heatMultiplier.toFixed(2)}`)
    );
  } else if (buildingKey === "autosalon") {
    mechanicRows.push(
      createMechanic("Plný bonus", formatBuildingActionCategoryLabels(AUTO_SALON_SUPPORT_CONFIG.fullBonusCategories)),
      createMechanic("Částečný bonus", formatBuildingActionCategoryLabels(AUTO_SALON_SUPPORT_CONFIG.halfBonusCategories.concat(AUTO_SALON_SUPPORT_CONFIG.smallBonusCategories))),
      createMechanic("Mobilita", `+${mechanics.autoSalonSupport.mobilityBonusPct}% pro přesuny a návraty`),
      createMechanic("Únik", `+${mechanics.autoSalonSupport.escapeChanceBonusPct}% lepší výsledek, ne jistota`),
      createMechanic("Mimo bonus", formatBuildingActionCategoryLabels(AUTO_SALON_SUPPORT_CONFIG.excludedCategories))
    );
  } else if (buildingKey === "fitness club") {
    mechanicRows.push(
      createMechanic("Útok 100 %", "gang a baseballová pálka"),
      createMechanic("Útok část", "pistole 50 % · granát 25 % · samopal 40 % · bazuka 15 %"),
      createMechanic("Obrana", "gang 100 % · vesta 60 % · barikády 35 %"),
      createMechanic("Bez bonusu", "kamery · alarm · kulometné stanoviště")
    );
  } else if (mechanics.mechanicsType === "smuggling-tunnel") {
    mechanicRows.push(
      createMechanic("Collect", mechanics.canCollect ? "Vybrat dávku připraveno" : `Minimum ${formatDistrictBuildingMoney(SMUGGLING_TUNNEL_CONFIG.minCollectDirty)}`),
      createMechanic("Zásobník", `${formatDistrictBuildingMoney(mechanics.smugglingWholeDirtyCash)} / ${formatDistrictBuildingMoney(mechanics.smugglingBatchCapacity)}`),
      createMechanic("Tichý kanál", mechanics.smugglingSilentActive ? `Aktivní ${formatDistrictBuildingCooldown(mechanics.smugglingSilentRemainingMs)}` : `Cena ${formatDistrictBuildingMoney(SMUGGLING_TUNNEL_CONFIG.silentChannelDirtyCost)} dirty`),
      createMechanic("Riziko zátahu", `${SMUGGLING_TUNNEL_CONFIG.silentChannelRaidChancePct} % po skončení`),
      createMechanic("Pravidla", "Pouze dirty cash a heat; žádné clean, vliv, populace, Intel, praní ani audit")
    );
  } else {
    mechanicRows.push(
      createMechanic("Výnos", `${formatDistrictBuildingMoney(mechanics.cleanHourly + mechanics.dirtyHourly)} / hod`),
      createMechanic("Income", "Automaticky do zdrojů"),
      createMechanic("Collect", mechanics.canCollect ? "Připraveno" : "Není potřeba"),
      createMechanic("Cooldown akce", formatDistrictBuildingCooldown(DISTRICT_BUILDING_DETAIL_ACTION_COOLDOWN_MS))
    );
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
      : actionProfile?.smugglingCollectBatch && mechanics.smugglingWholeDirtyCash < SMUGGLING_TUNNEL_CONFIG.minCollectDirty
        ? `V tunelu musí být alespoň ${formatDistrictBuildingMoney(SMUGGLING_TUNNEL_CONFIG.minCollectDirty)} dirty cash.`
      : actionProfile?.smugglingSilentChannel && Number(economyState.dirtyMoney || 0) < SMUGGLING_TUNNEL_CONFIG.silentChannelDirtyCost
        ? `Potřebuješ ${formatDistrictBuildingMoney(SMUGGLING_TUNNEL_CONFIG.silentChannelDirtyCost)} dirty cash.`
      : actionProfile?.smugglingSilentChannel && mechanics.smugglingSilentActive
        ? `Tichý kanál běží. Zbývá ${formatDistrictBuildingCooldown(mechanics.smugglingSilentRemainingMs)}.`
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
  const displayLabel = String(displayName || buildingName || "Budova").trim() || "Budova";
  const showManualCollect = Boolean(mechanics.hasManualCollect);
  const collectTitle = showManualCollect
    ? (mechanics.canCollect
        ? `Vybrat připravený výstup: ${mechanics.storedOutputLabel}`
        : mechanics.mechanicsType === "school"
          ? "Škola zatím nemá celé studenty k vybrání."
          : mechanics.mechanicsType === "smuggling-tunnel"
            ? `V tunelu musí být alespoň ${formatDistrictBuildingMoney(SMUGGLING_TUNNEL_CONFIG.minCollectDirty)} dirty cash.`
            : "Populace zatím není připravená k vybrání.")
    : "";
  const metaText = [
    displayLabel !== buildingName ? buildingName : "",
    profile.role,
    district?.id ? `District ${district.id}` : "",
    buildingProfile?.setTitle || ""
  ].filter(Boolean).join(" · ");

  return {
    title: displayLabel,
    badge: profile.role,
    levelLabel: `L${mechanics.level}`,
    name: displayLabel,
    meta: metaText,
    collect: {
      visible: showManualCollect,
      enabled: Boolean(mechanics.canCollect),
      title: collectTitle
    },
    upgrade: {
      disabled: !mechanics.nextLevel,
      title: mechanics.nextLevel
        ? `Upgrade na L${mechanics.nextLevel} za ${mechanics.upgradeCostLabel}`
        : "Budova je na maximálním levelu."
    },
    stats: createBuildingDetailStatRows({ buildingName, mechanics, detailEntry, buildingProfile, playerHeat, now }),
    mechanics: createBuildingDetailMechanicRows({ buildingName, mechanics }),
    effectsLabel: mechanics.effectsLabel || "Žádné aktivní mechaniky.",
    actions: createBuildingDetailActionRows({ buildingName, profile, mechanics, detailEntry, economyState, actionProfiles, now })
  };
}

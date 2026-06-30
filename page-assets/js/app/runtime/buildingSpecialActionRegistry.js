import {
  CLINIC_RECOVERABLE_ITEMS,
  DISTRICT_BUILDING_DETAIL_ACTION_COOLDOWN_MS,
  DISTRICT_BUILDING_DETAIL_MECHANICS_TYPES,
  DISTRICT_BUILDING_DETAIL_PROFILES,
  DISTRICT_BUILDING_SPECIAL_ACTION_PROFILES
} from "./buildingDetailData.js";
import {
  formatDistrictBuildingCooldown,
  formatDistrictBuildingMoney
} from "./formatters.js";
import { formatServerBuildingActionDefaultInputSummary } from "./buildingSpecialActionServerDefaults.js";

export function normalizeBuildingSpecialActionKey(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const SERVER_ACTIONS = new Map([
  ["burza::spekulativni nakup", ["speculative_buy", "stock_exchange"]],
  ["burza::trzni tlak", ["market_pressure", "stock_exchange"]],
  ["burza::insider window", ["insider_window", "stock_exchange"]],
  ["centralni banka::likviditni injekce", ["liquidity_injection", "central_bank"]],
  ["centralni banka::zmrazene ucty", ["frozen_accounts", "central_bank"]],
  ["centralni banka::kurzovni intervence", ["currency_intervention", "central_bank"]],
  ["magistrat::uredni kryti", ["official_cover", "city_hall"]],
  ["magistrat::mestska zakazka", ["city_contract", "city_hall"]],
  ["magistrat::nouzova vyhlaska", ["emergency_decree", "city_hall"]],
  ["lobby klub::zakulisni tlak", ["backroom_pressure", "lobby_club"]],
  ["lobby klub::tiche vyjednavani", ["quiet_negotiation", "lobby_club"]],
  ["lobby klub::medialni clona", ["media_screen", "lobby_club"]],
  ["lobby club::zakulisni tlak", ["backroom_pressure", "lobby_club"]],
  ["lobby club::tiche vyjednavani", ["quiet_negotiation", "lobby_club"]],
  ["lobby club::medialni clona", ["media_screen", "lobby_club"]],
  ["letiste::expresni dovoz", ["express_import", "airport"]],
  ["letiste::cerny charter", ["black_charter", "airport"]],
  ["letiste::evakuacni koridor", ["evacuation_corridor", "airport"]],
  ["pristav::container cut", ["port_container_cut", "port"]],
  ["parlament::policy window", ["parliament_policy_window", "parliament"]],
  ["kasino::tichy backroom", ["quiet_backroom", "casino"]],
  ["kasino::ticha herna", ["quiet_backroom", "casino"]],
  ["kasino::vip noc", ["vip_night", "casino"]],
  ["kasino::podplaceny inspektor", ["bribed_inspector", "casino"]],
  ["herna::nocni automaty", ["night_machines", "arcade"]],
  ["herna::zadni pokladna", ["back_cashdesk", "arcade"]],
  ["smenarna::vyhodny kurz", ["good_rate", "exchange"]],
  ["strip club::hostit vip klienty", ["vip_lounge", "strip_club"]],
  ["strip club::ziskat kompro", ["private_party", "strip_club"]],
  ["strip club::ziskat kompromat", ["private_party", "strip_club"]],
  ["strip club::vybrat cash", ["strip_club_collect_cash", "strip_club"]],
  ["recyklacni centrum::vytezit ztraty", ["extract_losses", "recycling_center"]],
  ["klinika::stabilizacni protokol", ["stabilization_protocol", "clinic"]],
  ["skola::vecerni kurz", ["evening_course", "school"]],
  ["bytovy blok::vybrat obyvatele", ["collect_population", "apartment_block"]],
  ["energeticka stanice::stabilizovat sit", ["backup_grid_switch", "power_station"]],
  ["energeticka stanice::napajet vyrobu", ["power_station_feed_production", "power_station"]],
  ["energeticka stanice::snizit heat", ["power_station_reduce_heat", "power_station"]],
  ["energeticka stanice::snizit vypadky", ["power_station_reduce_heat", "power_station"]],
  ["pasovaci tunel::otevrit kanal", ["open_channel", "smuggling_tunnel"]],
  ["poulicni dealeri::spustit prodej", ["start_drug_sale", "street_dealers"]],
  ["poulicni dealeri::vybrat hot cash", ["street_dealers_collect_hot_cash", "street_dealers"]],
  ["poulicni dealeri::presunout stash", ["street_dealers_move_stash", "street_dealers"]],
  ["restaurace::vybrat trzby", ["restaurant_collect_revenue", "restaurant"]],
  ["restaurace::kryt schuzky", ["restaurant_cover_meetings", "restaurant"]],
  ["restaurace::posilit lokalni sit", ["restaurant_local_network", "restaurant"]]
]);

const LEGACY_ACTION_IDS = new Map([
  ["restaurace::vybrat trzby", "restaurant_collect_revenue"],
  ["restaurace::kryt schuzky", "restaurant_cover_meetings"],
  ["restaurace::posilit lokalni sit", "restaurant_local_network"]
]);

const PROFILE_MARKERS_REQUIRING_SERVER = Object.freeze([
  "stockSpeculativeBuy",
  "stockMarketPressure",
  "stockInsiderWindow",
  "centralBankLiquidityInjection",
  "centralBankFrozenAccounts",
  "centralBankCurrencyIntervention",
  "cityHallOfficialCover",
  "cityHallContract",
  "cityHallEmergencyDecree",
  "lobbyBackroomPressure",
  "lobbyQuietNegotiation",
  "lobbyMediaScreen",
  "airportExpressImport",
  "airportBlackCharter",
  "airportEvacuationCorridor"
]);

function getServerBuildingSpecialActionEntry(buildingName, actionLabel) {
  const buildingKey = normalizeBuildingSpecialActionKey(buildingName);
  const actionKey = normalizeBuildingSpecialActionKey(actionLabel);
  return SERVER_ACTIONS.get(`${buildingKey}::${actionKey}`) || null;
}

export function resolveBuildingSpecialActionActionId(buildingName, actionLabel, actionIndex = 0) {
  const explicit = getServerBuildingSpecialActionEntry(buildingName, actionLabel);
  if (explicit) return explicit[0];
  const buildingKey = normalizeBuildingSpecialActionKey(buildingName);
  const actionKey = normalizeBuildingSpecialActionKey(actionLabel);
  const legacy = LEGACY_ACTION_IDS.get(`${buildingKey}::${actionKey}`);
  if (legacy) return legacy;
  return `${buildingKey || "building"}_${actionKey || `action_${actionIndex}`}`.replace(/\s+/g, "_");
}

export function getBuildingSpecialActionBuildingTypeId(buildingName, actionLabel = "") {
  const explicit = getServerBuildingSpecialActionEntry(buildingName, actionLabel);
  if (explicit?.[1]) return explicit[1];
  const buildingKey = normalizeBuildingSpecialActionKey(buildingName);
  const mechanicsType = DISTRICT_BUILDING_DETAIL_MECHANICS_TYPES[buildingKey] || "district-asset";
  return mechanicsType.replace(/-/g, "_");
}

export function hasServerBuildingSpecialActionHandler(buildingName, actionLabel) {
  return Boolean(getServerBuildingSpecialActionEntry(buildingName, actionLabel));
}

export function isBuildingSpecialActionImplemented(buildingName, actionLabel, actionProfile = {}) {
  void actionProfile;
  return hasServerBuildingSpecialActionHandler(buildingName, actionLabel);
}

function profileRequiresServerHandler(actionProfile = {}) {
  return PROFILE_MARKERS_REQUIRING_SERVER.some((key) => Boolean(actionProfile?.[key]));
}

export function hasLegacyBuildingSpecialActionHandler(actionProfile = {}) {
  if (!actionProfile || typeof actionProfile !== "object") return false;
  if (profileRequiresServerHandler(actionProfile)) return false;
  return Boolean(
    actionProfile.apartmentCollectPopulation
      || actionProfile.smugglingOpenChannel
      || actionProfile.schoolEveningCourse
      || actionProfile.clinicStabilizationProtocol
      || actionProfile.recyclingExtractLosses
      || actionProfile.casinoQuietBackroom
      || actionProfile.casinoVipNight
      || actionProfile.casinoBribedInspector
      || actionProfile.exchangeOfficeGoodRate
      || actionProfile.arcadeNightMachines
      || actionProfile.arcadeBackCashdesk
      || actionProfile.exchangeDirty
      || Number(actionProfile.clean || 0) !== 0
      || Number(actionProfile.dirty || 0) !== 0
      || Number(actionProfile.members || 0) !== 0
      || Number(actionProfile.influence || 0) !== 0
      || Number(actionProfile.heat || 0) !== 0
      || Number(actionProfile.durationMs || 0) > 0
      || Object.keys(actionProfile.materials || {}).length > 0
      || Object.keys(actionProfile.drugs || {}).length > 0
      || Object.keys(actionProfile.weapons || {}).length > 0
      || Object.keys(actionProfile.factorySupplies || {}).length > 0
  );
}

function formatCostSummary(actionProfile = {}) {
  const costs = [];
  if (Number(actionProfile.cleanCost || 0) > 0) costs.push(`${formatDistrictBuildingMoney(actionProfile.cleanCost)} clean cash`);
  if (Number(actionProfile.dirtyCost || 0) > 0) costs.push(`${formatDistrictBuildingMoney(actionProfile.dirtyCost)} dirty cash`);
  for (const [itemId, amount] of Object.entries(actionProfile.materialCost || {})) {
    const safeAmount = Math.max(0, Math.floor(Number(amount || 0)));
    if (safeAmount > 0) costs.push(`${itemId} x${safeAmount}`);
  }
  if (
    costs.length === 0
    && Number(actionProfile.minimumDirty || 0) > 0
    && (actionProfile.casinoQuietBackroom || actionProfile.exchangeOfficeGoodRate || actionProfile.arcadeBackCashdesk)
  ) {
    costs.push(`${formatDistrictBuildingMoney(actionProfile.minimumDirty)} dirty cash`);
  }
  if (Number(actionProfile.influenceCost || 0) > 0) costs.push(`${Math.floor(Number(actionProfile.influenceCost))} vliv`);
  return costs.join(" + ");
}

function formatNumberValue(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "0";
  if (Number.isInteger(numeric)) return String(numeric);
  return numeric.toFixed(2).replace(/\.?0+$/u, "");
}

function formatMultiplierPercentDelta(multiplier) {
  const numeric = Number(multiplier);
  if (!Number.isFinite(numeric) || numeric === 1) return "";
  return `${numeric >= 1 ? "+" : ""}${formatNumberValue((numeric - 1) * 100)}%`;
}

function formatRewardSummary(actionProfile = {}) {
  const rewards = [];
  const serverEffectSummary = String(actionProfile.serverEffectSummary || "").trim();
  if (serverEffectSummary) rewards.push(serverEffectSummary);
  if (Number(actionProfile.clean || 0) > 0) rewards.push(`Clean +${formatDistrictBuildingMoney(actionProfile.clean)}`);
  if (Number(actionProfile.dirty || 0) > 0) rewards.push(`Dirty cash +${formatDistrictBuildingMoney(actionProfile.dirty)}`);
  if (Number(actionProfile.influence || 0) > 0) rewards.push(`Vliv +${Math.floor(Number(actionProfile.influence))}`);
  if (Number(actionProfile.members || 0) > 0) rewards.push(`Členové +${Math.floor(Number(actionProfile.members))}`);
  if (Number(actionProfile.heatSuccess || 0) !== 0) rewards.push(`Heat ${Number(actionProfile.heatSuccess) > 0 ? "+" : ""}${Math.floor(Number(actionProfile.heatSuccess))}`);
  if (Number(actionProfile.influenceSuccess || 0) > 0) rewards.push(`Vliv +${Math.floor(Number(actionProfile.influenceSuccess))}`);
  if (Number(actionProfile.auditRiskReductionPct || 0) > 0) rewards.push(`Audit -${formatNumberValue(actionProfile.auditRiskReductionPct)}%`);
  if (Number(actionProfile.incomeBoostPct || 0) > 0) rewards.push(`Income +${formatNumberValue(actionProfile.incomeBoostPct)}%`);
  if (Number(actionProfile.cleanIncomeBoostPct || 0) > 0) rewards.push(`Clean income +${formatNumberValue(actionProfile.cleanIncomeBoostPct)}%`);
  if (Number(actionProfile.dirtyIncomeBoostPct || 0) > 0) rewards.push(`Dirty income +${formatNumberValue(actionProfile.dirtyIncomeBoostPct)}%`);
  if (Number(actionProfile.influenceBoostPct || 0) > 0) rewards.push(`Vliv +${formatNumberValue(actionProfile.influenceBoostPct)}%`);
  if (Number(actionProfile.apartmentPopulationBoostPct || 0) > 0) rewards.push(`Bytové bloky +${formatNumberValue(actionProfile.apartmentPopulationBoostPct)}% výroba lidí`);
  if (Number(actionProfile.populationBoostPct || 0) > 0) rewards.push(`Studenti +${formatNumberValue(actionProfile.populationBoostPct)}%`);
  if (Number(actionProfile.dirtySharePct || 0) > 0) rewards.push(`Praní ${formatNumberValue(actionProfile.dirtySharePct)}% dirty cash`);
  if (Number(actionProfile.maxDirty || 0) > 0) rewards.push(`Limit ${formatDistrictBuildingMoney(actionProfile.maxDirty)}`);
  if (Number(actionProfile.feePct || 0) > 0) rewards.push(`Fee ${formatNumberValue(actionProfile.feePct)}%`);
  if (Number(actionProfile.heatGainReductionPct || 0) > 0) rewards.push(`Heat gain -${formatNumberValue(actionProfile.heatGainReductionPct)}%`);
  if (Number(actionProfile.policeControlChanceReductionPct || 0) > 0) rewards.push(`Kontroly -${formatNumberValue(actionProfile.policeControlChanceReductionPct)}%`);
  if (Number(actionProfile.rumorChanceReductionPct || 0) > 0) rewards.push(`Rumory -${formatNumberValue(actionProfile.rumorChanceReductionPct)}%`);
  if (Number(actionProfile.cleanCashProtectionBonusPct || 0) > 0) rewards.push(`Clean ochrana +${formatNumberValue(actionProfile.cleanCashProtectionBonusPct)}%`);
  if (Number(actionProfile.dirtyCashProtectionPct || 0) > 0) rewards.push(`Dirty ochrana +${formatNumberValue(actionProfile.dirtyCashProtectionPct)}%`);
  if (Number(actionProfile.fineReductionPct || 0) > 0) rewards.push(`Pokuty -${formatNumberValue(actionProfile.fineReductionPct)}%`);
  if (Number(actionProfile.volatilityReductionPct || 0) > 0) rewards.push(`Volatilita -${formatNumberValue(actionProfile.volatilityReductionPct)}%`);
  if (Number(actionProfile.marketFeeReductionPct || 0) > 0) rewards.push(`Market fee -${formatNumberValue(actionProfile.marketFeeReductionPct)}%`);
  if (Number(actionProfile.stockExchangeEffectReductionPct || 0) > 0) rewards.push(`Burza efekt -${formatNumberValue(actionProfile.stockExchangeEffectReductionPct)}%`);
  if (Number(actionProfile.offerDiscountPct || 0) > 0) rewards.push(`Sleva +${formatNumberValue(actionProfile.offerDiscountPct)}%`);
  if (Number(actionProfile.dealerSalePriceBonusPct || 0) > 0) rewards.push(`Dealer price +${formatNumberValue(actionProfile.dealerSalePriceBonusPct)}%`);
  if (Number(actionProfile.dealerSaleSpeedBonusPct || 0) > 0) rewards.push(`Dealer speed +${formatNumberValue(actionProfile.dealerSaleSpeedBonusPct)}%`);
  if (Number(actionProfile.dealerRewardBonusPct || 0) > 0) rewards.push(`Dealer reward +${formatNumberValue(actionProfile.dealerRewardBonusPct)}%`);
  for (const [itemId, amount] of Object.entries(actionProfile.materials || {})) rewards.push(`${itemId} x${amount}`);
  for (const [itemId, amount] of Object.entries(actionProfile.drugs || {})) rewards.push(`${itemId} x${amount}`);
  for (const [itemId, amount] of Object.entries(actionProfile.weapons || {})) rewards.push(`${itemId} x${amount}`);
  for (const [itemId, amount] of Object.entries(actionProfile.factorySupplies || {})) rewards.push(`${itemId} x${amount}`);
  if (Number(actionProfile.durationMs || 0) > 0) rewards.push(`Efekt ${formatDistrictBuildingCooldown(actionProfile.durationMs)}`);
  return rewards.join(" · ") || "Efekt podle akce";
}

function formatRiskSummary(actionProfile = {}) {
  const risks = [];
  const heat = Number(actionProfile.heat || 0);
  if (heat !== 0) risks.push(`Heat ${heat > 0 ? "+" : ""}${Math.floor(heat)}`);
  const heatMultiplierDelta = formatMultiplierPercentDelta(actionProfile.heatMultiplier);
  if (heatMultiplierDelta) risks.push(`Heat ${heatMultiplierDelta}`);
  if (Number(actionProfile.auditRiskBoostPct || 0) > 0) risks.push(`Audit +${formatNumberValue(actionProfile.auditRiskBoostPct)}%`);
  if (Number(actionProfile.auditRiskFailurePct || 0) > 0) risks.push(`Audit fail +${formatNumberValue(actionProfile.auditRiskFailurePct)}%`);
  if (Number(actionProfile.failureChancePct || 0) > 0) risks.push(`Selhání ${formatNumberValue(actionProfile.failureChancePct)}%`);
  if (Number(actionProfile.heatFailure || 0) !== 0) risks.push(`Fail heat ${Number(actionProfile.heatFailure) > 0 ? "+" : ""}${Math.floor(Number(actionProfile.heatFailure))}`);
  if (Number(actionProfile.marketFeePenaltyPct || 0) > 0) risks.push(`Market fee +${formatNumberValue(actionProfile.marketFeePenaltyPct)}%`);
  if (Number(actionProfile.purchaseCustomsRiskPct || 0) > 0) risks.push(`Celnice +${formatNumberValue(actionProfile.purchaseCustomsRiskPct)}%`);
  if (Number(actionProfile.heatRiskBonusPct || 0) > 0) risks.push(`Heat risk +${formatNumberValue(actionProfile.heatRiskBonusPct)}%`);
  if (Number(actionProfile.streetIncidentFlatRiskPct || 0) > 0) risks.push(`Incident +${formatNumberValue(actionProfile.streetIncidentFlatRiskPct)}%`);
  return risks.join(" · ") || "Bez přímého heat rizika";
}

export function resolveBuildingSpecialActionDefinition({
  buildingName = "",
  actionLabel = "",
  actionIndex = 0,
  actionProfile = null
} = {}) {
  const profile = actionProfile || {};
  const actionId = resolveBuildingSpecialActionActionId(buildingName, actionLabel, actionIndex);
  const buildingTypeId = getBuildingSpecialActionBuildingTypeId(buildingName, actionLabel);
  const hasServerConfig = hasServerBuildingSpecialActionHandler(buildingName, actionLabel);
  const implemented = hasServerConfig;
  const handlerId = hasServerConfig ? "server-run-building-action" : "";
  const cooldownMs = Object.prototype.hasOwnProperty.call(profile, "cooldownMs")
    ? Math.max(0, Number(profile.cooldownMs || 0))
    : DISTRICT_BUILDING_DETAIL_ACTION_COOLDOWN_MS;

  return {
    actionId,
    buildingTypeId,
    label: String(actionLabel || "Akce").trim() || "Akce",
    shortDescription: implemented ? "Akce se spustí po potvrzení." : "",
    confirmTitle: String(actionLabel || "Potvrdit akci").trim() || "Potvrdit akci",
    confirmBody: implemented
      ? hasServerConfig
        ? "Po potvrzení se akce spustí přes server. Cena, efekt, riziko a cooldown jsou uvedené níže."
        : "Po potvrzení se akce spustí. Cena, efekt, riziko a cooldown jsou uvedené níže."
      : "",
    costSummary: formatCostSummary(profile),
    rewardSummary: formatRewardSummary(profile),
    riskSummary: formatRiskSummary(profile),
    inputSummary: hasServerConfig ? formatServerBuildingActionDefaultInputSummary(actionId, profile) : "",
    cooldownMs,
    status: implemented ? "implemented" : "missing-handler",
    disabledReason: "",
    handlerId,
    hasServerConfig
  };
}

export function getBuildingSpecialActionCooldownUntil(actionCooldowns = {}, actionId = "", actionIndex = 0) {
  return Math.max(
    0,
    Number(actionCooldowns?.[actionId] || 0),
    Number(actionCooldowns?.[actionIndex] || 0)
  );
}

export function getRecyclingSalvagePoolView(clinicRecoveryPool = null) {
  const fresh = Array.isArray(clinicRecoveryPool?.fresh)
    ? clinicRecoveryPool.fresh.filter((entry) => !CLINIC_RECOVERABLE_ITEMS.includes(normalizeBuildingSpecialActionKey(entry?.itemType).replace(/\s+/g, "-")))
    : [];
  return {
    fresh,
    totalFreshAmount: fresh.reduce((total, entry) => total + Math.max(0, Math.floor(Number(entry?.amount || 0))), 0)
  };
}

export function createBuildingSpecialActionAuditRows() {
  const rows = [];
  const allKeys = new Set([
    ...Object.keys(DISTRICT_BUILDING_DETAIL_PROFILES),
    ...Object.keys(DISTRICT_BUILDING_SPECIAL_ACTION_PROFILES)
  ]);
  for (const buildingKey of [...allKeys].sort()) {
    const profile = DISTRICT_BUILDING_DETAIL_PROFILES[buildingKey] || {};
    const actions = Array.isArray(profile.actions) ? profile.actions : [];
    const actionProfiles = DISTRICT_BUILDING_SPECIAL_ACTION_PROFILES[buildingKey] || [];
    const max = Math.max(actions.length, actionProfiles.length);
    for (let index = 0; index < max; index += 1) {
      const label = actions[index] || "";
      const actionProfile = actionProfiles[index] || null;
      const definition = resolveBuildingSpecialActionDefinition({
        buildingName: buildingKey,
        actionLabel: label || `profil ${index + 1}`,
        actionIndex: index,
        actionProfile
      });
      rows.push({
        buildingName: buildingKey,
        actionId: definition.actionId,
        label: label || "(není v kartě)",
        inCard: Boolean(label),
        inSpecialProfiles: Boolean(actionProfile),
        hasRuntimeHandler: definition.status === "implemented",
        hasServerConfig: definition.hasServerConfig,
        cooldownMs: definition.cooldownMs,
        status: definition.status,
        note: definition.handlerId === "server-run-building-action"
          ? "Server-authoritative handler"
          : "Missing handler - hidden from card UI"
      });
    }
  }
  return rows;
}

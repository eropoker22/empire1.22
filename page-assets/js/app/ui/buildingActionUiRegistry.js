const UNKNOWN_ACTION_ICON = "•";

const ACTION_UI_BY_ID = Object.freeze({
  "vybrat obyvatele": Object.freeze({ label: "Vybrat obyvatele", icon: "POP", category: "population", badge: "Populace" }),
  "stabilizacni protokol": Object.freeze({ label: "Stabilizační protokol", icon: "MED", category: "support", badge: "Klinika" }),
  "vecerni kurz": Object.freeze({ label: "Večerní kurz", icon: "EDU", category: "support", badge: "Škola" }),
  "vybrat trzby": Object.freeze({ label: "Vybrat tržby", icon: "CASH", category: "economy", badge: "Cashflow" }),
  "kryt schuzky": Object.freeze({ label: "Krýt schůzky", icon: "NET", category: "influence", badge: "Síť" }),
  "posilit lokalni sit": Object.freeze({ label: "Posílit lokální síť", icon: "NET", category: "influence", badge: "Síť" }),
  "nocni automaty": Object.freeze({ label: "Noční automaty", icon: "BOOST", category: "boost", badge: "Boost" }),
  "zadni pokladna": Object.freeze({ label: "Zadní pokladna", icon: "CASH", category: "laundering", badge: "Praní" }),
  "vyhodny kurz": Object.freeze({ label: "Výhodný kurz", icon: "FX", category: "laundering", badge: "Praní" }),
  "ticha herna": Object.freeze({ label: "Tichá herna", icon: "VIP", category: "laundering", badge: "Kasino" }),
  "vip noc": Object.freeze({ label: "VIP noc", icon: "VIP", category: "boost", badge: "Boost" }),
  "podplaceny inspektor": Object.freeze({ label: "Podplacený inspektor", icon: "HEAT", category: "heat", badge: "Heat" }),
  "spustit prodej": Object.freeze({ label: "Spustit prodej", icon: "DEAL", category: "dirty-cash", badge: "Dealer slot" }),
  "rozsirit distribuci": Object.freeze({ label: "Rozšířit distribuci", icon: "DIST", category: "dirty-cash", badge: "Distribuce" }),
  "vybrat cash": Object.freeze({ label: "Vybrat cash", icon: "CASH", category: "economy", badge: "Cashflow" }),
  "presunout stash": Object.freeze({ label: "Přesunout stash", icon: "STASH", category: "storage", badge: "Sklad" }),
  "vybrat davku": Object.freeze({ label: "Vybrat dávku", icon: "DIRTY", category: "dirty-cash", badge: "Dávka" }),
  "tichy kanal": Object.freeze({ label: "Tichý kanál", icon: "TUN", category: "boost", badge: "Tunel" }),
  "otevrit kanal": Object.freeze({ label: "Otevřít kanál", icon: "TUN", category: "boost", badge: "Tunel" }),
  "speculative buy": Object.freeze({ label: "Spekulativní nákup", icon: "MK+", category: "market", badge: "Burza" }),
  "market pressure": Object.freeze({ label: "Tržní tlak", icon: "P/D", category: "market", badge: "Burza" }),
  "insider window": Object.freeze({ label: "Insider Window", icon: "INS", category: "market", badge: "Burza" }),
  "likviditni injekce": Object.freeze({ label: "Likviditní injekce", icon: "CB+", category: "economy", badge: "Banka" }),
  "liquidity injection": Object.freeze({ label: "Likviditní injekce", icon: "CB+", category: "economy", badge: "Banka" }),
  "zakulisni tlak": Object.freeze({ label: "Zákulisní tlak", icon: "LOBBY", category: "influence", badge: "Lobby" }),
  "tiche vyjednavani": Object.freeze({ label: "Tiché vyjednávání", icon: "DEAL", category: "utility", badge: "Lobby" }),
  "medialni clona": Object.freeze({ label: "Mediální clona", icon: "MEDIA", category: "defense", badge: "Lobby" }),
  "zmrazene ucty": Object.freeze({ label: "Zmrazené účty", icon: "FRZ", category: "protection", badge: "Banka" }),
  "frozen accounts": Object.freeze({ label: "Zmrazené účty", icon: "FRZ", category: "protection", badge: "Banka" }),
  "kurzovni intervence": Object.freeze({ label: "Kurzovní intervence", icon: "STB", category: "market", badge: "Banka" }),
  "currency intervention": Object.freeze({ label: "Kurzovní intervence", icon: "STB", category: "market", badge: "Banka" }),
  "expresni dovoz": Object.freeze({ label: "Expresní dovoz", icon: "AIR", category: "import", badge: "Letiště" }),
  "cerny charter": Object.freeze({ label: "Černý charter", icon: "BM", category: "black-market", badge: "Letiště" }),
  "evakuacni koridor": Object.freeze({ label: "Evakuační koridor", icon: "ESC", category: "mobility", badge: "Letiště" }),
  "uredni kryti": Object.freeze({ label: "Úřední krytí", icon: "COV", category: "politics", badge: "Magistrát" }),
  "mestska zakazka": Object.freeze({ label: "Městská zakázka", icon: "CTY", category: "economy", badge: "Magistrát" }),
  "nouzova vyhlaska": Object.freeze({ label: "Nouzová vyhláška", icon: "DEC", category: "control", badge: "Magistrát" }),
  "hostit vip klienty": Object.freeze({ label: "Hostit VIP klienty", icon: "VIP", category: "boost", badge: "VIP" }),
  "ziskat kompro": Object.freeze({ label: "Získat kompro", icon: "INF", category: "influence", badge: "Vliv" }),
  "ziskat kompromat": Object.freeze({ label: "Získat kompromat", icon: "INF", category: "influence", badge: "Vliv" }),
  "stabilizovat sit": Object.freeze({ label: "Stabilizovat síť", icon: "PWR", category: "support", badge: "Síť" }),
  "napajet vyrobu": Object.freeze({ label: "Napájet výrobu", icon: "PWR", category: "production", badge: "Výroba" }),
  "snizit heat": Object.freeze({ label: "Snížit heat", icon: "HEAT", category: "heat", badge: "Heat" }),
  "snizit vypadky": Object.freeze({ label: "Snížit heat", icon: "HEAT", category: "heat", badge: "Heat" }),
  "vytezit ztraty": Object.freeze({ label: "Vytěžit ztráty", icon: "REC", category: "salvage", badge: "Salvage" }),
  "vyrobit stim pack": Object.freeze({ label: "Vyrobit stim pack", icon: "MED", category: "production", badge: "Lékárna" }),
  "black market med kit": Object.freeze({ label: "Black market med kit", icon: "MED", category: "black-market", badge: "Market" }),
  "medical cover": Object.freeze({ label: "Medical cover", icon: "HEAT", category: "heat", badge: "Krytí" }),
  "overclock batch": Object.freeze({ label: "Overclock batch", icon: "LAB", category: "production", badge: "Lab" }),
  "clean batch": Object.freeze({ label: "Clean batch", icon: "LAB", category: "production", badge: "Lab" }),
  "hidden operation": Object.freeze({ label: "Hidden operation", icon: "STEALTH", category: "heat", badge: "Krytí" }),
  "combat module run": Object.freeze({ label: "Bojový modul", icon: "FACT", category: "production", badge: "Továrna" }),
  "rapid assembly": Object.freeze({ label: "Rapid assembly", icon: "FACT", category: "production", badge: "Továrna" }),
  "industrial overdrive": Object.freeze({ label: "Industrial overdrive", icon: "FACT", category: "boost", badge: "Továrna" }),
  "attack loadout": Object.freeze({ label: "Attack loadout", icon: "ATK", category: "weapons", badge: "Výzbroj" }),
  "defense kit": Object.freeze({ label: "Defense kit", icon: "DEF", category: "weapons", badge: "Obrana" }),
  "fortify district": Object.freeze({ label: "Fortify district", icon: "DEF", category: "weapons", badge: "Obrana" }),
  "zkontrolovat provoz": Object.freeze({ label: "Zkontrolovat provoz", icon: "CHK", category: "inspection", badge: "Kontrola" }),
  "vybrat lokalni vynos": Object.freeze({ label: "Vybrat lokální výnos", icon: "CASH", category: "economy", badge: "Výnos" }),
  "proverit napojeni": Object.freeze({ label: "Prověřit napojení", icon: "NET", category: "influence", badge: "Napojení" })
});

const AUTO_SALON_ACTION_CATEGORY_LABELS = Object.freeze({
  gangMovement: "přesuny gangu",
  equipmentTransfer: "výbava",
  resourceTransfer: "zásoby",
  districtRobbery: "district loupeže",
  districtOccupy: "obsazení districtu",
  attackPreparation: "příprava útoku",
  defenseRepair: "opravy obrany",
  defenseRestore: "obnova obrany",
  retreatReturn: "návrat po útoku/ústupu",
  attackTravelTime: "cesta k útoku",
  defenseReposition: "obranný přesun",
  clinicEvacuationRecovery: "evakuace kliniky",
  recyclingSalvageTransport: "odvoz vytěžených ztrát",
  moneyLaundering: "praní peněz",
  casinoActions: "kasino",
  exchangeOfficeActions: "směnárna",
  arcadeLaunderingActions: "herna",
  rumorGeneration: "drby",
  passiveProduction: "pasivní výroba",
  intelScan: "intel scan",
  trapDetection: "detekce pastí"
});

const HIDDEN_ACTION_CATEGORY_LABELS = new Set([
  "gangMovement",
  "equipmentTransfer",
  "resourceTransfer"
]);

function normalizeActionId(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function safeActionId(actionId) {
  return String(actionId ?? "").trim();
}

function getActionUiEntry(actionId) {
  return ACTION_UI_BY_ID[normalizeActionId(actionId)] || null;
}

function formatMoneyValue(value, options = {}) {
  const formatter = typeof options.formatMoney === "function"
    ? options.formatMoney
    : (amount) => `$${Math.max(0, Math.floor(Number(amount || 0))).toLocaleString("cs-CZ")}`;
  return formatter(value);
}

function formatCompactNumber(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "0";
  const rounded = Math.round(numeric * 100) / 100;
  return Number.isInteger(rounded)
    ? String(rounded)
    : rounded.toFixed(2).replace(/\.?0+$/u, "");
}

function formatHourlyMoneyChange(label, baseValue, pctValue, options = {}) {
  const base = Math.max(0, Number(baseValue || 0));
  const pct = Number(pctValue);
  if (!Number.isFinite(base) || base <= 0 || !Number.isFinite(pct) || Math.abs(pct) < 0.001) {
    return "";
  }
  const effective = Math.max(0, Math.floor(base * (1 + pct / 100) + 1e-9));
  if (Math.abs(effective - base) < 0.001) {
    return "";
  }
  return `${label} ${formatMoneyValue(base, options)}/h -> ${formatMoneyValue(effective, options)}/h`;
}

function formatDailyNumberChange(label, baseValue, pctValue) {
  const base = Math.max(0, Number(baseValue || 0));
  const pct = Number(pctValue);
  if (!Number.isFinite(base) || base <= 0 || !Number.isFinite(pct) || Math.abs(pct) < 0.001) {
    return "";
  }
  const effective = Math.max(0, Math.floor(base * (1 + pct / 100) + 1e-9));
  if (Math.abs(effective - base) < 0.001) {
    return "";
  }
  return `${label} ${formatCompactNumber(base)}/den -> ${formatCompactNumber(effective)}/den`;
}

function formatPctLabel(label, value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || Math.abs(numeric) < 0.001) {
    return "";
  }
  return `${label} ${numeric > 0 ? "+" : ""}${formatCompactNumber(numeric)}%`;
}

function formatReductionPctLabel(label, value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || Math.abs(numeric) < 0.001) {
    return "";
  }
  return `${label} -${formatCompactNumber(Math.abs(numeric))}%`;
}

function formatIncomeBoostParts(profile = {}, options = {}) {
  const mechanics = options.mechanics || {};
  const parts = [];
  const incomeBoostPct = Number(profile.incomeBoostPct || 0);
  if (incomeBoostPct) {
    const clean = formatHourlyMoneyChange("Clean", mechanics.cleanHourly, incomeBoostPct, options);
    const dirty = formatHourlyMoneyChange("Dirty", mechanics.dirtyHourly, incomeBoostPct, options);
    if (clean) parts.push(clean);
    if (dirty) parts.push(dirty);
    if (!clean && !dirty) parts.push(`Income +${formatCompactNumber(incomeBoostPct)}%`);
  }

  const cleanBoostPct = Number(profile.cleanIncomeBoostPct || 0);
  if (cleanBoostPct) {
    parts.push(formatHourlyMoneyChange("Clean", mechanics.cleanHourly, cleanBoostPct, options) || `Clean income +${formatCompactNumber(cleanBoostPct)}%`);
  }

  const dirtyBoostPct = Number(profile.dirtyIncomeBoostPct || 0);
  if (dirtyBoostPct) {
    parts.push(formatHourlyMoneyChange("Dirty", mechanics.dirtyHourly, dirtyBoostPct, options) || `Dirty income +${formatCompactNumber(dirtyBoostPct)}%`);
  }

  const influenceBoostPct = Number(profile.influenceBoostPct || 0);
  if (influenceBoostPct) {
    parts.push(formatDailyNumberChange("Vliv", mechanics.dailyInfluence, influenceBoostPct) || `Vliv +${formatCompactNumber(influenceBoostPct)}%`);
  }

  return parts;
}

function formatActionProfileConfiguredEffects(profile = {}, options = {}) {
  const mechanics = options.mechanics || {};
  const parts = [];

  if (Number(profile.baseRewardCleanCash || 0) > 0) {
    const baseReward = Number(profile.baseRewardCleanCash);
    const perBuilding = Number(profile.rewardPerCleanEconomyBuilding || profile.rewardPerLegalBuilding || 0);
    const maxReward = Number(profile.maxRewardCleanCash || 0);
    const rewardParts = [`Clean cash ${formatMoneyValue(baseReward, options)}`];
    if (perBuilding > 0) rewardParts.push(`+${formatMoneyValue(perBuilding, options)} za budovu`);
    if (maxReward > 0) rewardParts.push(`max ${formatMoneyValue(maxReward, options)}`);
    parts.push(rewardParts.join(" · "));
  }

  const influenceProduction = Number(profile.influenceProductionBonusPct || 0);
  if (influenceProduction) {
    parts.push(formatDailyNumberChange("Vliv", mechanics.dailyInfluence, influenceProduction) || formatPctLabel("Produkce vlivu", influenceProduction));
  }

  parts.push(
    Number.isFinite(Number(profile.heatSuccess)) ? `Heat při úspěchu ${Number(profile.heatSuccess) > 0 ? "+" : ""}${formatCompactNumber(profile.heatSuccess)}` : "",
    Number.isFinite(Number(profile.influenceSuccess)) ? `Vliv při úspěchu +${formatCompactNumber(profile.influenceSuccess)}` : "",
    formatReductionPctLabel("Audit risk", profile.auditRiskReductionPct),
    formatPctLabel("Pouliční dealeři cena", profile.dealerSalePriceBonusPct),
    formatPctLabel("Pouliční dealeři reward", profile.dealerRewardBonusPct),
    formatReductionPctLabel("Pouliční dealeři čas prodeje", profile.dealerSaleSpeedBonusPct),
    formatPctLabel("Pump", profile.pumpPct),
    formatPctLabel("Dump", profile.dumpPct),
    formatPctLabel("Black market dopad", profile.blackMarketEffectSharePct),
    Number(profile.trendHints || 0) > 0 ? `Trend hinty +${formatCompactNumber(profile.trendHints)}` : "",
    formatReductionPctLabel("Market fee", profile.extraFeeReductionPct || profile.marketFeeReductionPct),
    formatPctLabel("Šance spekulace", profile.speculativeSuccessBonusPct),
    formatPctLabel("Ochrana clean cash", profile.cleanCashProtectionBonusPct),
    formatPctLabel("Ochrana dirty cash", profile.dirtyCashProtectionPct),
    formatReductionPctLabel("Pokuty", profile.fineReductionPct),
    formatReductionPctLabel("Volatilita", profile.volatilityReductionPct),
    profile.priceMoveCapPct ? `Limit pohybu ceny ${formatCompactNumber(profile.priceMoveCapPct)}%` : "",
    formatReductionPctLabel("Efekt Burzy", profile.stockExchangeEffectReductionPct),
    formatReductionPctLabel("Heat gain", profile.heatGainReductionPct),
    formatReductionPctLabel("Policejní kontrola", profile.policeControlChanceReductionPct),
    formatReductionPctLabel("Šance drbů", profile.rumorChanceReductionPct),
    formatReductionPctLabel("Cena influence akcí", profile.influenceActionCostReductionPct),
    formatReductionPctLabel("Negativní drby", profile.negativeRumorReductionPct),
    formatPctLabel("District pressure", profile.districtControlPressurePct),
    formatReductionPctLabel("Cooldowny", profile.cooldownRemainingReductionPct),
    formatReductionPctLabel("Riziko", profile.riskReductionPct),
    formatReductionPctLabel("Další influence akce", profile.nextInfluenceActionDiscountPct),
    formatReductionPctLabel("Pravdivost drbů", profile.truthReductionPct),
    formatPctLabel("Raid warning", profile.policeRaidWarningChancePct),
    formatPctLabel("Black market sleva", profile.offerDiscountPct),
    formatPctLabel("Šance úniku", profile.escapeChanceBonusPct),
    formatReductionPctLabel("Ztráty", profile.lossReductionPct),
    profile.modes ? `Režimy ${profile.modes}` : "",
    String(profile.serverEffectSummary || "").trim()
  );

  return parts.filter(Boolean);
}

function formatCooldownValue(value, options = {}) {
  const formatter = typeof options.formatCooldown === "function"
    ? options.formatCooldown
    : (durationMs) => {
        const totalSeconds = Math.max(0, Math.ceil(Number(durationMs || 0) / 1000));
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return minutes > 0
          ? `${minutes}m ${String(seconds).padStart(2, "0")}s`
          : `${seconds}s`;
      };
  return formatter(value);
}

function getWeaponLabel(itemId, options = {}) {
  return options.weaponLabels?.[itemId] || itemId;
}

function getResourceLabel(itemId, options = {}) {
  return typeof options.getResourceLabel === "function"
    ? options.getResourceLabel(itemId)
    : itemId;
}

function normalizeFactorySupplyKey(itemId, options = {}) {
  return typeof options.normalizeResourceKey === "function"
    ? options.normalizeResourceKey(itemId)
    : itemId;
}

export function getActionLabel(actionId) {
  return getActionUiEntry(actionId)?.label || safeActionId(actionId) || "Akce";
}

export function getActionIcon(actionId) {
  return getActionUiEntry(actionId)?.icon || UNKNOWN_ACTION_ICON;
}

export function getActionDescription(actionId, options = {}) {
  const actionKey = normalizeActionId(actionId);
  const mechanics = options.mechanics || {};
  const actionProfile = options.actionProfile || null;

  if (actionProfile) {
    const actionSummary = String(actionProfile.summary || "").trim();
    const actionEffectSummary = formatBuildingActionOutputProfile(actionProfile, options);
    const uniqueActionEffectSummary = actionEffectSummary !== actionSummary ? actionEffectSummary : "";
    const parts = [
      actionProfile.casinoQuietBackroom ? `Pere ${actionProfile.dirtySharePct}% aktuálního dirty cash, max ${formatMoneyValue(mechanics.casinoLaunderingCapacity || actionProfile.maxDirty, options)}` : "",
      actionProfile.casinoVipNight ? uniqueActionEffectSummary : "",
      actionProfile.casinoBribedInspector ? `Cena ${formatMoneyValue(actionProfile.cleanCost, options)} · šance selhání ${actionProfile.failureChancePct}%` : "",
      actionProfile.exchangeOfficeGoodRate ? `Pere ${actionProfile.dirtySharePct}% aktuálního dirty cash, max ${formatMoneyValue(mechanics.exchangeLaunderingCapacity || actionProfile.maxDirty, options)}` : "",
      actionProfile.arcadeNightMachines ? uniqueActionEffectSummary : "",
      actionProfile.arcadeBackCashdesk ? `Pere ${actionProfile.dirtySharePct}% aktuálního dirty cash, max ${formatMoneyValue(mechanics.arcadeLaunderingCapacity || actionProfile.maxDirty, options)}` : "",
      actionProfile.apartmentCollectPopulation ? `Vybere ${mechanics.apartmentWholePopulation}/${mechanics.apartmentCapacity} obyvatel do členů gangu` : "",
      actionProfile.clinicStabilizationProtocol ? `Cena ${formatMoneyValue(actionProfile.cleanCost, options)} · recovery ${mechanics.clinicRecoveryRatePct}% · pool ${mechanics.clinicRecoveryPool?.totalFreshAmount || 0} položek` : "",
      actionProfile.schoolEveningCourse ? `Cena ${formatMoneyValue(actionProfile.cleanCost, options)} · bytové bloky +${actionProfile.apartmentPopulationBoostPct}% nábor členů · efekt ${formatCooldownValue(actionProfile.durationMs, options)}` : "",
      actionProfile.clean ? `Clean +${formatMoneyValue(actionProfile.clean, options)}` : "",
      actionProfile.dirty ? `Dirty cash +${formatMoneyValue(actionProfile.dirty, options)}` : "",
      actionProfile.influence ? `Vliv +${actionProfile.influence}` : "",
      actionProfile.heat ? `Heat ${actionProfile.heat > 0 ? "+" : ""}${actionProfile.heat}` : "",
      ...Object.entries(actionProfile.materials || {}).map(([itemId, amount]) => `${itemId} x${amount}`),
      ...Object.entries(actionProfile.drugs || {}).map(([itemId, amount]) => `${itemId} x${amount}`),
      ...Object.entries(actionProfile.weapons || {}).map(([itemId, amount]) => `${getWeaponLabel(itemId, options)} x${amount}`),
      ...Object.entries(actionProfile.factorySupplies || {}).map(([itemId, amount]) => `${itemId} x${amount}`),
      !actionProfile.casinoVipNight && !actionProfile.arcadeNightMachines ? uniqueActionEffectSummary : "",
      actionProfile.cooldownMs ? `Cooldown ${formatCooldownValue(actionProfile.cooldownMs, options)}` : ""
    ].filter(Boolean).filter((part, index, list) => list.indexOf(part) === index);

    return parts.length > 0
      ? `${actionSummary || "Speciální akce budovy."} ${parts.join(" · ")}.`
      : actionSummary || "Speciální akce budovy se zapíše do dev-only zdrojů.";
  }

  if (actionKey.includes("collect gang") || actionKey.includes("nabor")) {
    return `Přidá ${mechanics.memberGain} členů gangu podle levelu budovy.`;
  }
  if (actionKey.includes("collect stored") || actionKey.includes("material") || actionKey.includes("zasob")) {
    return `Vygeneruje skladové zásoby: Chemicals x${mechanics.materialGain} a Metal Parts x${mechanics.materialGain}.`;
  }
  if (actionKey.includes("launder")) {
    return `Vypere až ${formatMoneyValue(mechanics.moneyActionAmount, options)} dirty cash se ztrátou provize.`;
  }
  if (actionKey.includes("exchange")) {
    return `Smění až ${formatMoneyValue(mechanics.moneyActionAmount, options)} dirty cash na clean cash.`;
  }
  if (actionKey.includes("vliv") || actionKey.includes("intel") || actionKey.includes("monitor")) {
    return `Přidá +${mechanics.influenceActionGain} vliv a aktualizuje horní lištu.`;
  }
  if (actionKey.includes("heat") || actionKey.includes("stopu") || actionKey.includes("zakryt")) {
    return "Sníží heat a zapíše výsledek do informačního panelu.";
  }
  if (actionKey.includes("cash") || actionKey.includes("trzb") || actionKey.includes("zisk")) {
    return `Okamžitě vybere část výnosu: ${formatMoneyValue(mechanics.quickCashGain, options)}.`;
  }

  return "Spustí lokální building akci s cooldownem a reportem v informačním panelu.";
}

export function getActionDisabledReason(actionState = {}) {
  const directReason = String(actionState.disabledReason || actionState.reason || "").trim();
  if (directReason) {
    return directReason;
  }

  const activeBoostRemainingMs = Math.max(0, Number(actionState.activeBoostRemainingMs || 0));
  if (activeBoostRemainingMs > 0) {
    return `Boost je aktivní. Zbývá ${formatCooldownValue(activeBoostRemainingMs, actionState)}.`;
  }

  const cooldownRemainingMs = Math.max(0, Number(actionState.cooldownRemainingMs || actionState.cooldownRemaining || 0));
  if (cooldownRemainingMs > 0) {
    return `Akce má cooldown ${formatCooldownValue(cooldownRemainingMs, actionState)}.`;
  }

  return "";
}

export function getBuildingActionUi(actionId, buildingType = "", options = {}) {
  const entry = getActionUiEntry(actionId);
  const label = entry?.label || safeActionId(actionId) || "Akce";

  return {
    actionId: safeActionId(actionId),
    buildingType: safeActionId(buildingType),
    label,
    description: options.description || getActionDescription(actionId, options),
    icon: entry?.icon || UNKNOWN_ACTION_ICON,
    category: entry?.category || "custom",
    badge: entry?.badge || "Akce",
    disabledReason: getActionDisabledReason(options.actionState || {}),
    confirmationText: options.confirmationText || `Spustit akci ${label}?`
  };
}

export function formatBuildingActionOutputProfile(profile = {}, options = {}) {
  const mechanics = options.mechanics || {};
  const incomeBoostParts = formatIncomeBoostParts(profile, options);
  const configuredEffectParts = formatActionProfileConfiguredEffects(profile, options);
  const parts = [
    profile.casinoQuietBackroom ? `Vypere ${profile.dirtySharePct}% dirty cash, max ${formatMoneyValue(mechanics.casinoLaunderingCapacity || profile.maxDirty, options)} · fee ${Number.isFinite(Number(mechanics.casinoLaunderingFeePct)) ? mechanics.casinoLaunderingFeePct : profile.feePct}%` : "",
    profile.casinoVipNight ? incomeBoostParts.join(" · ") : "",
    profile.casinoBribedInspector ? `Cena ${formatMoneyValue(profile.cleanCost, options)} clean · selhání ${profile.failureChancePct}%` : "",
    profile.exchangeOfficeGoodRate ? `Vypere ${profile.dirtySharePct}% dirty cash, max ${formatMoneyValue(mechanics.exchangeLaunderingCapacity || profile.maxDirty, options)} · fee ${profile.feePct}%` : "",
    profile.arcadeNightMachines ? incomeBoostParts.join(" · ") : "",
    profile.arcadeBackCashdesk ? `Vypere ${profile.dirtySharePct}% dirty cash, max ${formatMoneyValue(profile.maxDirty, options)} · fee ${profile.feePct}%` : "",
    profile.apartmentCollectPopulation ? "Přesune uložené obyvatele do členů gangu" : "",
    profile.clinicStabilizationProtocol ? `Recovery pool · cena ${formatMoneyValue(profile.cleanCost, options)} clean · heat +${profile.heat}` : "",
    profile.schoolEveningCourse ? `Večerní kurz · cena ${formatMoneyValue(profile.cleanCost, options)} clean · bytové bloky +${profile.apartmentPopulationBoostPct}% nábor členů` : "",
    profile.clean ? `Clean +${formatMoneyValue(profile.clean, options)}` : "",
    profile.dirty ? `Dirty cash +${formatMoneyValue(profile.dirty, options)}` : "",
    profile.exchangeDirty ? `Převod dirty ${formatMoneyValue(profile.exchangeDirty, options)} -> clean` : "",
    profile.members ? `Členové +${Math.floor(Number(profile.members || 0))}` : "",
    profile.population ? `Obyvatelé +${Math.floor(Number(profile.population || 0))}` : "",
    profile.influence ? `Vliv +${formatCompactNumber(profile.influence)}` : "",
    Number.isFinite(Number(profile.heat)) && Number(profile.heat) !== 0
      ? `Heat ${Number(profile.heat) > 0 ? "+" : ""}${Math.floor(Number(profile.heat))}`
      : "",
    ...Object.entries(profile.materials || {}).map(([itemId, amount]) => `${getResourceLabel(itemId, options)} x${amount}`),
    ...Object.entries(profile.drugs || {}).map(([itemId, amount]) => `${getResourceLabel(itemId, options)} x${amount}`),
    ...Object.entries(profile.weapons || {}).map(([itemId, amount]) => `${getWeaponLabel(itemId, options)} x${amount}`),
    ...Object.entries(profile.factorySupplies || {}).map(([itemId, amount]) => `${getResourceLabel(normalizeFactorySupplyKey(itemId, options), options)} x${amount}`),
    !profile.casinoVipNight && !profile.arcadeNightMachines ? incomeBoostParts.join(" · ") : "",
    ...configuredEffectParts,
    profile.heatMultiplier && Number(profile.heatMultiplier) !== 1
      ? formatDailyNumberChange("Heat", mechanics.dailyHeat, (Number(profile.heatMultiplier) - 1) * 100) || `Heat x${Number(profile.heatMultiplier).toFixed(2)}`
      : "",
    profile.durationMs ? `Trvání ${formatCooldownValue(profile.durationMs, options)}` : "",
    profile.cooldownMs ? `Cooldown ${formatCooldownValue(profile.cooldownMs, options)}` : ""
  ].filter(Boolean);

  const resolved = parts
    .filter(Boolean)
    .filter((part, index, list) => list.indexOf(part) === index)
    .join(" · ");
  return resolved
    || String(profile.serverEffectSummary || "").trim()
    || String(profile.summary || "").trim()
    || "Bez přímého výstupu, používá hlavně lokální efekt.";
}

export function formatBuildingActionRiskProfile(profile = {}, options = {}) {
  const mechanics = options.mechanics || {};
  const risks = [];
  const heat = Number(profile.heat || 0);
  if (heat !== 0) risks.push(`Heat ${heat > 0 ? "+" : ""}${Math.floor(heat)}`);
  const heatMultiplier = Number(profile.heatMultiplier);
  if (Number.isFinite(heatMultiplier) && heatMultiplier !== 1) {
    risks.push(formatDailyNumberChange("Heat", mechanics.dailyHeat, (heatMultiplier - 1) * 100) || `Heat x${heatMultiplier.toFixed(2)}`);
  }
  if (Number(profile.auditRiskBoostPct || 0) > 0) risks.push(`Audit +${formatCompactNumber(profile.auditRiskBoostPct)}%`);
  if (Number(profile.auditRiskFailurePct || 0) > 0) risks.push(`Audit fail +${formatCompactNumber(profile.auditRiskFailurePct)}%`);
  if (Number(profile.failureChancePct || 0) > 0) risks.push(`Selhání ${formatCompactNumber(profile.failureChancePct)}%`);
  if (Number(profile.heatFailure || 0) !== 0) risks.push(`Fail heat ${Number(profile.heatFailure) > 0 ? "+" : ""}${Math.floor(Number(profile.heatFailure))}`);
  if (Number(profile.marketFeePenaltyPct || 0) > 0) risks.push(`Market fee +${formatCompactNumber(profile.marketFeePenaltyPct)}%`);
  if (Number(profile.purchaseCustomsRiskPct || 0) > 0) risks.push(`Celnice +${formatCompactNumber(profile.purchaseCustomsRiskPct)}%`);
  if (Number(profile.heatRiskBonusPct || 0) > 0) risks.push(`Heat risk +${formatCompactNumber(profile.heatRiskBonusPct)}%`);
  if (Number(profile.streetIncidentFlatRiskPct || 0) > 0) risks.push(`Pouliční incident +${formatCompactNumber(profile.streetIncidentFlatRiskPct)}%`);
  return risks.join(" · ") || "Bez přímého heat rizika";
}

export function formatBuildingActionCategoryLabels(categories) {
  return (Array.isArray(categories) ? categories : [])
    .filter((category) => !HIDDEN_ACTION_CATEGORY_LABELS.has(category))
    .map((category) => AUTO_SALON_ACTION_CATEGORY_LABELS[category] || category)
    .join(" · ");
}

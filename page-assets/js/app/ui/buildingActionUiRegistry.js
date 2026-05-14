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
  "ziskat kompromat": Object.freeze({ label: "Získat kompromat", icon: "INF", category: "influence", badge: "Vliv" }),
  "stabilizovat sit": Object.freeze({ label: "Stabilizovat síť", icon: "PWR", category: "support", badge: "Síť" }),
  "napajet vyrobu": Object.freeze({ label: "Napájet výrobu", icon: "PWR", category: "production", badge: "Výroba" }),
  "snizit vypadky": Object.freeze({ label: "Snížit výpadky", icon: "HEAT", category: "heat", badge: "Heat" }),
  "vytezit ztraty": Object.freeze({ label: "Vytěžit ztráty", icon: "REC", category: "salvage", badge: "Salvage" }),
  "vyrobit stim pack": Object.freeze({ label: "Vyrobit stim pack", icon: "MED", category: "production", badge: "Lékárna" }),
  "black market med kit": Object.freeze({ label: "Black market med kit", icon: "MED", category: "black-market", badge: "Market" }),
  "medical cover": Object.freeze({ label: "Medical cover", icon: "HEAT", category: "heat", badge: "Krytí" }),
  "overclock batch": Object.freeze({ label: "Overclock batch", icon: "LAB", category: "production", badge: "Lab" }),
  "clean batch": Object.freeze({ label: "Clean batch", icon: "LAB", category: "production", badge: "Lab" }),
  "hidden operation": Object.freeze({ label: "Hidden operation", icon: "STEALTH", category: "heat", badge: "Krytí" }),
  "combat module run": Object.freeze({ label: "Combat module run", icon: "FACT", category: "production", badge: "Továrna" }),
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
  attackPreparation: "příprava útoku",
  retreatReturn: "návrat",
  attackTravelTime: "cesta k útoku",
  defenseReposition: "obranný přesun",
  clinicEvacuationRecovery: "evakuace kliniky",
  recyclingSalvageTransport: "salvage transport",
  moneyLaundering: "praní peněz",
  casinoActions: "kasino",
  exchangeOfficeActions: "směnárna",
  arcadeLaunderingActions: "herna",
  rumorGeneration: "drby",
  passiveProduction: "pasivní výroba",
  intelScan: "intel scan",
  trapDetection: "detekce pastí"
});

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

function formatCooldownValue(value, options = {}) {
  const formatter = typeof options.formatCooldown === "function"
    ? options.formatCooldown
    : (durationMs) => `${Math.max(0, Math.ceil(Number(durationMs || 0) / 1000))}s`;
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
    const parts = [
      actionProfile.casinoQuietBackroom ? `Pere ${actionProfile.dirtySharePct}% aktuálního dirty cash, max ${formatMoneyValue(actionProfile.maxDirty, options)}` : "",
      actionProfile.casinoVipNight ? `Clean +${actionProfile.cleanIncomeBoostPct}% · Dirty +${actionProfile.dirtyIncomeBoostPct}% · Vliv +${actionProfile.influenceBoostPct}% · Heat +60%` : "",
      actionProfile.casinoBribedInspector ? `Cena ${formatMoneyValue(actionProfile.cleanCost, options)} · šance selhání ${actionProfile.failureChancePct}%` : "",
      actionProfile.exchangeOfficeGoodRate ? `Pere ${actionProfile.dirtySharePct}% aktuálního dirty cash, max ${formatMoneyValue(mechanics.exchangeLaunderingCapacity || actionProfile.maxDirty, options)}` : "",
      actionProfile.arcadeNightMachines ? `Clean +${actionProfile.cleanIncomeBoostPct}% · Dirty +${actionProfile.dirtyIncomeBoostPct}% · Vliv +${actionProfile.influenceBoostPct}% · Heat +45%` : "",
      actionProfile.arcadeBackCashdesk ? `Pere ${actionProfile.dirtySharePct}% aktuálního dirty cash, max ${formatMoneyValue(mechanics.arcadeLaunderingCapacity || actionProfile.maxDirty, options)}` : "",
      actionProfile.apartmentCollectPopulation ? `Vybere ${mechanics.apartmentWholePopulation}/${mechanics.apartmentCapacity} obyvatel do členů gangu` : "",
      actionProfile.clinicStabilizationProtocol ? `Cena ${formatMoneyValue(actionProfile.cleanCost, options)} · recovery ${mechanics.clinicRecoveryRatePct}% · pool ${mechanics.clinicRecoveryPool?.totalFreshAmount || 0} položek` : "",
      actionProfile.schoolEveningCourse ? `Cena ${formatMoneyValue(actionProfile.cleanCost, options)} · studenti +${actionProfile.populationBoostPct}% · talent +${actionProfile.talentChanceBonusPct}% · clean income +${actionProfile.cleanIncomeBoostPct}%` : "",
      actionProfile.clean ? `Clean +${formatMoneyValue(actionProfile.clean, options)}` : "",
      actionProfile.dirty ? `Dirty +${formatMoneyValue(actionProfile.dirty, options)}` : "",
      actionProfile.influence ? `Vliv +${actionProfile.influence}` : "",
      actionProfile.heat ? `Heat ${actionProfile.heat > 0 ? "+" : ""}${actionProfile.heat}` : "",
      ...Object.entries(actionProfile.materials || {}).map(([itemId, amount]) => `${itemId} x${amount}`),
      ...Object.entries(actionProfile.drugs || {}).map(([itemId, amount]) => `${itemId} x${amount}`),
      ...Object.entries(actionProfile.weapons || {}).map(([itemId, amount]) => `${getWeaponLabel(itemId, options)} x${amount}`),
      ...Object.entries(actionProfile.factorySupplies || {}).map(([itemId, amount]) => `${itemId} x${amount}`),
      actionProfile.incomeBoostPct ? `Income +${actionProfile.incomeBoostPct}%` : "",
      actionProfile.cleanIncomeBoostPct ? `Clean income +${actionProfile.cleanIncomeBoostPct}%` : "",
      actionProfile.dirtyIncomeBoostPct ? `Dirty income +${actionProfile.dirtyIncomeBoostPct}%` : "",
      actionProfile.cooldownMs ? `Cooldown ${formatCooldownValue(actionProfile.cooldownMs, options)}` : ""
    ].filter(Boolean);

    return parts.length > 0
      ? `${actionProfile.summary || "Speciální akce budovy."} ${parts.join(" · ")}.`
      : actionProfile.summary || "Speciální akce budovy se zapíše do dev-only zdrojů.";
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
  const parts = [
    profile.casinoQuietBackroom ? `Vypere ${profile.dirtySharePct}% dirty cash, max ${formatMoneyValue(profile.maxDirty, options)}` : "",
    profile.casinoVipNight ? `Clean +${profile.cleanIncomeBoostPct}% · Dirty +${profile.dirtyIncomeBoostPct}% · Vliv +${profile.influenceBoostPct}%` : "",
    profile.casinoBribedInspector ? `Cena ${formatMoneyValue(profile.cleanCost, options)} clean · selhání ${profile.failureChancePct}%` : "",
    profile.exchangeOfficeGoodRate ? `Vypere ${profile.dirtySharePct}% dirty cash, max ${formatMoneyValue(profile.maxDirty, options)} · fee ${profile.feePct}%` : "",
    profile.arcadeNightMachines ? `Clean +${profile.cleanIncomeBoostPct}% · Dirty +${profile.dirtyIncomeBoostPct}% · Vliv +${profile.influenceBoostPct}%` : "",
    profile.arcadeBackCashdesk ? `Vypere ${profile.dirtySharePct}% dirty cash, max ${formatMoneyValue(profile.maxDirty, options)} · fee ${profile.feePct}%` : "",
    profile.apartmentCollectPopulation ? "Přesune uložené obyvatele do členů gangu" : "",
    profile.clinicStabilizationProtocol ? `Recovery pool · cena ${formatMoneyValue(profile.cleanCost, options)} clean · heat +${profile.heat}` : "",
    profile.schoolEveningCourse ? `Večerní kurz · cena ${formatMoneyValue(profile.cleanCost, options)} clean · studenti +${profile.populationBoostPct}% · talent +${profile.talentChanceBonusPct}%` : "",
    profile.clean ? `Clean +${formatMoneyValue(profile.clean, options)}` : "",
    profile.dirty ? `Dirty +${formatMoneyValue(profile.dirty, options)}` : "",
    profile.exchangeDirty ? `Převod dirty ${formatMoneyValue(profile.exchangeDirty, options)} -> clean` : "",
    profile.members ? `Členové +${Math.floor(Number(profile.members || 0))}` : "",
    profile.population ? `Obyvatelé +${Math.floor(Number(profile.population || 0))}` : "",
    profile.influence ? `Vliv +${Math.floor(Number(profile.influence || 0))}` : "",
    Number.isFinite(Number(profile.heat)) && Number(profile.heat) !== 0
      ? `Heat ${Number(profile.heat) > 0 ? "+" : ""}${Math.floor(Number(profile.heat))}`
      : "",
    ...Object.entries(profile.materials || {}).map(([itemId, amount]) => `${getResourceLabel(itemId, options)} x${amount}`),
    ...Object.entries(profile.drugs || {}).map(([itemId, amount]) => `${getResourceLabel(itemId, options)} x${amount}`),
    ...Object.entries(profile.weapons || {}).map(([itemId, amount]) => `${getWeaponLabel(itemId, options)} x${amount}`),
    ...Object.entries(profile.factorySupplies || {}).map(([itemId, amount]) => `${getResourceLabel(normalizeFactorySupplyKey(itemId, options), options)} x${amount}`),
    profile.incomeBoostPct ? `Income +${profile.incomeBoostPct}%` : "",
    profile.cleanIncomeBoostPct ? `Clean income +${profile.cleanIncomeBoostPct}%` : "",
    profile.dirtyIncomeBoostPct ? `Dirty income +${profile.dirtyIncomeBoostPct}%` : "",
    profile.influenceBoostPct ? `Vliv +${profile.influenceBoostPct}%` : "",
    profile.heatMultiplier && Number(profile.heatMultiplier) !== 1 ? `Heat x${Number(profile.heatMultiplier).toFixed(2)}` : "",
    profile.durationMs ? `Trvání ${formatCooldownValue(profile.durationMs, options)}` : "",
    profile.cooldownMs ? `Cooldown ${formatCooldownValue(profile.cooldownMs, options)}` : ""
  ].filter(Boolean);

  return parts.join(" · ") || "Bez přímého výstupu, používá hlavně lokální efekt.";
}

export function formatBuildingActionCategoryLabels(categories) {
  return (Array.isArray(categories) ? categories : [])
    .map((category) => AUTO_SALON_ACTION_CATEGORY_LABELS[category] || category)
    .join(" · ");
}

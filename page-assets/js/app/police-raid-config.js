const HOUR_MS = 60 * 60 * 1000;

const range = (min, max = min) => Object.freeze([min, max]);

const TIER_EFFECTS = Object.freeze({
  1: Object.freeze({
    incomePct: range(10), cleanPct: range(0, 2), dirtyPct: range(8, 15), membersPct: range(1, 2), influencePct: range(5),
    actionBan: "špehování", production: "bez omezení výroby"
  }),
  2: Object.freeze({
    incomePct: range(20), cleanPct: range(2, 7), dirtyPct: range(16, 20), drugPct: range(5), membersPct: range(3, 7),
    attackWeaponPct: range(3), influencePct: range(6, 8), actionBan: "špehování + vykrást", production: "Lékárna -10 %, Lab -10 %"
  }),
  3: Object.freeze({
    incomePct: range(21, 26), cleanPct: range(2, 7), dirtyPct: range(16, 20), drugPct: range(6, 9), membersPct: range(7, 12),
    attackWeaponPct: range(3, 8), defenseWeaponPct: range(3, 8), influencePct: range(8, 12), actionBan: "špehování, vykrást, útok",
    production: "Lékárna + Lab -11 až -13 %, Zbrojovka -8 až -13 %"
  }),
  4: Object.freeze({
    incomePct: range(26, 33), cleanPct: range(7, 12), dirtyPct: range(18, 23), drugPct: range(10, 15), membersPct: range(11, 17),
    attackWeaponPct: range(11), defenseWeaponPct: range(11), attackPowerPct: range(8), defensePowerPct: range(10), influencePct: range(11, 14),
    actionBan: "špehování, vykrást, útok, obsadit + Lékárna/Továrna speciální akce",
    production: "Lékárna + Lab -13 až -15 %, Zbrojovka -12 až -16 %"
  }),
  5: Object.freeze({
    incomePct: range(32, 40), cleanPct: range(14, 18), dirtyPct: range(23, 28), materialPct: range(30), drugPct: range(15, 17),
    membersPct: range(18, 23), attackWeaponPct: range(13), defenseWeaponPct: range(14), attackPowerPct: range(15), defensePowerPct: range(15),
    influencePct: range(14, 17), actionBan: "špehování, vykrást, útok, obsadit + speciální akce budov",
    production: "silně omezená výroba po dobu razie"
  }),
  6: Object.freeze({
    incomePct: range(100), cleanPct: range(25), dirtyPct: range(45), materialPct: range(35), drugPct: range(23), membersPct: range(30),
    attackWeaponPct: range(20), defenseWeaponPct: range(20), attackPowerPct: range(30), defensePowerPct: range(30), influencePct: range(25),
    actionBan: "všechny akce včetně speciálních akcí v budovách", production: "výroba zablokovaná po dobu razie"
  })
});

const pct = ([min = 0, max = min] = []) => Math.round(min + (Math.random() * Math.max(0, max - min)));
const pctWithRandom = ([min = 0, max = min] = [], random = Math.random) => Math.round(min + (random() * Math.max(0, max - min)));
const label = ([min = 0, max = min] = []) => min === max ? `${min}%` : `${min}-${max}%`;

const OPERATION_IMPACT_PROFILES = Object.freeze({
  warning_notice: Object.freeze({
    severity: "low",
    actionBan: "bez tvrdého zákazu",
    production: "bez přímého zabavení"
  }),
  district_control: Object.freeze({
    severity: "medium",
    incomePct: range(12, 20),
    actionBan: "špehování a hlučné akce pod dohledem",
    production: "district income dočasně snížen"
  }),
  cash_seizure: Object.freeze({
    severity: "medium",
    cleanPct: range(9),
    incomePct: range(8, 14),
    actionBan: "finanční akce pod dohledem",
    production: "čistý cashflow je prověřen"
  }),
  warehouse_raid: Object.freeze({
    severity: "high",
    dirtyPct: range(16),
    drugPct: range(28),
    materialPct: range(8, 12),
    incomePct: range(18, 28),
    actionBan: "vykrádání a skladové přesuny omezené",
    production: "sklad a logistika pod tlakem"
  }),
  district_lock: Object.freeze({
    severity: "high",
    incomePct: range(35, 45),
    actionBan: "útok, obsazení a vykrádání dočasně blokované",
    production: "district provoz výrazně omezen"
  }),
  apartment_search: Object.freeze({
    severity: "high",
    membersPct: range(4),
    influencePct: range(4, 7),
    incomePct: range(12, 18),
    actionBan: "špehování a nábor pod dohledem",
    production: "populace a gang members pod tlakem"
  }),
  drug_seizure: Object.freeze({
    severity: "medium",
    drugPct: range(16),
    incomePct: range(10, 16),
    actionBan: "drug lab a distribuce pod dohledem",
    production: "drogová výroba dočasně riziková"
  }),
  dirty_cash_seizure: Object.freeze({
    severity: "high",
    dirtyPct: range(28),
    incomePct: range(12, 20),
    actionBan: "laundering a dirty cash akce pod dohledem",
    production: "špinavý cashflow je prověřen"
  }),
  building_shutdown: Object.freeze({
    severity: "high",
    attackWeaponPct: range(6, 10),
    defenseWeaponPct: range(6, 10),
    materialPct: range(6, 10),
    incomePct: range(20, 35),
    actionBan: "speciální akce budov omezené",
    production: "cílová budova je dočasně utlumená"
  }),
  coordinated_operation: Object.freeze({
    severity: "critical",
    cleanPct: range(14),
    dirtyPct: range(40),
    drugPct: range(40),
    materialPct: range(12, 18),
    attackWeaponPct: range(8, 12),
    defenseWeaponPct: range(8, 12),
    membersPct: range(6, 9),
    influencePct: range(8, 12),
    incomePct: range(45, 65),
    attackPowerPct: range(12, 18),
    defensePowerPct: range(12, 18),
    actionBan: "většina akcí je dočasně blokovaná",
    production: "koordinovaný zásah dusí cash, drogy, sklady i bojové zázemí"
  })
});

const SPECIALTY_LOSS_MULTIPLIERS = Object.freeze({
  financial: Object.freeze({ cleanPct: 1.3, dirtyPct: 1.35, incomePct: 1.1 }),
  drug: Object.freeze({ drugPct: 1.45, dirtyPct: 0.9, incomePct: 1.05 }),
  weapons: Object.freeze({ attackWeaponPct: 1.35, defenseWeaponPct: 1.35, materialPct: 1.25 }),
  arrests: Object.freeze({ membersPct: 1.45, influencePct: 1.15, incomePct: 1.05 }),
  total: Object.freeze({})
});

const OPERATION_LABELS = Object.freeze({
  warning_notice: "Lehká kontrola",
  district_control: "Kontrola districtu",
  cash_seizure: "Zabavení hotovosti",
  warehouse_raid: "Razie na sklad",
  district_lock: "Uzávěra districtu",
  apartment_search: "Domovní prohlídky",
  drug_seizure: "Zabavení drog",
  dirty_cash_seizure: "Zabavení dirty cash",
  building_shutdown: "Uzavření budovy",
  coordinated_operation: "Koordinovaná operace"
});

const percentKeys = [
  "cleanPct",
  "dirtyPct",
  "drugPct",
  "materialPct",
  "membersPct",
  "attackWeaponPct",
  "defenseWeaponPct",
  "influencePct",
  "incomePct",
  "attackPowerPct",
  "defensePowerPct"
];

export function getPoliceTierShortEffect(tierId) {
  const effect = TIER_EFFECTS[tierId] || TIER_EFFECTS[1];
  return `Income -${label(effect.incomePct)} | ${effect.actionBan}`;
}

export function resolvePoliceTierImpact(tierId) {
  const effect = TIER_EFFECTS[tierId] || TIER_EFFECTS[1];
  return {
    durationMs: HOUR_MS,
    cleanPct: pct(effect.cleanPct),
    dirtyPct: pct(effect.dirtyPct),
    drugPct: pct(effect.drugPct),
    materialPct: pct(effect.materialPct),
    membersPct: pct(effect.membersPct),
    attackWeaponPct: pct(effect.attackWeaponPct),
    defenseWeaponPct: pct(effect.defenseWeaponPct),
    influencePct: pct(effect.influencePct),
    incomePct: pct(effect.incomePct),
    attackPowerPct: pct(effect.attackPowerPct),
    defensePowerPct: pct(effect.defensePowerPct),
    effectRows: [
      { label: "Income na 1h", value: `-${label(effect.incomePct)} globálně` },
      { label: "Zabavení", value: `clean ${label(effect.cleanPct)} • dirty ${label(effect.dirtyPct)}` },
      effect.drugPct ? { label: "Drogy", value: `-${label(effect.drugPct)}` } : null,
      effect.materialPct ? { label: "Materiály", value: `-${label(effect.materialPct)} včetně factory supplies` } : null,
      { label: "Zatčení", value: `-${label(effect.membersPct)} obyvatel` },
      effect.attackWeaponPct || effect.defenseWeaponPct ? { label: "Zbraně", value: `attack -${label(effect.attackWeaponPct)} • defense -${label(effect.defenseWeaponPct)}` } : null,
      effect.attackPowerPct || effect.defensePowerPct ? { label: "Síla zbraní", value: `útok -${label(effect.attackPowerPct)} • obrana -${label(effect.defensePowerPct)}` } : null,
      { label: "Vliv", value: `-${label(effect.influencePct)}` },
      { label: "Zákaz akcí", value: effect.actionBan },
      { label: "Výroba", value: effect.production }
    ].filter(Boolean)
  };
}

export function resolvePoliceOperationImpact(tierId, operationType, specialtyKey = "total", random = Math.random) {
  const tierEffect = TIER_EFFECTS[tierId] || TIER_EFFECTS[1];
  const operationKey = String(operationType || "warning_notice").trim().toLowerCase();
  const profile = OPERATION_IMPACT_PROFILES[operationKey] || OPERATION_IMPACT_PROFILES.warning_notice;
  const multipliers = SPECIALTY_LOSS_MULTIPLIERS[String(specialtyKey || "total").trim().toLowerCase()] || SPECIALTY_LOSS_MULTIPLIERS.total;
  const impact = {
    durationMs: HOUR_MS,
    operationKey,
    operationLabel: OPERATION_LABELS[operationKey] || "Policejní akce",
    severity: profile.severity || "medium",
    actionBan: profile.actionBan || tierEffect.actionBan,
    production: profile.production || tierEffect.production
  };

  for (const key of percentKeys) {
    const rawRange = profile[key] || range(0);
    const basePct = pctWithRandom(rawRange, random);
    const multiplier = Number(multipliers[key] || 1);
    impact[key] = Math.max(0, Math.min(100, Math.round(basePct * multiplier)));
  }

  impact.effectRows = [
    { label: "Typ razie", value: `${impact.operationLabel} • ${impact.severity}` },
    impact.incomePct > 0 ? { label: "Income po dobu razie", value: `-${impact.incomePct}%` } : null,
    impact.cleanPct > 0 || impact.dirtyPct > 0 ? { label: "Zabavení cash", value: `clean ${impact.cleanPct}% • dirty ${impact.dirtyPct}%` } : null,
    impact.drugPct > 0 ? { label: "Drogy", value: `-${impact.drugPct}%` } : null,
    impact.materialPct > 0 ? { label: "Materiály", value: `-${impact.materialPct}% včetně factory supplies` } : null,
    impact.membersPct > 0 ? { label: "Zatčení", value: `-${impact.membersPct}% obyvatel` } : null,
    impact.attackWeaponPct > 0 || impact.defenseWeaponPct > 0 ? { label: "Zbraně", value: `attack -${impact.attackWeaponPct}% • defense -${impact.defenseWeaponPct}%` } : null,
    impact.attackPowerPct > 0 || impact.defensePowerPct > 0 ? { label: "Síla zbraní", value: `útok -${impact.attackPowerPct}% • obrana -${impact.defensePowerPct}%` } : null,
    impact.influencePct > 0 ? { label: "Vliv", value: `-${impact.influencePct}%` } : null,
    { label: "Zákaz akcí", value: impact.actionBan },
    { label: "Výroba", value: impact.production }
  ].filter(Boolean);

  return impact;
}

export const GANG_HEAT_DIRTY_COST = 2_500;
export const GANG_HEAT_DIRTY_REDUCTION = 5;
export const GANG_HEAT_CLEAN_COST = 10_000;
export const GANG_HEAT_CLEAN_REDUCTION = 10;
export const GANG_HEAT_INFLUENCE_COST = 50;
export const GANG_HEAT_INFLUENCE_REDUCTION = 15;
export const GANG_HEAT_AUDIT_WINDOW_MS = 30 * 60 * 1000;
export const GANG_HEAT_AUDIT_RISK_PER_ACTION_PCT = 10;
export const GANG_HEAT_AUDIT_RISK_MAX_PCT = 100;
export const GANG_HEAT_DIRTY_TRIGGER_WINDOW_MS = 30 * 60 * 1000;
export const GANG_HEAT_DIRTY_TRIGGER_COUNT = 3;
export const GANG_HEAT_POLICE_DURATION_MS = 60 * 60 * 1000;
export const GANG_HEAT_RAID_PROTECTION_MS = 4 * 60 * 60 * 1000;
export const GANG_HEAT_JOURNAL_LIMIT = 18;

export function resolveGangHeatAuditRisk(timestamps = [], now = Date.now()) {
  const safeNow = Number(now);
  const recentActionCount = (Array.isArray(timestamps) ? timestamps : []).filter((entry) => {
    const timestamp = Number(entry);
    const ageMs = safeNow - timestamp;
    return Number.isFinite(timestamp) && ageMs >= 0 && ageMs <= GANG_HEAT_AUDIT_WINDOW_MS;
  }).length;
  return Math.min(GANG_HEAT_AUDIT_RISK_MAX_PCT, recentActionCount * GANG_HEAT_AUDIT_RISK_PER_ACTION_PCT);
}

export const GANG_HEAT_AUTO_POLICE_INTERVAL_BY_TIER = Object.freeze({
  1: 0,
  2: 4 * 60 * 1000,
  3: 3 * 60 * 1000,
  4: 2 * 60 * 1000,
  5: 90 * 1000,
  6: 60 * 1000
});
export const GANG_HEAT_TIERS = Object.freeze([
  Object.freeze({
    id: 1,
    minHeat: 0,
    maxHeat: 24,
    label: "Tier 1",
    title: "Nízký heat",
    description: "Lehký dohled. Gang je skoro pod radarem."
  }),
  Object.freeze({
    id: 2,
    minHeat: 25,
    maxHeat: 74,
    label: "Tier 2",
    title: "Podezřelý",
    description: "Policie už si všímá provozu, cashflow a pohybu lidí."
  }),
  Object.freeze({
    id: 3,
    minHeat: 75,
    maxHeat: 149,
    label: "Tier 3",
    title: "Známý problém",
    description: "Častější kontroly, víc otázek a první cílené zásahy."
  }),
  Object.freeze({
    id: 4,
    minHeat: 150,
    maxHeat: 299,
    label: "Tier 4",
    title: "Rizikový cíl",
    description: "Aktivní tlak na distrikty, sklady a krycí provozy."
  }),
  Object.freeze({
    id: 5,
    minHeat: 300,
    maxHeat: 499,
    label: "Tier 5",
    title: "Prioritní cíl",
    description: "Těžké razie, zabavení zásob a rychlé uzávěry districtů."
  }),
  Object.freeze({
    id: 6,
    minHeat: 500,
    maxHeat: Number.POSITIVE_INFINITY,
    label: "Tier 6",
    title: "Totální hon",
    description: "Koordinované zásahy, tvrdé blokády a permanentní tlak."
  })
]);
export const GANG_HEAT_DECAY_BY_TIER = Object.freeze({
  1: 4,
  2: 3,
  3: 2,
  4: 1.5,
  5: 1,
  6: 0.6
});

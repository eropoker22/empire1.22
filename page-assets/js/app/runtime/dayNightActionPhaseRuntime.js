export const PHASE_LOCKED_BUILDING_ACTION_RULES = Object.freeze({
  night_machines: Object.freeze({
    allowedPhase: "night",
    blockedReason: "Noční automaty se rozjíždí až po setmění."
  }),
  vip_night: Object.freeze({
    allowedPhase: "night",
    blockedReason: "VIP noc můžeš spustit jen v noci."
  }),
  black_charter: Object.freeze({
    allowedPhase: "night",
    blockedReason: "Černý charter odlétá jen v noci."
  }),
  parliament_policy_window: Object.freeze({
    allowedPhase: "day",
    blockedReason: "Policy Window se otevírá jen přes den."
  }),
  restaurant_collect_revenue: Object.freeze({
    allowedPhase: "day",
    blockedReason: "Tržby restaurace můžeš vybrat jen přes den."
  }),
  good_rate: Object.freeze({
    allowedPhase: "day",
    blockedReason: "Výhodný kurz můžeš spustit jen přes den."
  })
});

export function normalizeDayNightPhaseId(phaseState = null) {
  const rawPhase = typeof phaseState === "string"
    ? phaseState
    : phaseState?.mapPhase ?? phaseState?.phaseId ?? phaseState?.phase ?? phaseState?.uiThemeHint ?? "";
  const normalized = String(rawPhase || "").trim().toLowerCase();
  if (normalized === "day" || normalized === "den" || normalized.includes("day")) {
    return "day";
  }
  if (normalized === "night" || normalized === "noc" || normalized.includes("night")) {
    return "night";
  }
  return "";
}

export function getPhaseLockedBuildingActionRule(actionId = "") {
  return PHASE_LOCKED_BUILDING_ACTION_RULES[String(actionId || "").trim()] || null;
}

export function resolvePhaseLockedBuildingActionDisabledReason(actionId = "", phaseState = null) {
  const rule = getPhaseLockedBuildingActionRule(actionId);
  if (!rule) {
    return "";
  }
  const phase = normalizeDayNightPhaseId(phaseState);
  if (!phase || phase === rule.allowedPhase) {
    return "";
  }
  return rule.blockedReason || (
    rule.allowedPhase === "night"
      ? "Tuhle akci můžeš spustit jen v noci."
      : "Tuhle akci můžeš spustit jen ve dne."
  );
}

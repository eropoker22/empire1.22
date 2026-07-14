export const LEGACY_SPY_MISSION_SPY_COUNT = 1;
export const LEGACY_SPY_CRITICAL_HEAT_GAIN = 7;

// Preview-only legacy helpers. Server-authoritative spy results are resolved by game-core command handlers.
export const SPY_OUTCOMES = Object.freeze({
  success: "success",
  partial: "partial",
  failed: "failed",
  criticalFailed: "critical_failed"
});

export const SPY_SCENARIO_LABELS = Object.freeze({
  [SPY_OUTCOMES.success]: "Úspěch",
  [SPY_OUTCOMES.partial]: "Částečný úspěch",
  [SPY_OUTCOMES.failed]: "Neúspěch",
  [SPY_OUTCOMES.criticalFailed]: "Kritický neúspěch"
});

const OUTCOME_BY_SCENARIO_LABEL = Object.freeze(
  Object.fromEntries(Object.entries(SPY_SCENARIO_LABELS).map(([outcome, label]) => [label, outcome]))
);

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const toSafeNumber = (value, fallback = 0) => {
  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : fallback;
};
const toSafeCount = (value) => Math.max(0, Math.floor(toSafeNumber(value, 0)));
const getRoll = (value) => {
  const roll = Number(value);
  return Number.isFinite(roll) ? clamp(roll, 0, 1) : Math.random();
};

export function normalizeSpyOutcome(value) {
  const normalized = String(value || "").trim();
  if (Object.values(SPY_OUTCOMES).includes(normalized)) {
    return normalized;
  }
  return OUTCOME_BY_SCENARIO_LABEL[normalized] || SPY_OUTCOMES.failed;
}

export function getSpyScenarioLabel(outcome) {
  return SPY_SCENARIO_LABELS[normalizeSpyOutcome(outcome)] || SPY_SCENARIO_LABELS[SPY_OUTCOMES.failed];
}

export function calculateSpySuccessChance(options = {}) {
  const targetSecurity = Math.max(0, toSafeNumber(options.targetSecurity, 0));
  const cameraCount = toSafeCount(options.cameraCount);
  const alarmCount = toSafeCount(options.alarmCount);
  const infoQualityPct = Math.max(0, toSafeNumber(options.infoQualityPct, 0));

  const securityPenalty = Math.min(0.42, targetSecurity / 250);
  const cameraPenalty = Math.min(0.2, cameraCount * 0.04);
  const alarmPenalty = Math.min(0.18, alarmCount * 0.08);
  const qualityBonus = Math.min(0.3, infoQualityPct * 0.0025);

  return clamp(0.72 - securityPenalty - cameraPenalty - alarmPenalty + qualityBonus, 0.08, 0.95);
}

export function improveSpyOutcomeByQuality(outcome, infoQualityPct = 0, options = {}) {
  const normalizedOutcome = normalizeSpyOutcome(outcome);
  const quality = Math.max(0, toSafeNumber(infoQualityPct, 0));

  if (quality < 30 || normalizedOutcome === SPY_OUTCOMES.success) {
    return normalizedOutcome;
  }

  const improveChance = clamp((quality - 20) / 140, 0, 0.55);
  if (getRoll(options.qualityRoll) >= improveChance) {
    return normalizedOutcome;
  }

  if (normalizedOutcome === SPY_OUTCOMES.criticalFailed) {
    return SPY_OUTCOMES.failed;
  }
  if (normalizedOutcome === SPY_OUTCOMES.failed) {
    return SPY_OUTCOMES.partial;
  }
  if (normalizedOutcome === SPY_OUTCOMES.partial) {
    return SPY_OUTCOMES.success;
  }
  return normalizedOutcome;
}

export function resolveSpyOutcome(mission, options = {}) {
  const devOnlyFullSuccessChance = clamp(toSafeNumber(options.devOnlyFullSuccessChance, 0), 0, 1);
  if (devOnlyFullSuccessChance > 0 && getRoll(options.roll) < devOnlyFullSuccessChance) {
    return SPY_OUTCOMES.success;
  }

  const infoQualityPct = Math.max(0, toSafeNumber(options.infoQualityPct ?? mission?.intelQualityPct, 0));
  const targetSecurity = Math.max(0, toSafeNumber(options.targetSecurity ?? mission?.targetSecurity, 0));
  const cameraCount = toSafeCount(options.cameraCount ?? mission?.cameraCount);
  const alarmCount = toSafeCount(options.alarmCount ?? mission?.alarmCount);
  const successChance = calculateSpySuccessChance({
    targetSecurity,
    cameraCount,
    alarmCount,
    infoQualityPct
  });
  const roll = getRoll(options.roll);

  let outcome = SPY_OUTCOMES.failed;
  if (roll < successChance) {
    outcome = SPY_OUTCOMES.success;
  } else {
    const partialWindow = clamp(
      0.18 + infoQualityPct * 0.002 - targetSecurity / 900 - cameraCount * 0.012 - alarmCount * 0.018,
      0.08,
      0.34
    );
    if (roll < Math.min(0.97, successChance + partialWindow)) {
      outcome = SPY_OUTCOMES.partial;
    } else {
      const baseCriticalChance = clamp(
        0.08 + targetSecurity / 360 + cameraCount * 0.025 + alarmCount * 0.045 - infoQualityPct * 0.001,
        0.04,
        0.42
      );
      const criticalChance = clamp(
        baseCriticalChance * Math.max(0, toSafeNumber(options.criticalFailureChanceMultiplier, 1)),
        0,
        1
      );
      outcome = getRoll(options.failureRoll) < criticalChance
        ? SPY_OUTCOMES.criticalFailed
        : SPY_OUTCOMES.failed;
    }
  }

  return improveSpyOutcomeByQuality(outcome, infoQualityPct, options);
}

export function resolveSpyScenario(mission, options = {}) {
  return getSpyScenarioLabel(resolveSpyOutcome(mission, options));
}

export function isSpyCapturedOutcome(outcomeOrLabel) {
  const outcome = normalizeSpyOutcome(outcomeOrLabel);
  return outcome === SPY_OUTCOMES.failed || outcome === SPY_OUTCOMES.criticalFailed;
}

export function getSpyHeatGainForOutcome(outcomeOrLabel) {
  return normalizeSpyOutcome(outcomeOrLabel) === SPY_OUTCOMES.criticalFailed
    ? LEGACY_SPY_CRITICAL_HEAT_GAIN
    : 0;
}

export function applySpyIntelOutcome(spyIntel = {}, targetDistrictId, outcomeOrLabel) {
  const outcome = normalizeSpyOutcome(outcomeOrLabel);
  const districtId = toSafeCount(targetDistrictId);
  const currentOccupiable = Array.isArray(spyIntel.occupiableDistrictIds) ? spyIntel.occupiableDistrictIds.map(Number).filter(Boolean) : [];
  const currentRevealedType = Array.isArray(spyIntel.revealedTypeDistrictIds) ? spyIntel.revealedTypeDistrictIds.map(Number).filter(Boolean) : [];
  const currentRevealedDefense = Array.isArray(spyIntel.revealedDefenseDistrictIds) ? spyIntel.revealedDefenseDistrictIds.map(Number).filter(Boolean) : [];

  if (!districtId || (outcome !== SPY_OUTCOMES.success && outcome !== SPY_OUTCOMES.partial)) {
    return {
      occupiableDistrictIds: currentOccupiable,
      revealedTypeDistrictIds: currentRevealedType,
      revealedDefenseDistrictIds: currentRevealedDefense
    };
  }

  const revealedTypeDistrictIds = Array.from(new Set([...currentRevealedType, districtId]));
  if (outcome === SPY_OUTCOMES.partial) {
    return {
      occupiableDistrictIds: currentOccupiable,
      revealedTypeDistrictIds,
      revealedDefenseDistrictIds: currentRevealedDefense
    };
  }

  return {
    occupiableDistrictIds: Array.from(new Set([...currentOccupiable, districtId])),
    revealedTypeDistrictIds,
    revealedDefenseDistrictIds: Array.from(new Set([...currentRevealedDefense, districtId]))
  };
}

export function createCapturedSpyMission(mission = {}, options = {}) {
  const now = Number.isFinite(Number(options.now)) ? Number(options.now) : Date.now();
  const cooldownMs = Math.max(0, Math.floor(toSafeNumber(options.cooldownMs, 0)));
  return {
    ...mission,
    status: "captured",
    capturedAt: new Date(now).toISOString(),
    cooldownUntil: new Date(now + cooldownMs).toISOString()
  };
}

const NUMBER_FORMATTER = new Intl.NumberFormat("cs-CZ");
const ACTION_UNAVAILABLE_REASON = "Snížení heat zatím nemá serverový command a v produkčním režimu ho nelze provést lokálně.";
const RISK_COPY = Object.freeze({
  low: ["Nízký dohled", "Nízký"],
  medium: ["Zvýšený dohled", "Střední"],
  high: ["Vysoký policejní tlak", "Vysoký"],
  extreme: ["Kritická hledanost", "Extrémní"]
});
const LEVEL_TITLES = Object.freeze([
  "Pod radarem",
  "Nízká hledanost",
  "Zvýšený dohled",
  "Vysoký dohled",
  "Policejní tlak",
  "Kritická hledanost"
]);

export function createServerWantedPoliceView(readModel) {
  const police = readModel?.police || readModel?.player?.police || null;
  if (!police) return null;
  const riskKey = String(police.riskTier || "low").toLowerCase();
  const [title, statusLabel] = RISK_COPY[riskKey] || RISK_COPY.low;
  const levelId = clamp(Number(police.wantedLevel || 0), 0, 5);
  const levelLabel = String(police.wantedLevelLabel || police.wantedLabel || `${levelId} / 5`);
  const events = Array.isArray(police.policeFeed) ? police.policeFeed : [];
  return {
    fingerprint: JSON.stringify(police),
    heatBadge: {
      heat: safeNumber(police.heat ?? police.playerHeat),
      levelId,
      label: levelLabel,
      title,
      riskKey,
      pendingRaid: police.pendingRaid || null,
      policeActionThreat: Boolean(police.pendingRaid || police.activeRaid)
    },
    wanted: {
      heat: safeNumber(police.heat ?? police.playerHeat),
      levelId,
      levelLabel,
      title,
      description: String(police.recommendedAction || title),
      protectionLabel: formatProtection(police.protection),
      auditRiskLabel: "Řídí server",
      levels: LEVEL_TITLES.map((levelTitle, id) => ({
        id,
        title: levelTitle,
        active: id === levelId
      })),
      riseEntries: events.slice(0, 6).map((event) => ({
        type: "rise",
        reason: String(event?.message || humanizeEventType(event?.type)),
        deltaLabel: humanizeEventType(event?.type),
        timestampLabel: `Tick ${safeNumber(event?.createdAtTick)}`
      })),
      fallEntries: [],
      dirtyActionDisabled: true,
      cleanActionDisabled: true,
      influenceActionDisabled: true
    },
    policeFeed: createPoliceFeedView(police, riskKey, statusLabel),
    raidPresentations: createRaidPresentations(readModel, police),
    actionUnavailableReason: ACTION_UNAVAILABLE_REASON
  };
}

function createPoliceFeedView(police, riskKey, statusLabel) {
  const events = Array.isArray(police.policeFeed) ? police.policeFeed : [];
  return {
    heat: safeNumber(police.heat),
    playerHeat: safeNumber(police.playerHeat ?? police.heat),
    ownedDistrictHeat: safeNumber(police.ownedDistrictHeat ?? police.districtHeatPressure),
    wantedLabel: String(police.wantedLevelLabel || police.wantedLabel || "0 / 5"),
    riskKey,
    statusLabel,
    riskMessage: String(police.recommendedAction || ""),
    lastMessage: String(police.lastPoliceEvent?.message || police.recommendedAction || ""),
    entries: events.slice(0, 4).map((event) => ({
      kind: String(event?.type || "police-event"),
      title: humanizeEventType(event?.type),
      message: String(event?.message || "Bez detailu.")
    })),
    aggregatePressure: safeNumber(police.aggregatePressure),
    raidPressure: safeNumber(police.raidPressure ?? police.aggregatePressure),
    raidPressureExplanation: String(police.raidPressureExplanation || ""),
    playerHeatPressure: safeNumber(police.playerHeatPressure),
    districtHeatPressure: safeNumber(police.districtHeatPressure),
    hottestDistrictId: police.hottestDistrictId || null,
    hottestDistrictHeat: safeNumber(police.hottestDistrictHeat),
    pendingRaid: police.pendingRaid || null,
    previewConsequences: police.pendingRaid?.previewConsequences || null,
    recommendedAction: String(police.recommendedAction || "")
  };
}

function createRaidPresentations(readModel, police) {
  const candidates = [
    police.activeRaid ? ["active", police.activeRaid] : null,
    isResolvedRaid(police.recentRaid) ? ["recent", police.recentRaid] : null
  ].filter(Boolean);
  const seen = new Set();
  return candidates.flatMap(([kind, raid]) => {
    const key = kind === "active"
      ? `${kind}:${raid.id}`
      : `${kind}:${raid.id}:${raid.type}:${raid.tick}`;
    if (!raid.id || seen.has(key)) return [];
    seen.add(key);
    return [{
      key,
      payload: createRaidPayload(readModel, police, raid, kind)
    }];
  });
}

function isResolvedRaid(raid) {
  return Boolean(
    raid
    && (
      String(raid.status || "") === "resolved"
      || String(raid.type || "").includes("resolved")
    )
  );
}

function createRaidPayload(readModel, police, raid, kind) {
  const isPending = kind === "active" && String(raid.status) !== "resolved";
  const event = findRaidEvent(police.policeFeed, raid.id);
  const payload = event?.payload && typeof event.payload === "object" ? event.payload : {};
  const rows = [
    { label: "District", value: String(raid.districtId || police.pendingRaid?.targetDistrictId || "Bez cíle") },
    { label: "Typ razie", value: formatSeverity(raid.severity) },
    { label: "Konec za", value: resolveRaidRemaining(readModel, police, isPending) }
  ];
  appendConsequenceRows(rows, police.activeConsequences);
  appendLossRows(rows, payload);
  return {
    title: isPending ? "Policejní razie se blíží" : "Dopady razie",
    badge: isPending ? "Policejní varování" : "Policejní zásah",
    summary: String(raid.message || event?.message || police.recommendedAction || ""),
    tone: isPending
      ? "is-district-raid-warning"
      : `${severityTone(raid.severity)} is-owned-district-raid-alert`,
    rows
  };
}

function appendConsequenceRows(rows, consequences) {
  const entries = Array.isArray(consequences) ? consequences : [];
  if (entries.some((entry) => entry?.type === "district-lockdown")) {
    rows.push({ label: "Zákaz akcí", value: "všechny akce zasaženého districtu" });
  }
  if (entries.some((entry) => entry?.type === "building-disruption")) {
    rows.push({ label: "Výroba", value: "výroba zablokovaná" });
  }
}

function appendLossRows(rows, payload) {
  const dirtyCash = safeNumber(payload.seizedDirtyCash);
  if (dirtyCash > 0) {
    rows.push({ label: "Zabavení cash", value: `-${NUMBER_FORMATTER.format(dirtyCash)} dirty cash` });
  }
  const resources = payload.seizedResources && typeof payload.seizedResources === "object"
    ? payload.seizedResources
    : {};
  for (const [resourceKey, amount] of Object.entries(resources)) {
    if (safeNumber(amount) > 0) {
      rows.push({ label: "Zabavení", value: `-${NUMBER_FORMATTER.format(safeNumber(amount))} ${resourceKey}` });
    }
  }
}

function resolveRaidRemaining(readModel, police, pending) {
  if (pending && Number.isFinite(Number(police.pendingRaid?.remainingMs))) {
    return formatDuration(police.pendingRaid.remainingMs);
  }
  const currentTick = safeNumber(readModel?.server?.currentTick);
  const expiresAtTick = Math.max(
    0,
    ...(Array.isArray(police.activeConsequences)
      ? police.activeConsequences.map((entry) => safeNumber(entry?.expiresAtTick))
      : [])
  );
  if (expiresAtTick <= currentTick) return "Ukončeno";
  return formatDuration((expiresAtTick - currentTick) * Math.max(1, safeNumber(readModel?.mode?.tickRateMs)));
}

function findRaidEvent(events, raidId) {
  return (Array.isArray(events) ? events : []).find((event) => (
    String(event?.payload?.raidId || event?.id || "") === String(raidId)
  )) || null;
}

function formatProtection(protection) {
  const multiplier = Number(protection?.raidConsequenceMultiplier);
  if (!Number.isFinite(multiplier) || multiplier >= 1) return "Bez ochrany";
  return `Ochrana ${Math.round((1 - Math.max(0, multiplier)) * 100)} %`;
}

function formatDuration(value) {
  const seconds = Math.max(0, Math.ceil(safeNumber(value) / 1000));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}:${String(rest).padStart(2, "0")}`;
}

function formatSeverity(value) {
  return ({ low: "Nízká", medium: "Střední", high: "Vysoká", extreme: "Extrémní" })[value] || String(value || "Neznámá");
}

function severityTone(value) {
  return ({ low: "is-tier-1", medium: "is-tier-2", high: "is-tier-4", extreme: "is-tier-6" })[value] || "is-tier-2";
}

function humanizeEventType(value) {
  return ({
    "police-warning-issued": "Policejní varování",
    "police-raid-triggered": "Připravovaná razie",
    "police-raid-resolved": "Dopady razie"
  })[value] || "Policejní událost";
}

function safeNumber(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? Math.max(0, number) : 0;
}

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, Math.floor(Number(value || 0))));
}

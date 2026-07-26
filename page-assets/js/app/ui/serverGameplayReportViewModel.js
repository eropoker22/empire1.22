const REPORT_RESULT_LABELS = Object.freeze({
  success: "Úspěch",
  partial: "Částečný úspěch",
  failed: "Neúspěch",
  failure: "Neúspěch",
  blocked: "Zablokováno",
  catastrophe: "Katastrofa",
  critical_failed: "Kritické selhání"
});
const NUMBER_FORMATTER = new Intl.NumberFormat("cs-CZ");

export function createServerReportFeedEntries(reports = []) {
  return normalizeReports(reports).map((report) => {
    const resultPayload = createServerReportResultView(report);
    return {
      id: String(report.reportId),
      timestampMs: parseTimestamp(report.createdAt),
      timeLabel: `Tick ${formatNumber(report.tick)}`,
      tone: resolveFeedTone(report),
      title: createReportTitle(report),
      summary: createReportSummary(report),
      meta: `Tick ${formatNumber(report.tick)}`,
      resultKind: report.reportType === "battle" ? "attack" : report.reportType,
      resultPayload: resultPayload
        ? { ...resultPayload, openable: true }
        : { openable: false },
      dismissible: false,
      persistent: true,
      category: report.reportType,
      visibility: "private"
    };
  });
}

export function createServerReportResultView(report) {
  if (report?.reportType === "battle") {
    return createServerBattleResultView(report);
  }
  if (report?.reportType === "spy") {
    return createServerSpyResultView(report);
  }
  return null;
}

export function createServerReportFeedFingerprint(entries = []) {
  return JSON.stringify(Array.isArray(entries) ? entries : []);
}

export function createServerBattleResultView(report) {
  const summary = report.playerId === report.attackerPlayerId
    ? report.reportForAttacker
    : report.reportForDefender;
  return {
    tone: resolveBattleTone(report),
    title: report.districtDestroyed ? "Katastrofa v districtu" : "Výsledek útoku",
    badge: createBattleBadge(report),
    summary: String(summary || createReportSummary(report)),
    targetLabel: "Cílový district",
    districtName: String(report.targetDistrictId || "—"),
    attackLabel: "Výsledek",
    attackPower: resultLabel(report.result),
    defenseLabel: "Obránce",
    defensePower: report.defenderPlayerId ? String(report.defenderPlayerId) : "Nikdo",
    attackLossLabel: "Ztráty útočníka",
    attackerLossesLabel: formatNumberRecord(report.attackerLosses),
    defenseLossLabel: "Ztráty obránce",
    defenderLossesLabel: formatNumberRecord(report.defenderLosses),
    stateLabel: "Stav districtu",
    districtStateValue: createDistrictStateLabel(report),
    durationLabel: "Trvání",
    durationValue: `${formatNumber(report.attackDurationTicks)} ticků`,
    extraRows: [
      { label: "Hledanost", value: formatSigned(report.heatGained) },
      {
        label: "Ztráty populace",
        value: formatNumber(
          Number(report.combatPopulationLoss || 0)
          + Number(report.occupationPopulationLoss || 0)
          + Number(report.defenderPopulationLoss || 0)
        )
      },
      { label: "Past", value: report.trapTriggered ? "Spuštěna" : "Nespuštěna" }
    ]
  };
}

export function createServerSpyResultView(report) {
  return {
    tone: report.result === "success"
      ? "is-success"
      : report.result === "partial"
        ? "is-medium-fail"
        : "is-major-fail",
    title: "Výsledek špehování",
    summary: createSpySummary(report),
    rows: [
      { label: "Cíl", value: String(report.targetDistrictId || "—") },
      { label: "Výsledek", value: resultLabel(report.result) },
      { label: "Odhalená obrana", value: formatNumberRecord(report.detectedDefense) },
      { label: "Past", value: report.trapDetected ? "Odhalena" : "Neodhalena" },
      { label: "Obsazení", value: report.occupyUnlocked ? "Odemčeno" : "Zamčeno" },
      { label: "Hledanost", value: formatSigned(report.heatGained) }
    ]
  };
}

function normalizeReports(reports) {
  return Array.isArray(reports)
    ? reports.filter((report) => report?.reportId && report?.reportType)
    : [];
}

function createReportTitle(report) {
  if (report.reportType === "spy") return `Špehování · ${report.targetDistrictId}`;
  if (report.reportType === "battle") return `Útok · ${report.targetDistrictId}`;
  if (report.reportType === "occupy") return `Obsazení · ${report.targetDistrictId}`;
  return `${toTitleCase(report.buildingActionId || "Akce budovy")} · ${report.districtId}`;
}

function createReportSummary(report) {
  if (report.reportType === "spy") return createSpySummary(report);
  if (report.reportType === "battle") {
    if (report.districtDestroyed) return "Katastrofa zničila cílový district.";
    if (report.districtCaptured) return "Cílový district byl dobyt.";
    if (report.trapTriggered) return "Útok zastavila nastražená past.";
    return "Obránce útok odrazil.";
  }
  if (report.reportType === "occupy") {
    return report.result === "success"
      ? `District obsazen · vliv -${formatNumber(report.influenceCost)} · hledanost ${formatSigned(report.heatGained)}.`
      : `Obsazení selhalo · hledanost ${formatSigned(report.heatGained)}.`;
  }
  return String(
    report.message
    || report.messages?.[0]
    || `Výstup ${formatNumberRecord(report.outputGain)}.`
  );
}

function createSpySummary(report) {
  if (report.result === "success") {
    return report.trapDetected
      ? "Obrana potvrzena, past odhalena a obsazení odemčeno."
      : "Obrana potvrzena a obsazení odemčeno.";
  }
  if (report.result === "partial") return "Získán částečný intel. Obsazení zůstává zamčené.";
  if (report.result === "critical_failed") {
    return `Kritické selhání. Hledanost ${formatSigned(report.heatGained)}.`;
  }
  return "Špehování selhalo. Obsazení zůstává zamčené.";
}

function resolveFeedTone(report) {
  if (report.reportType === "battle" && report.districtDestroyed) return "error";
  if (report.result === "success") return "success";
  if (report.result === "partial" || report.result === "blocked") return "warning";
  return report.reportType === "building-action" ? "event" : "error";
}

function resolveBattleTone(report) {
  if (report.districtDestroyed || report.result === "catastrophe") return "is-catastrophe";
  if (report.trapTriggered) return "is-trap-triggered";
  if (report.outcomeTier === "costly_capture") return "is-pyrrhic-victory";
  if (report.districtCaptured) return "is-total-success";
  return "is-failure";
}

function createBattleBadge(report) {
  if (report.districtDestroyed) return "Katastrofa";
  if (report.districtCaptured) return "District dobyt";
  if (report.trapTriggered) return "Past spuštěna";
  return "Útok odražen";
}

function createDistrictStateLabel(report) {
  if (report.districtDestroyed) return "Zničený";
  if (report.districtCaptured) return "Dobytý";
  if (report.districtDamaged) return "Poškozený";
  return "Udržený";
}

function resultLabel(result) {
  return REPORT_RESULT_LABELS[result] || toTitleCase(result || "Neznámý");
}

function formatNumberRecord(values = {}) {
  const entries = Object.entries(values)
    .filter(([, amount]) => Number(amount || 0) !== 0);
  return entries.length > 0
    ? entries.map(([key, amount]) => `${formatNumber(amount)} ${toTitleCase(key)}`).join(", ")
    : "Žádné";
}

function formatSigned(value) {
  const amount = Number(value || 0);
  return amount >= 0 ? `+${formatNumber(amount)}` : formatNumber(amount);
}

function formatNumber(value) {
  return NUMBER_FORMATTER.format(Number(value || 0));
}

function parseTimestamp(value) {
  const parsed = Date.parse(String(value || ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function toTitleCase(value) {
  return String(value || "")
    .replaceAll("_", "-")
    .split("-")
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

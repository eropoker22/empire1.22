import { formatBuildingActionFeedCountdown } from "./eventFeedPanel.js";
import {
  formatNumber,
  formatNumberRecord,
  formatSigned,
  parseTimestamp,
  resultLabel,
  toTitleCase
} from "./serverGameplayReportFormatting.js";

export function createServerReportFeedEntries(reports = [], readModel = {}) {
  return normalizeReports(reports).map((report) => {
    const resultPayload = createServerReportResultView(report);
    const captureExpiresAt = resolveActiveSpyCaptureExpiresAt(report, readModel);
    if (captureExpiresAt > 0) {
      return {
        id: String(report.reportId),
        timestampMs: parseTimestamp(report.createdAt),
        timeLabel: `Tick ${formatNumber(report.tick)}`,
        tone: "error",
        title: "ŠPEH ZAJAT",
        summary: "",
        meta: formatBuildingActionFeedCountdown(captureExpiresAt - Date.now(), "words"),
        sourceKind: "cooldown",
        compact: true,
        countdownStyle: "words",
        countdownPrefix: "",
        expiresAt: captureExpiresAt,
        resultKind: "spy",
        resultPayload: resultPayload
          ? { ...resultPayload, openable: false }
          : { openable: false },
        dismissible: false,
        persistent: true,
        category: "spy",
        visibility: "private"
      };
    }
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
  return JSON.stringify((Array.isArray(entries) ? entries : []).map((entry) =>
    entry?.sourceKind === "cooldown"
      ? {
          id: entry.id,
          title: entry.title,
          tone: entry.tone,
          sourceKind: entry.sourceKind,
          resultKind: entry.resultKind
        }
      : entry
  ));
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

function resolveActiveSpyCaptureExpiresAt(report, readModel) {
  if (report?.reportType !== "spy" || report.result !== "critical_failed") return 0;
  const blockedUntilTick = Number(report.blockedUntilTick);
  const currentTick = Number(readModel?.server?.currentTick);
  const tickRateMs = Number(readModel?.mode?.tickRateMs);
  const generatedAt = parseTimestamp(readModel?.server?.generatedAt);
  if (
    !Number.isFinite(blockedUntilTick)
    || !Number.isFinite(currentTick)
    || !Number.isFinite(tickRateMs)
    || tickRateMs <= 0
    || generatedAt <= 0
    || blockedUntilTick <= currentTick
  ) {
    return 0;
  }
  return generatedAt + ((blockedUntilTick - currentTick) * tickRateMs);
}

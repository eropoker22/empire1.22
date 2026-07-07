import type { ConflictReportView } from "@empire/shared-types";

export interface ReportViewModel {
  id: string;
  reportType: ConflictReportView["reportType"];
  title: string;
  createdAt: string;
  category: string;
  summary: string;
  result: string;
  severity: "normal" | "critical";
  messages: string[];
  details: string[];
}

/**
 * Responsibility: Maps server-fed conflict reports into simple client-ready list items.
 * Belongs here: presentation shaping only.
 * Does not belong here: report persistence or gameplay logic.
 */
export const createReportViewModels = (
  reports: ReadonlyArray<ConflictReportView>
): ReportViewModel[] =>
  reports.map((report) => ({
    id: report.reportId,
    reportType: report.reportType,
    title:
      report.reportType === "spy"
        ? `Špehování ${report.result} v ${report.targetDistrictId}`
        : report.reportType === "occupy"
          ? `Obsazení ${report.result} v ${report.targetDistrictId}`
        : report.reportType === "building-action"
          ? `${toTitleCase(report.buildingActionId)} v ${report.districtId}`
        : report.districtDestroyed
          ? `Katastrofa v distriktu ${report.targetDistrictId}`
        : `Útok ${report.result} v ${report.targetDistrictId}`,
    createdAt: `${report.tick}`,
    category: report.reportType,
    summary:
      report.reportType === "spy"
        ? formatSpySummary(report)
        : report.reportType === "occupy"
          ? `Distrikt obsazen. Vliv -${report.influenceCost} · hledanost +${report.heatGained}.`
        : report.reportType === "building-action"
          ? formatBuildingActionSummary(report)
        : report.districtDestroyed
          ? "Katastrofa zničila distrikt. Kontrola, budovy, hledanost i vliv byly smazány."
        : report.trapTriggered
          ? "Během útoku se spustila past."
          : report.districtCaptured
            ? "Distrikt dobyt."
            : "Distrikt udržel obránce.",
    result: report.result,
    severity: report.reportType === "battle" && report.districtDestroyed
      ? "critical"
      : report.reportType === "spy" && report.result === "critical_failed"
        ? "critical"
        : "normal",
    messages: report.reportType === "building-action"
      ? report.messages ?? []
      : report.reportType === "battle" && report.districtDestroyed
        ? [
            "Stav distriktu: zničený a nepoužitelný.",
            "Vlastník: nikdo.",
            "Pevné budovy: ztraceny.",
            "Všechny hlavní akce distriktu jsou vypnuté."
          ]
        : [],
    details: formatReportDetails(report)
  }));

const formatReportDetails = (report: ConflictReportView): string[] => {
  if (report.reportType === "spy") {
    return [
      `Zdroj ${report.sourceDistrictId}`,
      `Cíl ${report.targetDistrictId}`,
      `Intel obrany ${formatNumberRecord(report.detectedDefense)}`,
      report.trapDetected ? "Past odhalena" : "Past neodhalena",
      report.occupyUnlocked ? "Obsazení odemčeno" : "Obsazení neodemčeno",
      report.blockedUntilTick ? `Špeh blokován do ticku ${report.blockedUntilTick}` : ""
    ].filter(Boolean);
  }

  if (report.reportType === "occupy") {
    return [
      `Zdroj ${report.sourceDistrictId}`,
      `Cíl ${report.targetDistrictId}`,
      `Vliv -${report.influenceCost}`,
      `Hledanost +${report.heatGained}`,
      report.previousOwnerPlayerId ? `Předchozí vlastník ${report.previousOwnerPlayerId}` : "Předchozí vlastník nikdo"
    ];
  }

  if (report.reportType === "battle") {
    return [
      `Zdroj ${report.sourceDistrictId}`,
      `Cíl ${report.targetDistrictId}`,
      report.defenderPlayerId ? `Obránce ${report.defenderPlayerId}` : "Obránce nikdo",
      `Výsledek ${toTitleCase(report.outcomeTier)}`,
      `Ztráty útočníka ${formatNumberRecord(report.attackerLosses)}`,
      `Ztráty obránce ${formatNumberRecord(report.defenderLosses)}`,
      `Hledanost +${report.heatGained}`,
      report.reportForAttacker || "Bez shrnutí pro útočníka"
    ];
  }

  return [
    `Distrikt ${report.districtId}`,
    `Budova ${report.buildingId}`,
    `Výstup ${formatNumberRecord(report.outputGain)}`,
    `Cena ${formatNumberRecord(report.inputCost)}`,
    `Hledanost ${formatSigned(report.heatDelta ?? report.heatGain)}`,
    `Vliv ${formatSigned(report.influenceDelta ?? report.influenceChange)}`,
    report.message ?? ""
  ].filter(Boolean);
};

const formatSpySummary = (report: Extract<ConflictReportView, { reportType: "spy" }>): string => {
  if (report.result === "success") {
    return report.trapDetected
      ? "Obrana potvrzena. Past odhalena. Obsazení odemčeno."
      : "Obrana potvrzena. Obsazení odemčeno.";
  }

  if (report.result === "partial") {
    return "Částečný intel získán. Obsazení zůstává zamčené.";
  }

  if (report.result === "critical_failed") {
    return `Kritické selhání. Obsazení zůstává zamčené. Hledanost +${report.heatGained}.`;
  }

  return "Špehování selhalo. Obsazení zůstává zamčené.";
};

const formatBuildingActionSummary = (report: Extract<ConflictReportView, { reportType: "building-action" }>): string => {
  const parts = [
    formatResourceDelta(report.outputGain),
    formatDefenseDelta(report.defenseAdded ?? {}),
    formatIntelDelta(report.intelRevealedDistrictIds ?? []),
    `Hledanost +${report.heatGain}`,
    `Vliv ${formatSigned(report.influenceChange)}`
  ].filter(Boolean);

  return parts.join(" · ");
};

const formatResourceDelta = (values: Record<string, number>): string => {
  const parts = Object.entries(values).filter(([, amount]) => amount > 0);
  return parts.length > 0
    ? parts.map(([resourceKey, amount]) => `+${amount} ${formatResourceLabel(resourceKey)}`).join(", ")
    : "Bez výstupu zdrojů";
};

const formatDefenseDelta = (values: Record<string, number>): string => {
  const parts = Object.entries(values).filter(([, amount]) => amount > 0);
  return parts.length > 0
    ? `Obrana ${parts.map(([resourceKey, amount]) => `+${amount} ${formatResourceLabel(resourceKey)}`).join(", ")}`
    : "";
};

const formatIntelDelta = (districtIds: string[]): string =>
  districtIds.length > 0 ? `Intel ${districtIds.length} distriktů` : "";

const formatSigned = (value: number): string => value >= 0 ? `+${value}` : String(value);

const formatNumberRecord = (values: Partial<Record<string, number>>): string => {
  const parts = Object.entries(values).filter(([, amount]) => Number(amount ?? 0) !== 0);

  return parts.length > 0
    ? parts.map(([key, amount]) => `${Number(amount)} ${formatResourceLabel(key)}`).join(", ")
    : "none";
};

const RESOURCE_LABELS: Record<string, string> = {
  "combat-module": "Bojový modul",
  combatModule: "Bojový modul"
};

const formatResourceLabel = (resourceKey: string): string =>
  RESOURCE_LABELS[resourceKey] ?? toTitleCase(resourceKey);

const toTitleCase = (value: string): string =>
  value
    .replaceAll("_", "-")
    .split("-")
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");

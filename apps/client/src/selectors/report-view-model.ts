import type { ConflictReportView } from "@empire/shared-types";

export interface ReportViewModel {
  id: string;
  title: string;
  createdAt: string;
  category: string;
  summary: string;
  result: string;
  severity: "normal" | "critical";
  messages: string[];
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
    title:
      report.reportType === "spy"
        ? `Spy ${report.result} on ${report.targetDistrictId}`
        : report.reportType === "occupy"
          ? `Occupy ${report.result} on ${report.targetDistrictId}`
        : report.reportType === "building-action"
          ? `${toTitleCase(report.buildingActionId)} on ${report.districtId}`
        : report.districtDestroyed
          ? `District catastrophe on ${report.targetDistrictId}`
        : `Attack ${report.result} on ${report.targetDistrictId}`,
    createdAt: `${report.tick}`,
    category: report.reportType,
    summary:
      report.reportType === "spy"
        ? report.trapDetected
          ? "Defense confirmed. Trap detected."
          : "Defense scout resolved."
        : report.reportType === "occupy"
          ? `District occupied. Influence -${report.influenceCost} · heat +${report.heatGained}.`
        : report.reportType === "building-action"
          ? formatBuildingActionSummary(report)
        : report.districtDestroyed
          ? "Catastrophe destroyed the district. Control, buildings, heat, and influence were wiped."
        : report.trapTriggered
          ? "Trap triggered during the attack."
          : report.districtCaptured
            ? "District captured."
            : "District held by defender.",
    result: report.result,
    severity: report.reportType === "battle" && report.districtDestroyed ? "critical" : "normal",
    messages: report.reportType === "building-action"
      ? report.messages ?? []
      : report.reportType === "battle" && report.districtDestroyed
      ? [
          "District state: destroyed and unusable.",
          "Owner: none.",
          "Fixed buildings: lost.",
          "All primary district actions are disabled."
        ]
      : []
  }));

const formatBuildingActionSummary = (report: Extract<ConflictReportView, { reportType: "building-action" }>): string => {
  const parts = [
    formatResourceDelta(report.outputGain),
    formatDefenseDelta(report.defenseAdded ?? {}),
    formatIntelDelta(report.intelRevealedDistrictIds ?? []),
    `Heat +${report.heatGain}`,
    `Influence ${formatSigned(report.influenceChange)}`
  ].filter(Boolean);

  return parts.join(" · ");
};

const formatResourceDelta = (values: Record<string, number>): string => {
  const parts = Object.entries(values).filter(([, amount]) => amount > 0);
  return parts.length > 0
    ? parts.map(([resourceKey, amount]) => `+${amount} ${toTitleCase(resourceKey)}`).join(", ")
    : "No resource output";
};

const formatDefenseDelta = (values: Record<string, number>): string => {
  const parts = Object.entries(values).filter(([, amount]) => amount > 0);
  return parts.length > 0
    ? `Defense ${parts.map(([resourceKey, amount]) => `+${amount} ${toTitleCase(resourceKey)}`).join(", ")}`
    : "";
};

const formatIntelDelta = (districtIds: string[]): string =>
  districtIds.length > 0 ? `Intel ${districtIds.length} district${districtIds.length === 1 ? "" : "s"}` : "";

const formatSigned = (value: number): string => value >= 0 ? `+${value}` : String(value);

const toTitleCase = (value: string): string =>
  value
    .replaceAll("_", "-")
    .split("-")
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");

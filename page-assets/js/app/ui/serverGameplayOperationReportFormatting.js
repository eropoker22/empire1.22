import {
  formatNumberRecord,
  formatSigned
} from "./serverGameplayReportFormatting.js";

export function createServerOperationReportSummary(report) {
  if (report.reportType === "heist") {
    const outcome = report.result === "clean_success"
      ? "Heist proběhl čistě"
      : report.result === "success"
        ? "Heist uspěl"
        : report.result === "detected"
          ? "Heist uspěl, ale útočník byl odhalen"
          : report.result === "trap_triggered"
            ? "Heist zastavila past"
            : "Heist selhal";
    return `${outcome} · kořist ${formatNumberRecord(report.loot)} · hledanost ${formatSigned(report.heatGained)}.`;
  }
  if (report.reportType === "rob") {
    const outcome = report.result === "success"
      ? "Vykradení uspělo"
      : report.result === "partial"
        ? "Vykradení uspělo částečně"
        : report.result === "exhausted"
          ? "District už neměl dostupnou kořist"
          : "Vykradení selhalo";
    return `${outcome} · kořist ${formatNumberRecord(report.loot)} · hledanost ${formatSigned(report.playerHeat)}.`;
  }
  return null;
}

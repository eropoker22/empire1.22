import type { DomainError } from "@empire/shared-types";
import { escapeAttribute, escapeHtml } from "../shared-ui";
import type { ClientCommandStatus } from "../state";
import type { ReportViewModel } from "./report-model";

export interface RenderReportLayerOptions {
  errors?: DomainError[];
  lastCommandStatus?: ClientCommandStatus | null;
}

/**
 * Responsibility: Presentation boundary for report history UI.
 * Belongs here: rendering of server-fed report summaries and details.
 * Does not belong here: event sourcing or gameplay logic.
 */
export const renderReportLayer = (
  reports: ReportViewModel[],
  options: RenderReportLayerOptions = {}
): string => {
  const commandStatusHtml = renderCommandReportStatus(reports, options);

  return reports.length > 0 || commandStatusHtml
    ? [
        `<section class="reports-panel" data-feature="reports-panel">`,
        renderCatastropheAlert(reports),
        `<div class="district-panel__section-head">`,
        `<div>`,
        `<h3 class="district-panel__section-title">Poslední reporty</h3>`,
        `<p class="district-panel__section-copy">Serverové výsledky špehování, obsazení, útoků a akcí budov pro aktuálního hráče.</p>`,
        `</div>`,
        `<span class="district-panel__section-meta">${escapeHtml(reports.length)} nových</span>`,
        `</div>`,
        commandStatusHtml,
        reports
          .map((report, index) => renderReportCard(report, {
            highlighted: Boolean(options.lastCommandStatus?.accepted && index === 0)
          }))
          .join(""),
        `</section>`
      ].join("")
    : "";
};

const renderReportCard = (
  report: ReportViewModel,
  {
    highlighted
  }: {
    highlighted: boolean;
  }
): string => [
  `<article class="district-panel__slot" data-report-id="${escapeAttribute(report.id)}" data-report-category="${escapeAttribute(report.category)}" data-report-type="${escapeAttribute(report.reportType)}" data-report-severity="${escapeAttribute(report.severity)}" data-report-highlight="${highlighted ? "latest-command" : "none"}">`,
  `<div class="district-panel__slot-head">`,
  `<div>`,
  `<p class="district-panel__slot-index">${escapeHtml(report.category)}</p>`,
  `<h4 class="district-panel__slot-title">${escapeHtml(report.title)}</h4>`,
  `</div>`,
  `<span class="district-panel__slot-state">${escapeHtml(report.result)}</span>`,
  `</div>`,
  `<p class="district-panel__slot-summary">${escapeHtml(report.summary)}</p>`,
  report.details.length > 0
    ? `<div class="reports-panel__detail-list">${report.details
      .map((detail) => `<span class="reports-panel__detail">${escapeHtml(detail)}</span>`)
      .join("")}</div>`
    : "",
  `<p class="district-panel__empty-copy">Tick ${escapeHtml(report.createdAt)}</p>`,
  `</article>`
].join("");

const renderCommandReportStatus = (
  reports: ReportViewModel[],
  options: RenderReportLayerOptions
): string => {
  const status = options.lastCommandStatus;

  if (!status) {
    return "";
  }

  if (!status.accepted) {
    const message = options.errors?.[0]?.message ?? "Server akci odmítl. Zkontroluj vybraný cíl, zdroje nebo synchronizaci a zkus to znovu.";

    return [
      `<article class="district-panel__slot" data-report-command-status="rejected">`,
      `<div class="district-panel__slot-head">`,
      `<div>`,
      `<p class="district-panel__slot-index">akce</p>`,
      `<h4 class="district-panel__slot-title">Akce odmítnuta</h4>`,
      `</div>`,
      `<span class="district-panel__slot-state">odmítnuto</span>`,
      `</div>`,
      `<p class="district-panel__slot-summary">${escapeHtml(message)}</p>`,
      `</article>`
    ].join("");
  }

  if (reports.length > 0) {
    return "";
  }

  return [
    `<article class="district-panel__slot" data-report-command-status="accepted-without-report">`,
    `<div class="district-panel__slot-head">`,
    `<div>`,
    `<p class="district-panel__slot-index">akce</p>`,
    `<h4 class="district-panel__slot-title">Akce přijata</h4>`,
    `</div>`,
    `<span class="district-panel__slot-state">přijato</span>`,
    `</div>`,
    `<p class="district-panel__slot-summary">Server akci přijal, ale nevydal nový hráčský report. Výsledek ověř ve feedu a ve stavu vybraného distriktu.</p>`,
    `</article>`
  ].join("");
};

const renderCatastropheAlert = (reports: ReportViewModel[]): string => {
  const catastropheReport = reports.find((report) => report.severity === "critical");

  if (!catastropheReport) {
    return "";
  }

  return [
    `<section class="reports-panel__catastrophe-window" data-catastrophe-alert="true" role="dialog" aria-label="Report katastrofy distriktu">`,
    `<div class="district-panel__section-head">`,
    `<div>`,
    `<h3 class="district-panel__section-title">${escapeHtml(catastropheReport.title)}</h3>`,
    `<p class="district-panel__section-copy">${escapeHtml(catastropheReport.summary)}</p>`,
    `</div>`,
    `<span class="district-panel__section-meta">${escapeHtml(catastropheReport.result)}</span>`,
    `</div>`,
    `<div class="district-panel__slot-list">`,
    catastropheReport.messages
      .map((message) => `<p class="district-panel__action-reason">${escapeHtml(message)}</p>`)
      .join(""),
    `</div>`,
    `</section>`
  ].join("");
};

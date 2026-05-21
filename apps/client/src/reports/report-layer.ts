import type { DomainError } from "@empire/shared-types";
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
        `<h3 class="district-panel__section-title">Latest reports</h3>`,
        `<p class="district-panel__section-copy">Server-authored spy, occupy, attack, and building-action outcomes for the current player.</p>`,
        `</div>`,
        `<span class="district-panel__section-meta">${reports.length} recent</span>`,
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
  `<article class="district-panel__slot" data-report-id="${report.id}" data-report-category="${report.category}" data-report-type="${report.reportType}" data-report-severity="${report.severity}" data-report-highlight="${highlighted ? "latest-command" : "none"}">`,
  `<div class="district-panel__slot-head">`,
  `<div>`,
  `<p class="district-panel__slot-index">${report.category}</p>`,
  `<h4 class="district-panel__slot-title">${report.title}</h4>`,
  `</div>`,
  `<span class="district-panel__slot-state">${report.result}</span>`,
  `</div>`,
  `<p class="district-panel__slot-summary">${report.summary}</p>`,
  report.details.length > 0
    ? `<div class="reports-panel__detail-list">${report.details
      .map((detail) => `<span class="reports-panel__detail">${detail}</span>`)
      .join("")}</div>`
    : "",
  `<p class="district-panel__empty-copy">Tick ${report.createdAt}</p>`,
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
    const message = options.errors?.[0]?.message ?? "The server rejected the command.";

    return [
      `<article class="district-panel__slot" data-report-command-status="rejected">`,
      `<div class="district-panel__slot-head">`,
      `<div>`,
      `<p class="district-panel__slot-index">command</p>`,
      `<h4 class="district-panel__slot-title">Command rejected</h4>`,
      `</div>`,
      `<span class="district-panel__slot-state">rejected</span>`,
      `</div>`,
      `<p class="district-panel__slot-summary">${message}</p>`,
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
    `<p class="district-panel__slot-index">command</p>`,
    `<h4 class="district-panel__slot-title">Command accepted</h4>`,
    `</div>`,
    `<span class="district-panel__slot-state">accepted</span>`,
    `</div>`,
    `<p class="district-panel__slot-summary">The server accepted the command but did not emit a new player report. Check the feed and selected district state for the authoritative result.</p>`,
    `</article>`
  ].join("");
};

const renderCatastropheAlert = (reports: ReportViewModel[]): string => {
  const catastropheReport = reports.find((report) => report.severity === "critical");

  if (!catastropheReport) {
    return "";
  }

  return [
    `<section class="reports-panel__catastrophe-window" data-catastrophe-alert="true" role="dialog" aria-label="District catastrophe report">`,
    `<div class="district-panel__section-head">`,
    `<div>`,
    `<h3 class="district-panel__section-title">${catastropheReport.title}</h3>`,
    `<p class="district-panel__section-copy">${catastropheReport.summary}</p>`,
    `</div>`,
    `<span class="district-panel__section-meta">${catastropheReport.result}</span>`,
    `</div>`,
    `<div class="district-panel__slot-list">`,
    catastropheReport.messages
      .map((message) => `<p class="district-panel__action-reason">${message}</p>`)
      .join(""),
    `</div>`,
    `</section>`
  ].join("");
};

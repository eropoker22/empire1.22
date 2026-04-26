import type { ReportViewModel } from "./report-model";

/**
 * Responsibility: Presentation boundary for report history UI.
 * Belongs here: rendering of server-fed report summaries and details.
 * Does not belong here: event sourcing or gameplay logic.
 */
export const renderReportLayer = (reports: ReportViewModel[]): string =>
  reports.length > 0
    ? [
        `<section class="reports-panel" data-feature="reports-panel">`,
        renderCatastropheAlert(reports),
        `<div class="district-panel__section-head">`,
        `<div>`,
        `<h3 class="district-panel__section-title">Reports</h3>`,
        `<p class="district-panel__section-copy">Latest server-authored spy and battle reports for the current player.</p>`,
        `</div>`,
        `<span class="district-panel__section-meta">${reports.length} recent</span>`,
        `</div>`,
        reports
          .map(
            (report) =>
              [
                `<article class="district-panel__slot" data-report-id="${report.id}" data-report-category="${report.category}" data-report-severity="${report.severity}">`,
                `<div class="district-panel__slot-head">`,
                `<div>`,
                `<p class="district-panel__slot-index">${report.category}</p>`,
                `<h4 class="district-panel__slot-title">${report.title}</h4>`,
                `</div>`,
                `<span class="district-panel__slot-state">${report.result}</span>`,
                `</div>`,
                `<p class="district-panel__slot-summary">${report.summary}</p>`,
                `<p class="district-panel__empty-copy">Tick ${report.createdAt}</p>`,
                `</article>`
              ].join("")
          )
          .join(""),
        `</section>`
      ].join("")
    : "";

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

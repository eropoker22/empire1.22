import {
  ATTACK_RESULT_MODAL_BACKDROP_SELECTOR,
  ATTACK_RESULT_MODAL_CLOSE_SELECTOR,
  ATTACK_RESULT_MODAL_SELECTOR,
  BUILDING_ACTION_CLEAR_SELECTOR,
  BUILDING_ACTION_EMPTY_SELECTOR,
  BUILDING_ACTION_FEED_SELECTOR,
  BUILDING_ACTION_META_SELECTOR,
  BUILDING_ACTION_STATE_SELECTOR,
  BUILDING_ACTION_SUMMARY_SELECTOR,
  SPY_RESULT_MODAL_BACKDROP_SELECTOR,
  SPY_RESULT_MODAL_CLOSE_SELECTOR,
  SPY_RESULT_MODAL_CONTENT_SELECTOR,
  SPY_RESULT_MODAL_DETAILS_SELECTOR,
  SPY_RESULT_MODAL_SELECTOR,
  SPY_RESULT_MODAL_SUMMARY_SELECTOR,
  SPY_RESULT_MODAL_TITLE_SELECTOR
} from "../runtime/constants.js";
import { renderBattleReport } from "./battleReportPanel.js";
import { createBuildingActionFeedItemElement } from "./eventFeedPanel.js";
import { closeOverlay } from "./legacyOverlayCoordinator.js";
import { renderSpyResult } from "./spyPanel.js";
import {
  createServerReportFeedEntries,
  createServerReportFeedFingerprint,
  createServerReportResultView
} from "./serverGameplayReportViewModel.js";
export function createServerGameplayReportController({
  root,
  documentRef = root?.ownerDocument || globalThis.document
} = {}) {
  let mounted = false;
  let initialized = false;
  let elements = {};
  let latestReports = [];
  let renderedFingerprint = "";
  const seenReportIds = new Set();
  const pendingResults = [];
  const diagnostics = {
    updates: 0,
    feedRenders: 0,
    modalOpens: 0,
    queuedResults: 0
  };
  const isModalOpen = (modal) => Boolean(
    modal
    && !modal.classList?.contains?.("hidden")
    && modal.getAttribute?.("aria-hidden") !== "true"
  );
  const hasOpenResult = () => isModalOpen(elements.attackModal) || isModalOpen(elements.spyModal);
  const closeResult = (modal) => {
    if (!modal || !isModalOpen(modal)) return false;
    modal.classList.add("hidden");
    closeOverlay(modal);
    openNextPendingResult();
    return true;
  };
  const onAttackClose = (event) => {
    guardModalClose(event);
    closeResult(elements.attackModal);
  };
  const onSpyClose = (event) => {
    guardModalClose(event);
    closeResult(elements.spyModal);
  };
  const onKeydown = (event) => {
    if (event.key !== "Escape") return;
    if (isModalOpen(elements.attackModal)) closeResult(elements.attackModal);
    else if (isModalOpen(elements.spyModal)) closeResult(elements.spyModal);
  };

  function guardModalClose(event) {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    event?.stopImmediatePropagation?.();
  }
  function openReportResult(report) {
    if (!mounted || hasOpenResult()) return false;
    const result = createServerReportResultView(report);
    if (!result) return false;
    const opened = report.reportType === "battle"
      ? renderBattleReport(root, result)
      : renderSpyResult(result, {
          elements: {
            modal: elements.spyModal,
            content: elements.spyContent,
            title: elements.spyTitle,
            summary: elements.spySummary,
            details: elements.spyDetails
          },
          toneClasses: [
            "is-success",
            "is-medium-fail",
            "is-major-fail",
            "is-player-alert",
            "is-alliance-alert"
          ]
        });
    if (opened) diagnostics.modalOpens += 1;
    return opened;
  }
  function openNextPendingResult() {
    if (!mounted || hasOpenResult()) return false;
    const report = pendingResults.shift();
    return report ? openReportResult(report) : false;
  }
  function queueResult(report) {
    if (!createServerReportResultView(report)) return;
    pendingResults.push(report);
    diagnostics.queuedResults += 1;
    openNextPendingResult();
  }
  function renderFeed(reports) {
    const entries = createServerReportFeedEntries(reports);
    const fingerprint = createServerReportFeedFingerprint(entries);
    if (fingerprint === renderedFingerprint) return 0;
    const items = entries
      .map((entry, index) => createBuildingActionFeedItemElement(documentRef, entry, {
        onOpenResult: () => openReportResult(reports[index])
      }))
      .filter(Boolean);
    elements.feed?.replaceChildren?.(...items);
    setHidden(elements.feed, items.length === 0);
    setHidden(elements.empty, items.length > 0);
    if (elements.clear) {
      elements.clear.disabled = true;
      elements.clear.setAttribute("aria-disabled", "true");
    }
    const newest = entries[0] || null;
    setText(elements.state, newest ? resultStatusLabel(reports[0]) : "Připraveno");
    setText(elements.summary, newest?.summary || "Žádné autoritativní uliční zprávy.");
    setText(elements.meta, newest?.meta || "Čeká na první serverovou událost");
    renderedFingerprint = fingerprint;
    diagnostics.feedRenders += 1;
    return 1;
  }
  const update = (readModel) => {
    if (!mounted) return 0;
    diagnostics.updates += 1;
    const reports = Array.isArray(readModel?.reports) ? readModel.reports : [];
    const newReports = initialized
      ? reports.filter((report) => report?.reportId && !seenReportIds.has(String(report.reportId)))
      : [];
    for (const report of reports) {
      if (report?.reportId) seenReportIds.add(String(report.reportId));
    }
    trimSeenReports(seenReportIds);
    latestReports = reports;
    const writes = renderFeed(reports);
    initialized = true;
    for (const report of [...newReports].reverse()) queueResult(report);
    return writes;
  };
  const mount = () => {
    if (mounted) return false;
    elements = collectElements(root);
    if (!elements.feed) return false;
    bindCloseControls(elements.attackCloseControls, onAttackClose, "addEventListener");
    bindCloseControls(elements.spyCloseControls, onSpyClose, "addEventListener");
    documentRef?.addEventListener?.("keydown", onKeydown);
    mounted = true;
    return true;
  };

  const destroy = () => {
    if (!mounted) return false;
    mounted = false;
    bindCloseControls(elements.attackCloseControls, onAttackClose, "removeEventListener");
    bindCloseControls(elements.spyCloseControls, onSpyClose, "removeEventListener");
    documentRef?.removeEventListener?.("keydown", onKeydown);
    pendingResults.length = 0;
    closeResult(elements.attackModal);
    closeResult(elements.spyModal);
    elements.feed?.replaceChildren?.();
    seenReportIds.clear();
    latestReports = [];
    renderedFingerprint = "";
    initialized = false;
    elements = {};
    return true;
  };

  return {
    mount,
    update,
    destroy,
    getDiagnostics: () => ({
      ...diagnostics,
      mounted,
      pendingResults: pendingResults.length,
      reportCount: latestReports.length
    })
  };
}

function collectElements(root) {
  const query = (selector) => root?.querySelector?.(selector) || null;
  return {
    feed: query(BUILDING_ACTION_FEED_SELECTOR),
    empty: query(BUILDING_ACTION_EMPTY_SELECTOR),
    state: query(BUILDING_ACTION_STATE_SELECTOR),
    summary: query(BUILDING_ACTION_SUMMARY_SELECTOR),
    meta: query(BUILDING_ACTION_META_SELECTOR),
    clear: query(BUILDING_ACTION_CLEAR_SELECTOR),
    attackModal: query(ATTACK_RESULT_MODAL_SELECTOR),
    attackCloseControls: [
      query(ATTACK_RESULT_MODAL_BACKDROP_SELECTOR),
      query(ATTACK_RESULT_MODAL_CLOSE_SELECTOR)
    ].filter(Boolean),
    spyModal: query(SPY_RESULT_MODAL_SELECTOR),
    spyContent: query(SPY_RESULT_MODAL_CONTENT_SELECTOR),
    spyTitle: query(SPY_RESULT_MODAL_TITLE_SELECTOR),
    spySummary: query(SPY_RESULT_MODAL_SUMMARY_SELECTOR),
    spyDetails: query(SPY_RESULT_MODAL_DETAILS_SELECTOR),
    spyCloseControls: [
      query(SPY_RESULT_MODAL_BACKDROP_SELECTOR),
      query(SPY_RESULT_MODAL_CLOSE_SELECTOR)
    ].filter(Boolean)
  };
}

function bindCloseControls(controls, listener, method) {
  for (const control of controls || []) {
    control?.[method]?.("click", listener);
  }
}

function setText(element, value) {
  if (!element || element.textContent === String(value)) return;
  element.textContent = String(value);
}

function setHidden(element, hidden) {
  if (element) element.hidden = Boolean(hidden);
}

function resultStatusLabel(report) {
  if (!report) return "Připraveno";
  if (report.result === "success") return "Úspěch";
  if (report.result === "partial") return "Částečný výsledek";
  if (report.result === "catastrophe" || report.result === "critical_failed") return "Kritický výsledek";
  return "Nový report";
}

function trimSeenReports(seenReportIds, limit = 256) {
  while (seenReportIds.size > limit) {
    seenReportIds.delete(seenReportIds.values().next().value);
  }
}

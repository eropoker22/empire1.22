export function createBuildingActionStatusRuntime(deps = {}) {
  // Preview-only legacy feed runtime. Server-fed gameplay slice reports own authoritative building action results.
  const mutationObserverFactory = deps.MutationObserver || (typeof MutationObserver !== "undefined" ? MutationObserver : null);
  const windowRef = deps.windowRef || (typeof window !== "undefined" ? window : null);
  const setIntervalRef = typeof deps.setInterval === "function"
    ? deps.setInterval
    : (windowRef && typeof windowRef.setInterval === "function" ? windowRef.setInterval.bind(windowRef) : null);
  const clearIntervalRef = typeof deps.clearInterval === "function"
    ? deps.clearInterval
    : (windowRef && typeof windowRef.clearInterval === "function" ? windowRef.clearInterval.bind(windowRef) : null);

  const bindBuildingActionStatus = (root) => {
    const panel = deps.resolveBuildingActionPanel(root);
    if (!panel) {
      return;
    }

    deps.renderBuildingActionFeed(root, { syncPreview: true });

    if (panel.observer) {
      panel.observer.disconnect();
    }

    if (panel.cooldownFeedTimerId != null && clearIntervalRef) {
      clearIntervalRef(panel.cooldownFeedTimerId);
      panel.cooldownFeedTimerId = null;
    }

    if (setIntervalRef) {
      panel.cooldownFeedTimerId = setIntervalRef(() => {
        deps.renderBuildingActionFeed(root, { syncPreview: false });
      }, 1000);
    }

    panel.clearButton.addEventListener("click", () => {
      panel.entries = [];
      panel.lastFingerprint = "";
      panel.skipFingerprint = "";
      deps.renderBuildingActionFeed(root, {
        syncPreview: true,
        previewSnapshot: deps.buildingActionEmptySnapshot
      });
    });

    panel.feedElement.addEventListener("click", (event) => {
      const removeButton = event.target instanceof Element
        ? event.target.closest(deps.buildingActionRemoveSelector)
        : null;

      if (!(removeButton instanceof HTMLButtonElement)) {
        return;
      }

      const messageId = String(removeButton.dataset.buildingActionRemove || "").trim();
      if (!messageId) {
        return;
      }

      panel.entries = panel.entries.filter((entry) => entry.id !== messageId);
      panel.lastFingerprint = panel.entries[0]
        ? deps.createBuildingActionFingerprint(panel.entries[0])
        : "";
      panel.skipFingerprint = "";
      deps.renderBuildingActionFeed(root, {
        syncPreview: true,
        previewSnapshot: panel.entries[0] || deps.buildingActionEmptySnapshot
      });
    });

    panel.feedElement.addEventListener("keydown", (event) => {
      if (!(event.target instanceof Element)) {
        return;
      }

      if (event.key !== "Enter" && event.key !== " ") {
        return;
      }

      const removeButton = event.target.closest(deps.buildingActionRemoveSelector);
      if (removeButton instanceof HTMLButtonElement) {
        return;
      }

      const actionItem = event.target.closest(".building-action-status__item");

      if (!(actionItem instanceof HTMLElement)) {
        return;
      }

      const messageId = String(actionItem.dataset.buildingActionId || "").trim();
      const entry = messageId
        ? panel.entries.find((candidate) => candidate.id === messageId)
        : null;
      const canOpenEntry = typeof deps.isBuildingActionEntryOpenable === "function"
        ? deps.isBuildingActionEntryOpenable(entry)
        : Boolean(entry?.resultKind && entry.resultPayload);

      if (!canOpenEntry) {
        return;
      }

      event.preventDefault();
      deps.queueOrOpenResultModal(root, entry.resultKind, entry.resultPayload);
    });

    const openCurrentResultFromSummary = () => deps.openCurrentBuildingActionResultModal(root);

    panel.summaryElement.addEventListener("click", openCurrentResultFromSummary);
    panel.metaElement.addEventListener("click", openCurrentResultFromSummary);
    panel.summaryElement.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openCurrentResultFromSummary();
      }
    });
    panel.metaElement.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openCurrentResultFromSummary();
      }
    });

    if (!mutationObserverFactory) {
      return;
    }

    panel.observer = new mutationObserverFactory(() => {
      deps.scheduleBuildingActionMutationCapture(root);
    });

    for (const element of [panel.stateElement, panel.summaryElement, panel.metaElement]) {
      panel.observer.observe(element, {
        childList: true,
        characterData: true,
        subtree: true
      });
    }
  };

  return {
    bindBuildingActionStatus
  };
}

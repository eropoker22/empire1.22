export function createResultModalRuntime(deps = {}) {
  const selectors = deps.selectors || {};
  let resultModalQueue = null;

  const getVisibleResultModal = (root) => [
    root?.querySelector?.(selectors.spyResult),
    root?.querySelector?.(selectors.spyWarning),
    root?.querySelector?.(selectors.raidResult),
    root?.querySelector?.(selectors.attackResult),
    root?.querySelector?.(selectors.policeActionResult)
  ].find((element) => element && !element.classList.contains("hidden")) || null;

  const openSpyResultModal = (root, payload = {}) => deps.renderSimpleResultModal?.(root, payload, {
    modalSelector: selectors.spyResult,
    contentSelector: selectors.spyResultContent,
    titleSelector: selectors.spyResultTitle,
    summarySelector: selectors.spyResultSummary,
    detailsSelector: selectors.spyResultDetails,
    toneClasses: ["is-success", "is-medium-fail", "is-major-fail", "is-player-alert", "is-alliance-alert"],
    fallbackTone: "is-major-fail",
    defaultTitle: "Výsledek špehování"
  });

  const openOccupationResultModal = (root, payload = {}) => {
    openSpyResultModal(root, payload);
  };

  const openSpyWarningModal = (root, payload = {}) => {
    const districtName = deps.formatDistrictReference?.(payload.district || payload.districtId);
    const detectedAtLabel = deps.formatDistrictGossipTimestamp?.(payload.detectedAt || Date.now());
    const attackerNick = String(payload.attackerNick || "Neznámý hráč");
    const attackerGang = String(payload.attackerGang || "Neznámý gang");
    const attackerAlliance = String(payload.attackerAlliance || "Bez aliance");

    return deps.renderSpyWarningPanel?.(root, {
      ...payload,
      districtName,
      detectedAtLabel,
      attackerNick,
      attackerGang,
      attackerAlliance
    });
  };

  const openRaidResultModal = (root, payload = {}) => deps.renderSimpleResultModal?.(root, payload, {
    modalSelector: selectors.raidResult,
    contentSelector: selectors.raidResultContent,
    titleSelector: selectors.raidResultTitle,
    summarySelector: selectors.raidResultSummary,
    detailsSelector: selectors.raidResultDetails,
    toneClasses: ["is-clean-success", "is-dirty-fail", "is-disaster", "is-alert"],
    fallbackTone: "is-alert",
    defaultTitle: "Výsledek krádeže"
  });

  const openAttackResultModal = (root, payload = {}) => deps.renderBattleReportPanel?.(root, {
    lootLabel: "Žádný",
    heatGainedLabel: "+0",
    policeWarningLabel: "Bez hlášení",
    nextActionLabel: "Zpět na mapu",
    ...payload
  });

  const openResultModalByKind = (root, kind, payload) => {
    if (kind === "spy") {
      openSpyResultModal(root, payload);
      deps.onOpenResult?.({ root, kind, payload });
      return;
    }

    if (kind === "occupy") {
      openOccupationResultModal(root, payload);
      deps.onOpenResult?.({ root, kind, payload });
      return;
    }

    if (kind === "spy_alert") {
      openSpyWarningModal(root, payload);
      deps.onOpenResult?.({ root, kind, payload });
      return;
    }

    if (kind === "raid") {
      openRaidResultModal(root, payload);
      deps.onOpenResult?.({ root, kind, payload });
      return;
    }

    if (kind === "attack") {
      openAttackResultModal(root, payload);
      deps.onOpenResult?.({ root, kind, payload });
      return;
    }

    if (kind === "police") {
      deps.openPoliceActionResultModal?.(root, payload);
      deps.onOpenResult?.({ root, kind, payload });
    }
  };

  const getResultModalQueue = () => {
    if (!resultModalQueue) {
      resultModalQueue = deps.createResultModalQueue?.({
        getVisibleModal: getVisibleResultModal,
        openByKind: openResultModalByKind
      });
    }

    return resultModalQueue;
  };

  const renderNextPendingResultModal = (root) => {
    getResultModalQueue()?.renderNext(root);
  };

  const queueOrOpenResultModal = (root, kind, payload) => {
    getResultModalQueue()?.queueOrOpen(root, kind, payload);
  };

  const closeResultModal = (root, selector) => {
    getResultModalQueue()?.close(root, selector);
  };

  return {
    closeResultModal,
    getResultModalQueue,
    getVisibleResultModal,
    openAttackResultModal,
    openOccupationResultModal,
    openRaidResultModal,
    openResultModalByKind,
    openSpyResultModal,
    openSpyWarningModal,
    queueOrOpenResultModal,
    renderNextPendingResultModal
  };
}

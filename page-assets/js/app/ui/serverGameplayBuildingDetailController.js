import { initBuildingDetailPanel } from "./buildingDetailPanel.js";

export function createServerGameplayBuildingDetailController({
  root,
  documentRef = root?.ownerDocument || globalThis.document,
  dispatchSurfaceAction,
  getCurrentView,
  getCurrentRenderState
} = {}) {
  let mounted = false;
  let panel = null;
  let shell = null;
  let activeBuildingId = null;

  const getBuilding = (buildingId = activeBuildingId) => (
    getCurrentView?.()?.buildings?.find?.(
      (entry) => String(entry.buildingId) === String(buildingId)
    ) || null
  );

  const createDetailView = (building) => {
    const detail = building?.detail || {};
    const renderState = getCurrentRenderState?.();
    const slot = renderState?.districtPanel?.slots?.find?.(
      (entry) => String(entry?.buildingId) === String(building?.buildingId)
    ) || null;
    const actions = [
      ...(detail.actions || []),
      ...(detail.specialActions || [])
    ].map((entry, index) => ({
      index,
      actionId: entry.actionId,
      buildingTypeId: building.buildingTypeId,
      title: entry.label,
      buttonCostLabel: entry.inputSummary || "",
      rewardSummary: entry.outputSummary || entry.effectSummary || "",
      cooldownLabel: entry.cooldownLabel || "",
      cooldownRemainingMs: entry.cooldownRemainingMs || 0,
      disabled: Boolean(entry.disabled),
      disabledReason: entry.disabledReason || entry.blockedReason || "",
      phaseLockLabel: entry.phaseBadgeLabel || ""
    }));
    return {
      root: documentRef?.body || root,
      districtId: getCurrentView?.()?.districtId || "",
      buildingId: building.buildingId,
      buildingTypeId: building.buildingTypeId,
      mechanicsType: building.buildingTypeId,
      districtType: getCurrentView?.()?.districtType || "",
      title: building.label,
      name: building.label,
      levelLabel: detail.statusLabel || "",
      meta: [detail.typeLabel, detail.zoneLabel, detail.statusLabel].filter(Boolean).join(" · "),
      intro: detail.info || "",
      stats: detail.stats || [],
      mechanics: [
        detail.roleLabel ? { label: "Role", value: detail.roleLabel } : null,
        detail.phaseBadgeLabel ? { label: "Fáze", value: detail.phaseBadgeLabel } : null
      ].filter(Boolean),
      effects: [detail.passivePhaseEffectLabel, detail.phaseTooltip].filter(Boolean),
      actions,
      collect: slot?.production ? {
        visible: true,
        enabled: slot.production.canCollect === true,
        title: slot.production.collectDisabledReason || slot.production.storageLabel || ""
      } : { visible: false, enabled: false, title: "" },
      upgrade: { visible: false, disabled: true, title: "" },
      showActionsInSinglePanel: true
    };
  };

  const runAction = (payload = {}) => dispatchSurfaceAction?.({
    buildingActionBuildingId: activeBuildingId,
    buildingActionId: payload.actionId,
    dealerSlotId: payload.dealerSlotId || null,
    dealerItemId: payload.itemId || null,
    amount: Number.isFinite(payload.amount) ? payload.amount : null
  });

  const open = (buildingId) => {
    if (!mounted) return false;
    const building = getBuilding(buildingId);
    if (!building) return false;
    activeBuildingId = String(building.buildingId);
    shell = panel.open(createDetailView(building), {
      onClose: () => {
        activeBuildingId = null;
      },
      onCollect: () => {
        if (activeBuildingId) {
          void dispatchSurfaceAction?.({ collectBuildingId: activeBuildingId });
        }
      },
      onRunAction: (_shell, payload) => {
        if (activeBuildingId) void runAction(payload);
      }
    });
    return Boolean(shell);
  };

  const mount = () => {
    if (mounted) return false;
    panel = initBuildingDetailPanel({
      root: documentRef?.body || root,
      popupKey: "server-authoritative"
    });
    mounted = true;
    return true;
  };

  const update = () => activeBuildingId ? open(activeBuildingId) : false;

  const close = () => {
    if (!shell || shell.hidden) return false;
    panel?.close?.();
    activeBuildingId = null;
    return true;
  };

  const destroy = () => {
    if (!mounted) return false;
    panel?.destroy?.();
    panel = null;
    shell = null;
    activeBuildingId = null;
    mounted = false;
    return true;
  };

  return {
    mount,
    update,
    open,
    close,
    destroy,
    isOpen: () => Boolean(shell && !shell.hidden),
    getDiagnostics: () => ({ mounted, open: Boolean(shell && !shell.hidden), activeBuildingId })
  };
}

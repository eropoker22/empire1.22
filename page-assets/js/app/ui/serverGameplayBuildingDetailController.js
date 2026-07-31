import { initBuildingDetailPanel } from "./buildingDetailPanel.js";
import { createServerGameplayBuildingActionController } from "./serverGameplayBuildingActionController.js";
import { createServerGameplayProductionBuildingController } from "./serverGameplayProductionBuildingController.js";
import { ServerBuildingPresentationAdapter } from "../runtime/buildingPresentationAdapters.js";
import { pickBuildingDetailPresentationViewModel } from "../runtime/buildingPresentationContract.js";

const PRODUCTION_BUILDING_TYPES = new Set(["pharmacy", "drug_lab", "factory", "armory"]);
const normalizeBuildingType = (value) => String(value || "").trim().replace(/-/gu, "_");

export function createServerGameplayBuildingDetailController({
  root,
  documentRef = root?.ownerDocument || globalThis.document,
  dispatchSurfaceAction,
  getCurrentView,
  getCurrentReadModel,
  getCurrentRenderState
} = {}) {
  let mounted = false;
  let panel = null;
  let shell = null;
  let activeBuildingId = null;
  let activeDetailView = null;
  let productionController = null;
  let buildingActionController = null;
  const createLocalPresentationProfile = () => {
    const view = getCurrentView?.() || {};
    const districtId = Number(String(view.districtId || "").match(/\d+/u)?.[0] || 0);
    return {
      districtId,
      districtLabel: districtId ? `District ${districtId}` : "",
      typeKey: String(view.districtType || ""),
      typeLabel: String(view.districtType || ""),
      typeShortLabel: String(view.districtType || ""),
      setKey: "",
      setTitle: "",
      tier: "",
      buildings: (view.buildings || []).map((building) => ({
        baseName: String(building?.detail?.typeLabel || building?.displayName || building?.label || ""),
        displayName: String(building?.displayName || building?.label || ""),
        imagePath: building?.detail?.backgroundImagePath || null
      }))
    };
  };
  const getPresentationReadModel = () => {
    const readModel = getCurrentReadModel?.() || null;
    const view = getCurrentView?.() || null;
    if (!readModel?.district || !view) return readModel;
    const rawBuildings = Array.isArray(readModel.district.buildings)
      ? readModel.district.buildings
      : [];
    const buildings = (view.buildings || []).map((building) => {
      const rawBuilding = rawBuildings.find(
        (entry) => String(entry?.buildingId || "") === String(building?.buildingId || "")
      ) || {};
      const detail = building?.detail || {};
      const panelActions = [...(detail.actions || []), ...(detail.specialActions || [])].map(
        (action) => ({
          ...action,
          enabled: action?.enabled ?? !action?.disabled
        })
      );
      return {
        ...detail,
        ...rawBuilding,
        buildingId: String(building?.buildingId || rawBuilding.buildingId || ""),
        buildingTypeId: String(building?.buildingTypeId || rawBuilding.buildingTypeId || ""),
        label: String(rawBuilding.label || detail.typeLabel || building?.displayName || ""),
        displayName: String(rawBuilding.displayName || building?.displayName || ""),
        actions: Array.isArray(rawBuilding.actions) && rawBuilding.actions.length > 0
          ? rawBuilding.actions
          : panelActions
      };
    });
    return { ...readModel, district: { ...readModel.district, buildings } };
  };
  const presentationAdapter = new ServerBuildingPresentationAdapter({
    getReadModel: getPresentationReadModel,
    resolveDistrictBuildingProfile: createLocalPresentationProfile
  });

  const getBuilding = (buildingId = activeBuildingId) => (
    getCurrentView?.()?.buildings?.find?.(
      (entry) => String(entry.buildingId) === String(buildingId)
    ) || null
  );

  const createDetailView = (building) => {
    const readModel = getPresentationReadModel();
    const district = readModel?.district || null;
    if (!district?.districtId) return null;
    const presentation = presentationAdapter.getBuildingDetailPresentation(
      {
        id: Number(String(district.districtId).match(/\d+/u)?.[0] || 0),
        canonicalId: district.districtId,
        districtType: district.zone
      },
      { buildingId: building?.buildingId || "" },
      { renderState: getCurrentRenderState?.() || null }
    );
    return presentation
      ? pickBuildingDetailPresentationViewModel(presentation.viewModel, {
          root: documentRef?.body || root
        })
      : null;
  };

  const runAction = async (payload = {}) => {
    const buildingId = activeBuildingId;
    const result = await buildingActionController?.run?.({
      shell,
      buildingId,
      detailView: activeDetailView,
      isStillActive: () => Boolean(
        activeBuildingId === buildingId
        && activeDetailView?.actions?.some?.(
          (action) => String(action?.actionId || "") === String(payload.actionId || "")
            && action.disabled !== true
            && !String(action.disabledReason || "").trim()
        )
      ),
      payload
    });
    return activeBuildingId === buildingId ? result : null;
  };

  const open = (buildingId) => {
    if (!mounted) return false;
    const building = getBuilding(buildingId);
    if (!building) return false;
    if (
      PRODUCTION_BUILDING_TYPES.has(normalizeBuildingType(building.buildingTypeId))
      && productionController?.open?.(building.buildingId)
    ) {
      activeBuildingId = null;
      activeDetailView = null;
      buildingActionController?.close?.();
      panel?.close?.();
      shell = null;
      return true;
    }
    productionController?.close?.();
    activeBuildingId = String(building.buildingId);
    const detailView = createDetailView(building);
    if (!detailView) {
      activeBuildingId = null;
      activeDetailView = null;
      return false;
    }
    activeDetailView = detailView;
    shell = panel.open(detailView, {
      onClose: () => {
        buildingActionController?.close?.();
        activeBuildingId = null;
        activeDetailView = null;
      },
      onCollect: () => {
        if (activeBuildingId) void dispatchSurfaceAction?.({ collectBuildingId: activeBuildingId });
      },
      onRunAction: (_shell, payload) => {
        if (activeBuildingId) void runAction(payload);
      }
    });
    if (!shell) {
      activeBuildingId = null;
      activeDetailView = null;
      return false;
    }
    const readModel = getCurrentReadModel?.() || null;
    shell.dataset.uiOwner = "legacy-shared";
    shell.dataset.executionMode = "server-authoritative";
    shell.dataset.serverInstanceId = String(
      readModel?.server?.serverInstanceId || readModel?.player?.instanceId || ""
    );
    shell.dataset.serverDistrictId = String(readModel?.district?.districtId || "");
    shell.dataset.serverBuildingId = String(building.buildingId || "");
    shell.dataset.serverBuildingTypeId = String(building.buildingTypeId || "");
    shell.dataset.districtBuildingDetailDistrictId = String(readModel?.district?.districtId || "");
    return Boolean(shell);
  };

  const mount = () => {
    if (mounted) return false;
    panel = initBuildingDetailPanel({
      root: documentRef?.body || root,
      popupKey: "server-authoritative"
    });
    productionController = createServerGameplayProductionBuildingController({
      root,
      documentRef,
      dispatchSurfaceAction,
      getCurrentReadModel
    });
    buildingActionController = createServerGameplayBuildingActionController({
      documentRef,
      dispatchSurfaceAction
    });
    productionController.mount();
    mounted = true;
    return true;
  };

  const update = () => {
    if (productionController?.isOpen?.()) return productionController.update();
    return activeBuildingId ? open(activeBuildingId) : false;
  };

  const close = () => {
    const productionClosed = productionController?.close?.() || false;
    buildingActionController?.close?.();
    if (!shell || shell.hidden) return productionClosed;
    panel?.close?.();
    activeBuildingId = null;
    activeDetailView = null;
    return true;
  };

  const destroy = () => {
    if (!mounted) return false;
    productionController?.destroy?.();
    buildingActionController?.destroy?.();
    panel?.destroy?.();
    productionController = null;
    buildingActionController = null;
    panel = null;
    shell = null;
    activeBuildingId = null;
    activeDetailView = null;
    mounted = false;
    return true;
  };

  return {
    mount,
    update,
    open,
    close,
    destroy,
    isOpen: () => Boolean(shell && !shell.hidden) || Boolean(productionController?.isOpen?.()),
    getDiagnostics: () => ({
      mounted,
      open: Boolean(shell && !shell.hidden) || Boolean(productionController?.isOpen?.()),
      activeBuildingId,
      production: productionController?.getDiagnostics?.() || null
    })
  };
}

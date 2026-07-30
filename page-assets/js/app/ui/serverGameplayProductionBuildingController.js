import { closeOverlay, openOverlay } from "./legacyOverlayCoordinator.js";
import {
  normalizeServerProductionBuildingType,
  renderServerProductionBuilding,
  SERVER_PRODUCTION_POPUPS
} from "./serverGameplayProductionBuildingView.js";

export function createServerGameplayProductionBuildingController({
  root,
  documentRef = root?.ownerDocument || globalThis.document,
  dispatchSurfaceAction,
  getCurrentReadModel
} = {}) {
  let mounted = false;
  let activeBuildingId = null;
  let activeBuildingType = null;
  const bindings = new Map();
  const diagnostics = { opens: 0, renders: 0, closes: 0, commands: 0 };

  const getRawBuilding = (buildingId = activeBuildingId) => (
    getCurrentReadModel?.()?.district?.buildings?.find?.(
      (building) => String(building?.buildingId) === String(buildingId)
    ) || null
  );

  const getProductionModel = (building) => {
    const readModel = getCurrentReadModel?.();
    const districtId = readModel?.district?.districtId;
    const type = normalizeServerProductionBuildingType(building?.buildingTypeId);
    if (!districtId || !SERVER_PRODUCTION_POPUPS[type]) return null;
    if (type === "factory") {
      const fallback = readModel?.player?.factoryProduction;
      const factory = building.factory
        || (String(fallback?.buildingId) === String(building.buildingId) ? fallback : null);
      return factory ? {
        ...factory,
        buildingId: factory.buildingId || building.buildingId,
        districtId: factory.districtId || districtId,
        level: building.level || factory.level || 1
      } : null;
    }
    const production = type === "pharmacy"
      ? building.pharmacy
      : type === "drug_lab"
        ? building.drugLab
        : building.armory;
    return production ? {
      ...production,
      buildingId: production.buildingId || building.buildingId,
      districtId,
      level: building.level || production.level || 1,
      cleanCashAmount: Math.max(0, Number(readModel?.player?.resourceBalances?.cash || 0))
    } : null;
  };

  const getLines = (type, model) => (
    type === "pharmacy" || type === "drug_lab"
      ? model?.lines || []
      : model?.productionLines || []
  );

  const setActiveTab = (binding, tabName = "stats") => {
    for (const button of binding.tabs) {
      const key = binding.type === "factory"
        ? button.dataset.factoryTab
        : String(button.dataset.productionBuildingTab || "").split(":")[1];
      const active = key === tabName;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-selected", String(active));
    }
    for (const panel of binding.panels) {
      const key = binding.type === "factory"
        ? panel.dataset.factoryPanel
        : String(panel.dataset.productionBuildingPanel || "").split(":")[1];
      panel.hidden = key !== tabName;
    }
  };

  const dispatch = async (surfaceDataset) => {
    diagnostics.commands += 1;
    const response = await dispatchSurfaceAction?.(surfaceDataset);
    render();
    return response;
  };

  function render() {
    if (!mounted || !activeBuildingId || !activeBuildingType) return 0;
    const binding = bindings.get(activeBuildingType);
    const building = getRawBuilding();
    const model = getProductionModel(building);
    if (!binding || !building || !model) return 0;
    const lines = getLines(activeBuildingType, model);
    renderServerProductionBuilding({
      binding,
      building,
      model,
      lines,
      tickRateMs: getCurrentReadModel?.()?.mode?.tickRateMs,
      onStart: (targetBuilding, line, quantity) => void dispatch({
        craftBuildingId: targetBuilding.buildingId,
        craftRecipeId: line.recipeId,
        craftQuantity: quantity
      }),
      onCancel: (targetBuilding, line) => void dispatch({
        cancelProductionBuildingId: targetBuilding.buildingId,
        cancelProductionRecipeId: line.recipeId
      })
    });
    diagnostics.renders += 1;
    return 1;
  }

  const close = () => {
    const binding = bindings.get(activeBuildingType);
    if (!binding || binding.popup.hidden) return false;
    binding.popup.hidden = true;
    closeOverlay(binding.popup, { restoreFocus: false });
    activeBuildingId = null;
    activeBuildingType = null;
    diagnostics.closes += 1;
    return true;
  };

  const collectReady = async () => {
    const building = getRawBuilding();
    const model = getProductionModel(building);
    if (!building || !model) return;
    for (const line of getLines(activeBuildingType, model).filter((item) => item.canCollect)) {
      await dispatch({
        collectBuildingId: building.buildingId,
        collectResourceKey: line.resourceKey
      });
    }
  };

  const open = (buildingId) => {
    if (!mounted) return false;
    const building = getRawBuilding(buildingId);
    const type = normalizeServerProductionBuildingType(building?.buildingTypeId);
    const binding = bindings.get(type);
    if (!building || !binding || !getProductionModel(building)) return false;
    if (activeBuildingType && activeBuildingType !== type) close();
    activeBuildingId = String(building.buildingId);
    activeBuildingType = type;
    setActiveTab(binding, "stats");
    render();
    openOverlay(binding.popup, { type: "modal", ariaModal: true, restoreFocusOnClose: false });
    diagnostics.opens += 1;
    return true;
  };

  const onKeydown = (event) => {
    if (event.key === "Escape" && activeBuildingType) close();
  };

  const mount = () => {
    if (mounted) return false;
    for (const [type, config] of Object.entries(SERVER_PRODUCTION_POPUPS)) {
      const popup = documentRef?.querySelector?.(config.popup);
      const mountElement = popup?.querySelector?.(config.panel);
      if (!popup || !mountElement) continue;
      const binding = {
        type,
        popup,
        mount: mountElement,
        tabs: Array.from(popup.querySelectorAll(config.tab)),
        panels: Array.from(popup.querySelectorAll(config.tabPanel)),
        collect: popup.querySelector(type === "factory"
          ? "[data-factory-collect]"
          : "[data-production-building-collect]"),
        listeners: []
      };
      for (const element of popup.querySelectorAll(config.close)) {
        const listener = (event) => {
          event.preventDefault();
          event.stopPropagation();
          close();
        };
        element.addEventListener("click", listener);
        binding.listeners.push([element, "click", listener]);
      }
      for (const button of binding.tabs) {
        const listener = () => {
          const tabName = type === "factory"
            ? button.dataset.factoryTab
            : String(button.dataset.productionBuildingTab || "").split(":")[1];
          setActiveTab(binding, tabName || "stats");
        };
        button.addEventListener("click", listener);
        binding.listeners.push([button, "click", listener]);
      }
      if (binding.collect) {
        const listener = () => void collectReady();
        binding.collect.addEventListener("click", listener);
        binding.listeners.push([binding.collect, "click", listener]);
      }
      bindings.set(type, binding);
    }
    documentRef?.addEventListener?.("keydown", onKeydown);
    mounted = true;
    return true;
  };

  const destroy = () => {
    if (!mounted) return false;
    close();
    documentRef?.removeEventListener?.("keydown", onKeydown);
    for (const binding of bindings.values()) {
      for (const [element, eventName, listener] of binding.listeners) {
        element.removeEventListener(eventName, listener);
      }
    }
    bindings.clear();
    mounted = false;
    return true;
  };

  return {
    mount,
    update: render,
    open,
    close,
    destroy,
    isOpen: () => Boolean(activeBuildingType && !bindings.get(activeBuildingType)?.popup?.hidden),
    getDiagnostics: () => ({
      ...diagnostics,
      mounted,
      activeBuildingId,
      activeBuildingType,
      bindingCount: bindings.size
    })
  };
}

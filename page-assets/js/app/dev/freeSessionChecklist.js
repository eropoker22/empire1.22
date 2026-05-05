function isObject(value) {
  return value && typeof value === "object";
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function hasElement(root, selector) {
  if (!root || !selector || typeof root.querySelector !== "function") {
    return false;
  }

  return Boolean(root.querySelector(selector));
}

function hasFunction(value) {
  return typeof value === "function";
}

function createCheck(id, label, ready, severity = "warning", detail = "") {
  return {
    id,
    label,
    ready: Boolean(ready),
    severity,
    detail: detail || (ready ? "ready" : "missing")
  };
}

export function getFreeSessionReadinessStatus(checks = []) {
  const list = asArray(checks);
  const hasBlocker = list.some((check) => !check.ready && check.severity === "blocker");
  const hasWarning = list.some((check) => !check.ready);

  if (hasBlocker) {
    return "blocked";
  }

  return hasWarning ? "partial" : "ready";
}

export function evaluateFreeSessionReadiness({
  root = null,
  state = {},
  windowRef = typeof window !== "undefined" ? window : null,
  selectors = {},
  demoActive = false
} = {}) {
  const player = state.player || state.registration || state.session?.registration || null;
  const districts = asArray(state.districts || state.world?.districts);
  const ownedDistricts = districts.filter((district) => district?.ownerId === state.playerId || district?.isOwned || district?.owner === "player");
  const ownDistrict = state.ownDistrict || ownedDistricts[0] || null;
  const enemyDistrict = state.enemyDistrict || districts.find((district) => district && district !== ownDistrict && !district.isOwned) || null;
  const buildings = asArray(ownDistrict?.buildings || state.buildings);
  const runtimeApi = isObject(windowRef?.EmpireRuntime) ? windowRef.EmpireRuntime : {};
  const districtApi = isObject(windowRef?.empireStreetsDistrictState) ? windowRef.empireStreetsDistrictState : {};

  const checks = [
    createCheck("player", "Player exists", Boolean(player), "blocker"),
    createCheck("start-district", "Player has owned district", Boolean(ownDistrict), "blocker"),
    createCheck("districts", "Districts exist", districts.length > 0, "blocker"),
    createCheck("map-container", "Map container exists", hasElement(root, selectors.map || "[data-map-canvas], canvas, [data-map-root]"), "blocker"),
    createCheck("resources", "Resources/topbar exists", hasElement(root, selectors.resources || "[data-topbar-clean-money], [data-resource-panel], [data-storage-popup]"), "warning"),
    createCheck("storage", "Storage UI exists", hasElement(root, selectors.storage || "[data-storage-popup]"), "warning"),
    createCheck("own-buildings", "Owned district buildings exist", buildings.length > 0, "warning"),
    createCheck("building-detail", "Building detail UI available", hasElement(root, selectors.buildingDetail || "[data-district-building-detail], [data-building-detail-panel]"), "warning"),
    createCheck("production", "Production path available", hasElement(root, selectors.production || "[data-production-panel], [data-production-building-panel]") || buildings.length > 0, "warning"),
    createCheck("target-district", "Target district exists", Boolean(enemyDistrict), "warning"),
    createCheck("spy", "Spy UI available", hasElement(root, selectors.spy || "[data-spy-confirm-popup], [data-spy-panel]"), "warning"),
    createCheck("attack", "Attack UI available", hasElement(root, selectors.attack || "[data-attack-confirm-popup], [data-attack-panel]"), "warning"),
    createCheck("battle-report", "Battle report UI available", hasElement(root, selectors.battleReport || "[data-attack-result-modal], [data-battle-report]"), "warning"),
    createCheck("heat-wanted", "Heat/wanted UI available", hasElement(root, selectors.wanted || "[data-wanted-panel], [data-gang-heat]"), "warning"),
    createCheck("police", "Police feedback available", hasElement(root, selectors.police || "[data-police-action-result-modal], [data-police-feed]"), "warning"),
    createCheck("map-api", "District map API available", hasFunction(districtApi.getSelectedDistrict) || hasFunction(districtApi.refreshSelectedDistrictPanel), "warning"),
    createCheck("runtime-api", "Runtime API available", hasFunction(runtimeApi.refreshAllUi) || hasFunction(windowRef?.refreshAllUi), "warning"),
    createCheck("demo-inactive", "Demo inactive in normal free mode", !demoActive, "warning")
  ];

  return {
    status: getFreeSessionReadinessStatus(checks),
    checks,
    blockers: checks.filter((check) => !check.ready && check.severity === "blocker"),
    warnings: checks.filter((check) => !check.ready && check.severity !== "blocker")
  };
}

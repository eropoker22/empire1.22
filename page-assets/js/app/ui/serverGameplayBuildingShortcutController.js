const SHORTCUTS = Object.freeze([
  { selector: "[data-buildings-popup-open]", buildingTypeId: null },
  { selector: "[data-pharmacy-popup-open]", buildingTypeId: "pharmacy" },
  { selector: "[data-druglab-popup-open]", buildingTypeId: "drug_lab" },
  { selector: "[data-factory-popup-open]", buildingTypeId: "factory" },
  { selector: "[data-armory-popup-open]", buildingTypeId: "armory" }
]);

const normalizeTypeId = (value) => {
  const normalized = String(value || "").trim().replace(/-/gu, "_");
  return normalized === "druglab" ? "drug_lab" : normalized;
};

const uniqueIds = (values) => [...new Set(
  values.map((value) => String(value || "").trim()).filter(Boolean)
)];

export function createServerGameplayBuildingShortcutController({
  root,
  source,
  districtController
} = {}) {
  let mounted = false;
  let pending = false;
  let requestSequence = 0;
  let latestReadModel = null;
  let bindings = [];
  const knownDistrictByType = new Map();
  const inspectedDistrictIds = new Set();
  const diagnostics = {
    opens: 0,
    districtLoads: 0,
    skippedWhilePending: 0,
    unavailable: 0,
    failures: 0
  };

  const indexDistrict = (readModel) => {
    const districtId = String(readModel?.district?.districtId || "").trim();
    if (!districtId) return;
    inspectedDistrictIds.add(districtId);
    for (const building of readModel?.district?.buildings || []) {
      const typeId = normalizeTypeId(building?.buildingTypeId);
      if (typeId) knownDistrictByType.set(typeId, districtId);
    }
  };

  const update = (readModel) => {
    latestReadModel = readModel || null;
    indexDistrict(latestReadModel);
    return 0;
  };

  const getOwnedDistricts = () => {
    const playerId = String(latestReadModel?.player?.playerId || "");
    return (latestReadModel?.districts || []).filter((district) => (
      district?.isOwnedByPlayer === true
      || String(district?.ownerPlayerId || "") === playerId
    ));
  };

  const getCandidateDistrictIds = (buildingTypeId = null) => {
    const normalizedTypeId = normalizeTypeId(buildingTypeId);
    const selectedDistrict = latestReadModel?.district;
    const selectedIsOwned = selectedDistrict?.isOwnedByPlayer === true
      || String(selectedDistrict?.ownerPlayerId || "") === String(latestReadModel?.player?.playerId || "");
    const factoryDistrictId = normalizedTypeId === "factory"
      ? latestReadModel?.player?.factoryProduction?.districtId
      : null;
    const ownedDistricts = getOwnedDistricts();
    const ownedDistrictIds = new Set(ownedDistricts.map((district) => String(district.districtId)));
    const knownDistrictId = normalizedTypeId
      ? knownDistrictByType.get(normalizedTypeId)
      : null;
    return uniqueIds([
      ownedDistrictIds.has(String(knownDistrictId || "")) ? knownDistrictId : null,
      factoryDistrictId,
      selectedIsOwned ? selectedDistrict?.districtId : null,
      latestReadModel?.player?.homeDistrictId,
      ...ownedDistricts
        .filter((district) => Number(district?.filledSlotCount || 0) > 0)
        .sort((left, right) => (
          Number(inspectedDistrictIds.has(left.districtId))
          - Number(inspectedDistrictIds.has(right.districtId))
        ))
        .map((district) => district.districtId)
    ]);
  };

  const loadDistrict = async (districtId) => {
    const currentDistrictId = String(latestReadModel?.district?.districtId || "");
    const currentRenderState = source?.getCurrentRenderState?.() || null;
    if (
      currentDistrictId === districtId
      && String(currentRenderState?.districtPanel?.districtId || "") === districtId
    ) {
      return {
        accepted: true,
        readModel: latestReadModel,
        renderState: currentRenderState
      };
    }
    diagnostics.districtLoads += 1;
    return source?.selectDistrict?.(districtId) || null;
  };

  const openShortcut = async (buildingTypeId, sequence) => {
    for (const districtId of getCandidateDistrictIds(buildingTypeId)) {
      const response = await loadDistrict(districtId);
      if (!mounted || sequence !== requestSequence) return false;
      const readModel = response?.readModel || source?.getCurrentReadModel?.() || null;
      const renderState = response?.renderState || source?.getCurrentRenderState?.() || null;
      if (
        response?.accepted !== true
        || String(readModel?.district?.districtId || "") !== districtId
        || String(renderState?.districtPanel?.districtId || "") !== districtId
      ) {
        continue;
      }
      update(readModel);
      const normalizedTypeId = normalizeTypeId(buildingTypeId);
      const hasBuilding = !normalizedTypeId || readModel.district.buildings?.some(
        (building) => normalizeTypeId(building?.buildingTypeId) === normalizedTypeId
      );
      if (!hasBuilding) continue;
      const opened = districtController?.handleDistrictSelected?.({
        districtId,
        response: { ...response, accepted: true, readModel, renderState }
      });
      if (!opened) return false;
      if (normalizedTypeId) {
        const buildingOpened = await districtController?.openBuildingByType?.(normalizedTypeId);
        if (!buildingOpened) return false;
      }
      diagnostics.opens += 1;
      return true;
    }
    diagnostics.unavailable += 1;
    return false;
  };

  const activate = async (binding) => {
    if (!mounted || pending) {
      if (pending) diagnostics.skippedWhilePending += 1;
      return false;
    }
    pending = true;
    const sequence = ++requestSequence;
    binding.element.setAttribute("aria-busy", "true");
    binding.element.dataset.serverShortcutState = "pending";
    try {
      const opened = await openShortcut(binding.buildingTypeId, sequence);
      if (mounted && sequence === requestSequence) {
        binding.element.dataset.serverShortcutState = opened ? "ready" : "unavailable";
      }
      return opened;
    } catch {
      diagnostics.failures += 1;
      if (mounted && sequence === requestSequence) {
        binding.element.dataset.serverShortcutState = "error";
      }
      return false;
    } finally {
      if (sequence === requestSequence) pending = false;
      binding.element.removeAttribute("aria-busy");
    }
  };

  const mount = () => {
    if (mounted) return false;
    bindings = SHORTCUTS.flatMap((definition) => {
      const element = root?.querySelector?.(definition.selector);
      if (!element) return [];
      const binding = {
        ...definition,
        element,
        onClick: () => void activate(binding)
      };
      element.addEventListener("click", binding.onClick);
      return [binding];
    });
    mounted = true;
    return true;
  };

  const destroy = () => {
    if (!mounted) return false;
    mounted = false;
    pending = false;
    requestSequence += 1;
    for (const binding of bindings) {
      binding.element.removeEventListener("click", binding.onClick);
      binding.element.removeAttribute("aria-busy");
      delete binding.element.dataset.serverShortcutState;
    }
    bindings = [];
    latestReadModel = null;
    knownDistrictByType.clear();
    inspectedDistrictIds.clear();
    return true;
  };

  return {
    mount,
    update,
    destroy,
    getDiagnostics: () => ({ ...diagnostics, mounted, pending, bindingCount: bindings.length })
  };
}

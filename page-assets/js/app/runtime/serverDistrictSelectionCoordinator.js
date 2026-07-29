const normalizeLookupKey = (value) => String(value || "")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/gu, "")
  .toLowerCase()
  .replace(/[^a-z0-9]+/gu, " ")
  .trim();

const BUILDING_TYPE_ALIASES = Object.freeze({
  armory: ["armory", "zbrojovka"],
  drug_lab: ["drug lab", "druglab", "lab"],
  factory: ["factory", "tovarna"],
  pharmacy: ["pharmacy", "lekarna"]
});

export function toCanonicalServerDistrictId(value) {
  const normalized = String(value?.districtId ?? value?.id ?? value ?? "").trim();
  if (!normalized) return "";
  return normalized.startsWith("district:") ? normalized : `district:${normalized}`;
}

export function resolveServerDistrictBuilding(readModel, request = {}) {
  const buildings = Array.isArray(readModel?.district?.buildings)
    ? readModel.district.buildings
    : [];
  const requestedBuildingId = String(request.buildingId || "").trim();
  if (requestedBuildingId) {
    return buildings.find((building) => (
      String(building?.buildingId || "").trim() === requestedBuildingId
    )) || null;
  }

  const requestedType = normalizeLookupKey(request.buildingTypeId).replace(/\s+/gu, "_");
  if (requestedType) {
    return buildings.find((building) => (
      normalizeLookupKey(building?.buildingTypeId).replace(/\s+/gu, "_") === requestedType
    )) || null;
  }

  const requestedName = normalizeLookupKey(request.buildingName);
  if (!requestedName) return null;
  return buildings.find((building) => {
    const typeId = normalizeLookupKey(building?.buildingTypeId).replace(/\s+/gu, "_");
    const candidates = [
      building?.label,
      building?.displayName,
      building?.variantName,
      building?.buildingTypeId,
      ...(BUILDING_TYPE_ALIASES[typeId] || [])
    ].map(normalizeLookupKey).filter(Boolean);
    return candidates.includes(requestedName);
  }) || null;
}

export function createServerDistrictSelectionCoordinator({
  selectDistrict,
  getReadModel = () => null,
  onLoading = () => {},
  onReady = () => {},
  onError = () => {}
} = {}) {
  let requestGeneration = 0;
  let activeRequest = null;

  const open = async ({
    district,
    districtId,
    buildingId = "",
    buildingTypeId = "",
    buildingName = ""
  } = {}) => {
    const canonicalDistrictId = toCanonicalServerDistrictId(districtId || district);
    if (!canonicalDistrictId || typeof selectDistrict !== "function") {
      const error = new Error("Serverový district selector není připojený.");
      onError({ error, canonicalDistrictId, district, requestGeneration });
      return { accepted: false, error, stale: false };
    }

    const generation = ++requestGeneration;
    activeRequest = {
      generation,
      canonicalDistrictId,
      buildingId: String(buildingId || "").trim(),
      buildingTypeId: String(buildingTypeId || "").trim(),
      buildingName: String(buildingName || "").trim()
    };
    onLoading({ ...activeRequest, district });

    let response;
    try {
      response = await selectDistrict(canonicalDistrictId);
    } catch (error) {
      if (generation !== requestGeneration) {
        return { accepted: false, error, stale: true };
      }
      onError({ error, response: null, ...activeRequest, district });
      return { accepted: false, error, stale: false };
    }

    if (generation !== requestGeneration) {
      return { accepted: false, response, stale: true };
    }

    const readModel = response?.readModel || getReadModel() || null;
    if (
      response?.accepted !== true
      || String(readModel?.district?.districtId || "") !== canonicalDistrictId
    ) {
      const error = new Error("Server vrátil jiný district než hráč požadoval.");
      onError({ error, response, readModel, ...activeRequest, district });
      return { accepted: false, error, readModel, response, stale: false };
    }

    const requiresBuilding = Boolean(activeRequest.buildingId || activeRequest.buildingTypeId || activeRequest.buildingName);
    const building = requiresBuilding
      ? resolveServerDistrictBuilding(readModel, activeRequest)
      : null;
    if (requiresBuilding && !building) {
      const error = new Error("Požadovaná budova není v načteném districtu dostupná.");
      onError({ error, response, readModel, ...activeRequest, district });
      return { accepted: false, error, readModel, response, stale: false };
    }

    const result = {
      accepted: true,
      building,
      canonicalDistrictId,
      district,
      readModel,
      response,
      stale: false
    };
    onReady(result);
    return result;
  };

  const cancel = () => {
    requestGeneration += 1;
    activeRequest = null;
  };

  return {
    cancel,
    open,
    getState: () => ({
      activeRequest: activeRequest ? { ...activeRequest } : null,
      requestGeneration
    })
  };
}

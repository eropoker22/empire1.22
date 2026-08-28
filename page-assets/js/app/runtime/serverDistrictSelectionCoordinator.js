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
  const normalized = String(
    value?.canonicalId
    ?? value?.districtId
    ?? value?.id
    ?? value
    ?? ""
  ).trim();
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
  getRenderState = () => null,
  onLoading = () => {},
  onReady = () => {},
  onError = () => {},
  now = () => Date.now()
} = {}) {
  let requestGeneration = 0;
  let activeRequest = null;
  let activeRequestPromise = null;
  const readModelsByDistrictId = new Map();

  const cacheReadModel = (readModel, renderState = null) => {
    const districtId = String(readModel?.district?.districtId || "").trim();
    if (!districtId || !readModel) return false;
    const existing = readModelsByDistrictId.get(districtId);
    readModelsByDistrictId.set(districtId, {
      readModel,
      renderState: renderState || existing?.renderState || null,
      cachedAt: Number(now()) || Date.now()
    });
    return true;
  };
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

    const requestedBuilding = {
      buildingId: String(buildingId || "").trim(),
      buildingTypeId: String(buildingTypeId || "").trim(),
      buildingName: String(buildingName || "").trim()
    };
    const requiresBuilding = Boolean(
      requestedBuilding.buildingId
      || requestedBuilding.buildingTypeId
      || requestedBuilding.buildingName
    );
    const currentReadModel = getReadModel() || null;
    const currentRenderState = getRenderState() || null;
    const currentDistrictMatches = String(
      currentReadModel?.district?.districtId || ""
    ) === canonicalDistrictId;
    const currentBuilding = requiresBuilding
      && currentDistrictMatches
      ? resolveServerDistrictBuilding(currentReadModel, requestedBuilding)
      : null;
    if (currentDistrictMatches && (!requiresBuilding || currentBuilding)) {
      cacheReadModel(currentReadModel, currentRenderState);
      const result = {
        accepted: true,
        building: currentBuilding,
        canonicalDistrictId,
        district,
        readModel: currentReadModel,
        renderState: currentRenderState,
        response: null,
        stale: false
      };
      onReady(result);
      return result;
    }

    const matchesActiveRequest = activeRequest
      && activeRequest.canonicalDistrictId === canonicalDistrictId
      && activeRequest.buildingId === requestedBuilding.buildingId
      && activeRequest.buildingTypeId === requestedBuilding.buildingTypeId
      && activeRequest.buildingName === requestedBuilding.buildingName;
    if (matchesActiveRequest && activeRequestPromise) {
      return activeRequestPromise;
    }

    const generation = ++requestGeneration;
    activeRequest = {
      generation,
      canonicalDistrictId,
      ...requestedBuilding
    };
    onLoading({ ...activeRequest, district });

    const requestPromise = (async () => {
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
        renderState: response?.renderState || getRenderState() || null,
        response,
        stale: false
      };
      cacheReadModel(readModel, result.renderState);
      onReady(result);
      return result;
    })();
    activeRequestPromise = requestPromise;
    try {
      return await requestPromise;
    } finally {
      if (activeRequest?.generation === generation) {
        activeRequest = null;
        activeRequestPromise = null;
      }
    }
  };

  const cancel = () => {
    requestGeneration += 1;
    activeRequest = null;
    activeRequestPromise = null;
  };

  return {
    cancel,
    cacheReadModel,
    clearCache: () => readModelsByDistrictId.clear(),
    open,
    getState: () => ({
      activeRequest: activeRequest ? { ...activeRequest } : null,
      requestGeneration,
      cachedDistrictIds: [...readModelsByDistrictId.keys()]
    })
  };
}

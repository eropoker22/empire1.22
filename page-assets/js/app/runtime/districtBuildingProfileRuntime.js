export function createDistrictBuildingProfileRuntime(deps = {}) {
  let districtResourceCatalogCache = null;
  let districtBuildingGlobalVariantOccurrenceCache = null;

  const getDistrictResourceCatalog = () => {
    if (Array.isArray(districtResourceCatalogCache)) {
      return districtResourceCatalogCache;
    }

    const rowCount = deps.districtTypeGrid.length;
    const columnCount = deps.districtTypeGrid[0]?.length || 0;
    const typeByDistrictId = new Map();
    const districts = [];

    for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
      for (let columnIndex = 0; columnIndex < columnCount; columnIndex += 1) {
        const rawDistrictId = rowIndex * columnCount + columnIndex + 1;
        typeByDistrictId.set(rawDistrictId, deps.districtTypeGrid[rowIndex]?.[columnIndex] || deps.defaultDistrictType);
      }
    }

    for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
      for (let columnIndex = 0; columnIndex < columnCount; columnIndex += 1) {
        const rawDistrictId = rowIndex * columnCount + columnIndex + 1;
        districts.push({
          id: deps.remapDistrictId(rawDistrictId),
          rowIndex,
          columnIndex,
          districtType: deps.remapDistrictType(rawDistrictId, typeByDistrictId)
        });
      }
    }

    districtResourceCatalogCache = districts;
    return districts;
  };

  const isDistrictTypeVisible = (district, interactionState = {}) => {
    if (!district) {
      return false;
    }

    if (interactionState.destroyedDistrictIds?.has(district.id)) {
      return true;
    }

    if (district.districtType === deps.downtownDistrictType) {
      return true;
    }

    const spyIntel = deps.getResolvedSpyIntel();
    if (spyIntel.revealedTypeDistrictIds.includes(Number(district.id))) {
      return true;
    }

    const currentPlayerOwnedDistrictIds = deps.getCurrentPlayerOwnedDistrictIds(interactionState);
    if (currentPlayerOwnedDistrictIds.has(Number(district.id))) {
      return true;
    }

    const launchOwnerByDistrictId = interactionState.launchOwnerByDistrictId || deps.startPhaseOwnerByDistrictId;
    const launchOwnerId = launchOwnerByDistrictId?.get(district.id);
    if (launchOwnerId && launchOwnerId !== deps.currentPlayerId) {
      return false;
    }

    if ((interactionState.gamePhase || "launch") !== "launch") {
      return true;
    }

    const revealedDistrictIds = interactionState.revealedDistrictIds || new Set();
    const ownedDistrictIds = deps.getEffectiveOwnedDistrictIds(interactionState);
    return revealedDistrictIds.has(district.id) || ownedDistrictIds.has(district.id);
  };

  const isDistrictTypeHidden = (district, interactionState = {}) => !isDistrictTypeVisible(district, interactionState);

  const getDistrictCoreWeight = (district) => {
    const rowIndex = Number.isFinite(Number(district?.rowIndex)) ? Number(district.rowIndex) : 3;
    const columnIndex = Number.isFinite(Number(district?.columnIndex)) ? Number(district.columnIndex) : 11;
    const rowDistance = Math.abs(rowIndex - 3) / 3;
    const columnDistance = Math.abs(columnIndex - 11) / 11;
    return deps.clamp(1 - (rowDistance * 0.55 + columnDistance * 0.45), 0, 1);
  };

  const resolveDistrictBuildingTier = (district) => {
    const districtType = String(district?.districtType || "resident");
    const weight = getDistrictCoreWeight(district);

    if (districtType === "downtown") {
      if (weight >= 0.86) return "core";
      if (weight >= 0.7) return "high";
      return "mid";
    }

    if (districtType === "resident") {
      if (weight >= 0.7) return "late";
      if (weight >= 0.42) return "mid";
      return "early";
    }

    if (weight >= 0.72) return "top";
    if (weight >= 0.42) return "mid";
    return "early";
  };

  const getDistrictBuildingSeed = (district) => {
    const rowIndex = Number.isFinite(Number(district?.rowIndex)) ? Number(district.rowIndex) : Number(district?.id || 0);
    const columnIndex = Number.isFinite(Number(district?.columnIndex)) ? Number(district.columnIndex) : String(district?.districtType || "").length;
    const districtId = Number(district?.id || 0) || 0;
    return deps.hashCell(rowIndex + districtId, columnIndex + districtId);
  };

  const getDistrictBuildingVariantName = (district, buildingName, buildingIndex = 0) => {
    const occurrenceIndex = getDistrictBuildingGlobalVariantOccurrenceIndex(district, buildingIndex, buildingIndex);
    return getDistrictBuildingVariantSelection(district, buildingName, occurrenceIndex).displayName;
  };

  const getDistrictBuildingVariantSelection = (district, buildingName, occurrenceIndex = 0) => {
    const baseName = String(buildingName || "Neznámá budova").trim() || "Neznámá budova";
    const variants = deps.variantNamesByBaseName?.[baseName];
    if (!Array.isArray(variants) || variants.length <= 0) {
      return {
        displayName: baseName,
        variantIndex: -1
      };
    }

    const safeOccurrenceIndex = Math.max(0, Number(occurrenceIndex || 0));
    const variantIndex = safeOccurrenceIndex % variants.length;
    const cycleIndex = Math.floor(safeOccurrenceIndex / variants.length);
    const variantBaseName = variants[variantIndex] || baseName;
    const displayName = cycleIndex > 0
      ? `${variantBaseName} #${cycleIndex + 1}`
      : variantBaseName;

    return {
      displayName,
      variantIndex
    };
  };

  const getDistrictBuildingImagePath = (baseName, variantIndex = -1, buildingIndex = 0) => {
    const imagePaths = deps.backgroundImagesByBaseName?.[baseName];
    if (!Array.isArray(imagePaths) || imagePaths.length <= 0) {
      return null;
    }

    const variants = deps.variantNamesByBaseName?.[baseName];
    const safeIndex = Number.isFinite(variantIndex) && variantIndex >= 0 ? variantIndex : Math.max(0, Number(buildingIndex || 0));
    const poolIndex = Array.isArray(variants) && variants.length > 0
      ? Math.min(
          imagePaths.length - 1,
          Math.floor((safeIndex * imagePaths.length) / Math.max(1, variants.length))
        )
      : safeIndex % imagePaths.length;

    return imagePaths[poolIndex] || imagePaths[0] || null;
  };

  const resolveDistrictBuildingPackage = (district) => {
    const districtType = deps.districtBuildingTypeMeta[district?.districtType] ? district.districtType : "resident";
    const districtId = Number(district?.id || 0);
    const remappedDistrictId = typeof deps.remapDistrictId === "function"
      ? Number(deps.remapDistrictId(districtId))
      : districtId;
    const fixedDistrictPackage = deps.districtFixedPackagesByDistrictId?.[districtId]
      || deps.districtFixedPackagesByDistrictId?.[remappedDistrictId]
      || null;
    const fixedDowntownPackage = districtType === "downtown"
      ? deps.downtownFixedPackagesByDistrictId[districtId] || deps.downtownFixedPackagesByDistrictId[remappedDistrictId]
      : null;

    if (fixedDistrictPackage) {
      return fixedDistrictPackage;
    }

    if (fixedDowntownPackage) {
      return fixedDowntownPackage;
    }

    const tier = resolveDistrictBuildingTier({ ...district, districtType });
    const poolsByTier = deps.districtBuildingPackagePools[districtType] || deps.districtBuildingPackagePools.resident;
    const pool = poolsByTier[tier]
      || Object.values(poolsByTier).find((entry) => Array.isArray(entry) && entry.length > 0)
      || [];
    const seed = getDistrictBuildingSeed(district);
    const selected = pool.length > 0 ? pool[seed % pool.length] : null;

    return selected || {
      key: `${districtType}-${tier}-fallback`,
      tier,
      title: "Základní set",
      buildings: []
    };
  };

  const normalizeBuildingBaseName = (buildingName) => String(buildingName || "Neznámá budova").trim() || "Neznámá budova";

  const getDistrictBuildingOccurrenceCacheKey = (district, buildingIndex) => {
    const districtId = Number(district?.id || 0) || 0;
    const index = Math.max(0, Number(buildingIndex || 0));
    return `${districtId}:${index}`;
  };

  const getDistrictBuildingGlobalVariantOccurrenceCache = () => {
    if (districtBuildingGlobalVariantOccurrenceCache instanceof Map) {
      return districtBuildingGlobalVariantOccurrenceCache;
    }

    const occurrenceByBaseName = new Map();
    const occurrenceByDistrictBuildingKey = new Map();
    const catalog = getDistrictResourceCatalog()
      .slice()
      .sort((left, right) => (Number(left?.id || 0) || 0) - (Number(right?.id || 0) || 0));

    for (const district of catalog) {
      const packageMeta = resolveDistrictBuildingPackage(district);
      const buildings = Array.isArray(packageMeta?.buildings) ? packageMeta.buildings : [];

      for (let index = 0; index < buildings.length; index += 1) {
        const baseName = normalizeBuildingBaseName(buildings[index]);
        const occurrenceIndex = occurrenceByBaseName.get(baseName) || 0;
        occurrenceByBaseName.set(baseName, occurrenceIndex + 1);
        occurrenceByDistrictBuildingKey.set(getDistrictBuildingOccurrenceCacheKey(district, index), occurrenceIndex);
      }
    }

    districtBuildingGlobalVariantOccurrenceCache = occurrenceByDistrictBuildingKey;
    return districtBuildingGlobalVariantOccurrenceCache;
  };

  const getDistrictBuildingGlobalVariantOccurrenceIndex = (district, buildingIndex = 0, fallbackOccurrenceIndex = 0) => {
    const cache = getDistrictBuildingGlobalVariantOccurrenceCache();
    const key = getDistrictBuildingOccurrenceCacheKey(district, buildingIndex);
    const occurrenceIndex = cache.get(key);
    return Number.isFinite(Number(occurrenceIndex))
      ? Number(occurrenceIndex)
      : Math.max(0, Number(fallbackOccurrenceIndex || 0));
  };

  const resolveDistrictBuildingProfile = (district) => {
    if (!district) {
      return null;
    }

    const districtType = deps.districtBuildingTypeMeta[district.districtType] ? district.districtType : "resident";
    const typeMeta = deps.districtBuildingTypeMeta[districtType] || deps.districtBuildingTypeMeta.resident;
    const packageMeta = resolveDistrictBuildingPackage({ ...district, districtType });
    const consumedOccurrencesByBaseName = new Map();
    const buildings = Array.isArray(packageMeta.buildings)
      ? packageMeta.buildings.map((buildingName, index) => {
          const baseName = normalizeBuildingBaseName(buildingName);
          const occurrenceIndex = consumedOccurrencesByBaseName.get(baseName) || 0;
          consumedOccurrencesByBaseName.set(baseName, occurrenceIndex + 1);
          const globalOccurrenceIndex = getDistrictBuildingGlobalVariantOccurrenceIndex(district, index, occurrenceIndex);
          const variantSelection = getDistrictBuildingVariantSelection(district, baseName, globalOccurrenceIndex);
          const displayName = variantSelection.displayName;

          return {
            index,
            baseName,
            displayName,
            variantName: displayName !== baseName ? displayName : null,
            imagePath: getDistrictBuildingImagePath(baseName, variantSelection.variantIndex, index)
          };
        })
      : [];

    return {
      districtId: Number(district.id) || 0,
      districtLabel: `District ${district.id}`,
      typeKey: districtType,
      typeLabel: typeMeta.label,
      typeShortLabel: typeMeta.shortLabel,
      setKey: String(packageMeta.key || ""),
      setTitle: String(packageMeta.title || "District set"),
      tier: String(packageMeta.tier || resolveDistrictBuildingTier({ ...district, districtType }) || "mid"),
      buildings
    };
  };

  return {
    getDistrictBuildingSeed,
    getDistrictBuildingVariantName,
    getDistrictCoreWeight,
    getDistrictResourceCatalog,
    isDistrictTypeHidden,
    isDistrictTypeVisible,
    resolveDistrictBuildingPackage,
    resolveDistrictBuildingProfile,
    resolveDistrictBuildingTier
  };
}

if (typeof window !== "undefined") {
  window.EmpireDistrictBuildingProfileRuntime = {
    createDistrictBuildingProfileRuntime
  };
}

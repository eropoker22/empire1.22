export function createDistrictBuildingProfileRuntime(deps = {}) {
  let districtResourceCatalogCache = null;

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
    const baseName = String(buildingName || "Neznámá budova").trim() || "Neznámá budova";
    const variants = deps.variantNamesByBaseName[baseName];
    if (!Array.isArray(variants) || variants.length <= 0) {
      return baseName;
    }

    const districtId = Number(district?.id || 0) || 0;
    const seed = getDistrictBuildingSeed(district) + (districtId * 31) + (Math.max(0, buildingIndex) * 17);
    return variants[Math.abs(seed) % variants.length] || baseName;
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

    const districtId = Number(district?.id || 0) || 0;
    const startIndex = Math.abs(
      getDistrictBuildingSeed(district)
      + (districtId * 31)
      + (baseName.length * 17)
    ) % variants.length;
    const safeOccurrenceIndex = Math.max(0, Number(occurrenceIndex || 0));
    const variantIndex = (startIndex + safeOccurrenceIndex) % variants.length;
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
    const fixedDowntownPackage = districtType === "downtown"
      ? deps.downtownFixedPackagesByDistrictId[Number(district?.id || 0)]
      : null;

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

  const resolveDistrictBuildingProfile = (district) => {
    if (!district) {
      return null;
    }

    const districtType = deps.districtBuildingTypeMeta[district.districtType] ? district.districtType : "resident";
    const typeMeta = deps.districtBuildingTypeMeta[districtType] || deps.districtBuildingTypeMeta.resident;
    const packageMeta = resolveDistrictBuildingPackage({ ...district, districtType });
    const buildingOccurrencesByBaseName = Array.isArray(packageMeta.buildings)
      ? packageMeta.buildings.reduce((accumulator, buildingName) => {
          const baseName = String(buildingName || "Neznámá budova").trim() || "Neznámá budova";
          accumulator.set(baseName, (accumulator.get(baseName) || 0) + 1);
          return accumulator;
        }, new Map())
      : new Map();
    const consumedOccurrencesByBaseName = new Map();
    const buildings = Array.isArray(packageMeta.buildings)
      ? packageMeta.buildings.map((buildingName, index) => {
          const baseName = String(buildingName || "Neznámá budova").trim() || "Neznámá budova";
          const occurrenceIndex = consumedOccurrencesByBaseName.get(baseName) || 0;
          consumedOccurrencesByBaseName.set(baseName, occurrenceIndex + 1);
          const variantSelection = (buildingOccurrencesByBaseName.get(baseName) || 0) > 1
            ? getDistrictBuildingVariantSelection(district, baseName, occurrenceIndex, index)
            : {
                displayName: getDistrictBuildingVariantName(district, baseName, index),
                variantIndex: -1
              };
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

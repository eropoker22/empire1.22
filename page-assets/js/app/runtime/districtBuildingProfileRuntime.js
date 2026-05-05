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
    const buildings = Array.isArray(packageMeta.buildings)
      ? packageMeta.buildings.map((buildingName, index) => {
          const baseName = String(buildingName || "Neznámá budova").trim() || "Neznámá budova";
          const displayName = getDistrictBuildingVariantName(district, baseName, index);

          return {
            index,
            baseName,
            displayName,
            variantName: displayName !== baseName ? displayName : null
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

const normalizeBuildingTypeId = (value) => {
  const normalized = String(value || "").trim().replace(/-/gu, "_");
  return normalized === "druglab" ? "drug_lab" : normalized;
};

const uniqueDistrictIds = (values) => [...new Set(
  values
    .map((value) => String(value || "").trim())
    .filter((value) => /^district:[^:]+$/u.test(value))
)];

export function findServerBuildingByType(readModel, buildingTypeId) {
  const normalizedTypeId = normalizeBuildingTypeId(buildingTypeId);
  if (!normalizedTypeId) return null;
  return (readModel?.district?.buildings || []).find(
    (building) => normalizeBuildingTypeId(building?.buildingTypeId) === normalizedTypeId
  ) || null;
}

export function findServerBuildingByExactTarget(readModel, target, buildingTypeId) {
  const districtId = String(target?.districtId || "").trim();
  const buildingId = String(target?.buildingId || "").trim();
  const normalizedTypeId = normalizeBuildingTypeId(buildingTypeId || target?.buildingTypeId);
  if (
    !districtId
    || !buildingId
    || !normalizedTypeId
    || String(readModel?.district?.districtId || "") !== districtId
  ) {
    return null;
  }
  return (readModel?.district?.buildings || []).find((building) => (
    String(building?.buildingId || "").trim() === buildingId
    && normalizeBuildingTypeId(building?.buildingTypeId) === normalizedTypeId
  )) || null;
}

export function getServerBuildingShortcutCandidateDistrictIds(
  readModel,
  buildingTypeId,
  knownDistrictId = ""
) {
  const normalizedTypeId = normalizeBuildingTypeId(buildingTypeId);
  const playerId = String(readModel?.player?.playerId || "");
  const selectedDistrict = readModel?.district || null;
  const selectedIsOwned = selectedDistrict?.isOwnedByPlayer === true
    || String(selectedDistrict?.ownerPlayerId || "") === playerId;
  const ownedDistricts = (readModel?.districts || []).filter((district) => (
    district?.isOwnedByPlayer === true
    || String(district?.ownerPlayerId || "") === playerId
  ));
  const ownedDistrictIds = new Set(
    ownedDistricts.map((district) => String(district?.districtId || ""))
  );
  const safeKnownDistrictId = ownedDistrictIds.has(String(knownDistrictId || ""))
    ? knownDistrictId
    : "";
  const factoryDistrictId = normalizedTypeId === "factory"
    ? readModel?.player?.factoryProduction?.districtId
    : "";

  return uniqueDistrictIds([
    safeKnownDistrictId,
    selectedIsOwned ? selectedDistrict?.districtId : "",
    factoryDistrictId,
    readModel?.player?.homeDistrictId,
    ...ownedDistricts
      .sort((left, right) => (
        Number(right?.filledSlotCount || 0) - Number(left?.filledSlotCount || 0)
        || String(left?.districtId || "").localeCompare(String(right?.districtId || ""))
      ))
      .map((district) => district?.districtId)
  ]);
}

const normalizeDistrictId = (value) => {
  const districtId = String(value || "").trim();
  return /^district:.+$/u.test(districtId) ? districtId : "";
};

const TARGET_COLLECTION_BY_ACTION = Object.freeze({
  attack: "attackTargets",
  heist: "heistTargets",
  occupy: "occupyTargets",
  rob: "robTargets",
  spy: "spyTargets"
});

export function resolveServerDistrictActionTarget(readModel, actionId, targetDistrictId) {
  const canonicalTargetId = normalizeDistrictId(targetDistrictId);
  const collection = TARGET_COLLECTION_BY_ACTION[String(actionId || "")];
  if (!canonicalTargetId || !collection) return null;
  const district = readModel?.district || null;
  return [
    ...(district?.targetActions?.[collection] || []),
    ...(district?.[collection] || [])
  ].find((entry) => String(entry?.districtId || "") === canonicalTargetId) || null;
}

export function resolveServerSpyDistrictRoute(readModel, targetDistrictId) {
  const canonicalTargetId = normalizeDistrictId(targetDistrictId);
  if (!canonicalTargetId) return null;

  const spyTarget = resolveServerDistrictActionTarget(readModel, "spy", canonicalTargetId);
  const corridor = (readModel?.frontier?.corridorTargets || [])
    .find((entry) => String(entry?.targetDistrictId || "") === canonicalTargetId) || null;
  const sourceDistrictId = normalizeDistrictId(
    corridor?.sourceDistrictId || spyTarget?.sourceDistrictId
  );
  if (!sourceDistrictId || (!spyTarget && !corridor)) return null;

  const routeDistrictId = normalizeDistrictId(corridor?.routeDistrictId);
  const routeVersion = Number(corridor?.routeVersion);
  return {
    sourceDistrictId,
    ...(routeDistrictId ? { routeDistrictId } : {}),
    ...(routeDistrictId && Number.isSafeInteger(routeVersion) && routeVersion >= 0
      ? { expectedRouteVersion: routeVersion }
      : {})
  };
}

const normalizeDistrictId = (value) => {
  const districtId = String(value || "").trim();
  return /^district:[^:]+$/u.test(districtId) ? districtId : "";
};

export function resolveServerSpyDistrictRoute(readModel, targetDistrictId) {
  const canonicalTargetId = normalizeDistrictId(targetDistrictId);
  if (!canonicalTargetId) return null;

  const district = readModel?.district || null;
  const spyTarget = [
    ...(district?.targetActions?.spyTargets || []),
    ...(district?.spyTargets || [])
  ].find((entry) => String(entry?.districtId || "") === canonicalTargetId) || null;
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

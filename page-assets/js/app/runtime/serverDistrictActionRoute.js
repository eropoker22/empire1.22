const normalizeDistrictId = (value) => {
  const districtId = String(value || "").trim();
  return /^district:.+$/u.test(districtId) ? districtId : "";
};

const normalizeRevision = (value) => {
  if (typeof value !== "number") return null;
  const revision = value;
  return Number.isSafeInteger(revision) && revision >= 0 ? revision : null;
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
  if (!spyTarget || spyTarget.enabled !== true) return null;
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

export function resolveServerRobDistrictRoute(readModel, targetDistrictId) {
  const canonicalTargetId = normalizeDistrictId(targetDistrictId);
  if (!canonicalTargetId) return null;

  const robTarget = resolveServerDistrictActionTarget(readModel, "rob", canonicalTargetId);
  if (!robTarget || robTarget.enabled !== true) return null;
  const corridor = (readModel?.frontier?.corridorTargets || [])
    .find((entry) => String(entry?.targetDistrictId || "") === canonicalTargetId) || null;
  const sourceDistrictId = normalizeDistrictId(
    corridor?.sourceDistrictId || robTarget.sourceDistrictId
  );
  const expectedConflictRevision = normalizeRevision(robTarget.expectedConflictRevision);
  if (!sourceDistrictId || expectedConflictRevision === null) return null;

  const expectedLootPoolRevision = normalizeRevision(robTarget.expectedLootPoolRevision);
  const routeDistrictId = normalizeDistrictId(corridor?.routeDistrictId);
  const expectedRouteVersion = normalizeRevision(corridor?.routeVersion);
  return {
    sourceDistrictId,
    expectedConflictRevision,
    ...(expectedLootPoolRevision === null ? {} : { expectedLootPoolRevision }),
    ...(routeDistrictId ? { routeDistrictId } : {}),
    ...(routeDistrictId && expectedRouteVersion !== null ? { expectedRouteVersion } : {})
  };
}

export function resolveServerAttackDistrictRoute(readModel, targetDistrictId) {
  const canonicalTargetId = normalizeDistrictId(targetDistrictId);
  if (!canonicalTargetId) return null;
  const target = resolveServerDistrictActionTarget(readModel, "attack", canonicalTargetId);
  if (!target || target.enabled !== true) return null;
  return resolveServerConflictRoute(readModel, canonicalTargetId, target, {
    includeVersions: true
  });
}

export function resolveServerOccupyDistrictRoute(readModel, targetDistrictId) {
  const canonicalTargetId = normalizeDistrictId(targetDistrictId);
  if (!canonicalTargetId) return null;
  const target = resolveServerDistrictActionTarget(readModel, "occupy", canonicalTargetId);
  if (!target || target.enabled !== true) return null;
  return resolveServerConflictRoute(readModel, canonicalTargetId, target);
}

const resolveServerConflictRoute = (
  readModel,
  targetDistrictId,
  target,
  { includeVersions = false } = {}
) => {
  const corridor = (readModel?.frontier?.corridorTargets || [])
    .find((entry) => String(entry?.targetDistrictId || "") === targetDistrictId) || null;
  const sourceDistrictId = normalizeDistrictId(corridor?.sourceDistrictId || target?.sourceDistrictId);
  const expectedConflictRevision = normalizeRevision(target?.expectedConflictRevision);
  if (!sourceDistrictId || expectedConflictRevision === null) return null;

  const expectedSourceVersion = normalizeRevision(target?.expectedSourceVersion);
  const expectedTargetVersion = normalizeRevision(target?.expectedTargetVersion);
  const routeDistrictId = normalizeDistrictId(corridor?.routeDistrictId);
  const expectedRouteVersion = normalizeRevision(corridor?.routeVersion);
  return {
    sourceDistrictId,
    expectedConflictRevision,
    ...(includeVersions && expectedSourceVersion !== null ? { expectedSourceVersion } : {}),
    ...(includeVersions && expectedTargetVersion !== null ? { expectedTargetVersion } : {}),
    ...(routeDistrictId ? { routeDistrictId } : {}),
    ...(routeDistrictId && expectedRouteVersion !== null ? { expectedRouteVersion } : {})
  };
};

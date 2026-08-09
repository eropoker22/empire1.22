const EXACT_SHA_PATTERN = /^[0-9a-f]{40}$/u;
const HASH_PATTERN = /^[0-9a-f]{64}$/u;

export const RELEASE_EVIDENCE_ENVIRONMENTS = Object.freeze([
  "code-level",
  "hosted-ci",
  "public-staging"
]);

const fail = (code) => {
  throw new Error(code);
};

export const assertCanonicalInvariantEvidence = (
  evidence,
  code = "RELEASE_INVARIANT_EVIDENCE_INVALID"
) => {
  if (evidence?.status !== "passed"
    || !Number.isInteger(evidence?.checks)
    || evidence.checks <= 0
    || !Array.isArray(evidence?.violationCodes)
    || evidence.violationCodes.length !== 0) {
    fail(code);
  }
  return true;
};

export const assertCanonicalQuietHoursEvidence = (
  lifecycle,
  code = "RELEASE_QUIET_HOURS_EVIDENCE_INVALID"
) => {
  const quietHours = lifecycle?.quietHours;
  const expectedBoundaries = [
    ["before-start", false],
    ["start", true],
    ["inside", true],
    ["before-end", true],
    ["end", false]
  ];
  if (!Number.isInteger(lifecycle?.quietHourDeferrals)
    || lifecycle.quietHourDeferrals < 1
    || quietHours?.status !== "passed"
    || quietHours.timezone !== "Europe/Bratislava"
    || quietHours.deferrals !== lifecycle.quietHourDeferrals
    || !Array.isArray(quietHours.boundaryChecks)
    || quietHours.boundaryChecks.length !== expectedBoundaries.length) {
    fail(code);
  }
  let previousTick = -1;
  for (const [index, [id, inQuietHours]] of expectedBoundaries.entries()) {
    const boundary = quietHours.boundaryChecks[index];
    if (boundary?.id !== id || boundary.inQuietHours !== inQuietHours
      || !Number.isInteger(boundary.tick) || boundary.tick <= previousTick) {
      fail(code);
    }
    previousTick = boundary.tick;
  }
  if (!Number.isInteger(quietHours.eliminationBefore)
    || quietHours.eliminationAfterDeferredTick !== quietHours.eliminationBefore
    || quietHours.eliminationAfterAllowedTick !== quietHours.eliminationBefore + 1
    || quietHours.eliminationAfterNextTick !== quietHours.eliminationAfterAllowedTick
    || quietHours.activePlayersAfterDeferred !== quietHours.activePlayersBefore
    || !Number.isInteger(quietHours.deferredTick)
    || !Number.isInteger(quietHours.allowedTick)
    || !Number.isInteger(quietHours.nextEliminationTickAfterDeferred)
    || quietHours.allowedTick !== quietHours.nextEliminationTickAfterDeferred
    || quietHours.allowedTick <= quietHours.deferredTick
    || !HASH_PATTERN.test(String(quietHours.membershipStateHashBefore ?? ""))
    || quietHours.membershipStateHashAfterDeferred !== quietHours.membershipStateHashBefore
    || !HASH_PATTERN.test(String(quietHours.resourceStateHashBefore ?? ""))
    || quietHours.resourceStateHashAfterDeferred !== quietHours.resourceStateHashBefore) {
    fail(code);
  }
  return true;
};

export const assertCanonicalScenarioProvenance = (
  provenance,
  { buildSha, environment } = {},
  code = "RELEASE_EVIDENCE_PROVENANCE_INVALID"
) => {
  if (!provenance || typeof provenance !== "object"
    || typeof provenance.scenarioId !== "string" || provenance.scenarioId.trim() === ""
    || !EXACT_SHA_PATTERN.test(String(provenance.buildSha ?? ""))
    || (buildSha !== undefined && provenance.buildSha !== buildSha)
    || !RELEASE_EVIDENCE_ENVIRONMENTS.includes(provenance.environment)
    || (environment !== undefined && provenance.environment !== environment)
    || typeof provenance.testCommand !== "string" || provenance.testCommand.trim() === ""
    || typeof provenance.testFile !== "string" || provenance.testFile.trim() === ""
    || typeof provenance.browserUsed !== "boolean"
    || typeof provenance.postgresUsed !== "boolean"
    || typeof provenance.concurrencyUsed !== "boolean"
    || provenance.status !== "passed"
    || typeof provenance.artifactPath !== "string" || provenance.artifactPath.trim() === ""
    || (provenance.environment === "public-staging"
      && !provenance.artifactPath.startsWith("artifacts/remote-staging/"))) {
    fail(code);
  }
  return true;
};

import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildPreAlphaEvidenceBundle,
  normalizeExactBuildSha,
  PRE_ALPHA_EVIDENCE_REPORTS,
  sanitizeEvidence
} from "../../scripts/pre-alpha-evidence-bundle.mjs";

const SHA = "a".repeat(40);
const GENERATED_AT = "2026-08-06T12:00:00.000Z";

const createArtifactRoot = () => mkdtemp(path.join(os.tmpdir(), "empire-pre-alpha-evidence-"));

const writeJson = (file, value) => writeFile(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");

const provenance = (scenarioId, artifactPath) => ({
  scenarioId,
  buildSha: SHA,
  environment: "public-staging",
  testCommand: "npm run test:remote-staging:suite -- --suite=full-lifecycle-20p",
  testFile: "scripts/run-remote-staging-suite.mjs",
  browserUsed: true,
  postgresUsed: true,
  concurrencyUsed: false,
  status: "passed",
  artifactPath
});

const invariantEvidence = () => ({
  status: "passed",
  buildSha: SHA,
  checks: 12,
  violationCodes: [],
  provenance: provenance(
    "full-lifecycle-invariants",
    "artifacts/remote-staging/full-lifecycle-20p/invariant-report.json"
  )
});

const lifecycleEvidence = () => ({
  status: "passed",
  buildSha: SHA,
  quietHourDeferrals: 1,
  quietHours: {
    status: "passed",
    timezone: "Europe/Bratislava",
    deferrals: 1,
    boundaryChecks: [
      { id: "before-start", tick: 99, inQuietHours: false },
      { id: "start", tick: 100, inQuietHours: true },
      { id: "inside", tick: 101, inQuietHours: true },
      { id: "before-end", tick: 199, inQuietHours: true },
      { id: "end", tick: 200, inQuietHours: false }
    ],
    eliminationBefore: 0,
    eliminationAfterDeferredTick: 0,
    eliminationAfterAllowedTick: 1,
    eliminationAfterNextTick: 1,
    activePlayersBefore: 20,
    activePlayersAfterDeferred: 20,
    deferredTick: 100,
    allowedTick: 200,
    nextEliminationTickAfterDeferred: 200,
    membershipStateHashBefore: "b".repeat(64),
    membershipStateHashAfterDeferred: "b".repeat(64),
    resourceStateHashBefore: "c".repeat(64),
    resourceStateHashAfterDeferred: "c".repeat(64)
  },
  invariants: invariantEvidence(),
  provenance: provenance(
    "full-lifecycle-20p",
    "artifacts/remote-staging/full-lifecycle-20p/lifecycle-report.json"
  )
});

const passingEvidencePaths = async (artifactRoot) => {
  const evidencePaths = {};
  for (const definition of PRE_ALPHA_EVIDENCE_REPORTS) {
    const relativePath = path.join("inputs", definition.outputFile);
    await mkdir(path.dirname(path.join(artifactRoot, relativePath)), { recursive: true });
    await writeJson(path.join(artifactRoot, relativePath), definition.key === "lifecycle"
      ? lifecycleEvidence()
      : definition.key === "invariant"
        ? invariantEvidence()
        : {
      status: "passed",
      buildSha: SHA,
      ...(definition.key === "releaseHealth" ? {
        environment: "staging",
        frontendSha: SHA,
        apiSha: SHA,
        workerSha: SHA,
        schemaVersion: "024_hosted_starting_player_state.sql",
        assets: [{ publicPath: "/admin.html" }]
      } : {}),
      checks: [{ name: definition.key, status: "passed" }]
    });
    evidencePaths[definition.key] = relativePath;
  }
  return evidencePaths;
};

describe("pre-alpha evidence bundle", () => {
  it("requires an explicit composite concurrency-conflicts report instead of treating social privacy as full race proof", () => {
    const concurrency = PRE_ALPHA_EVIDENCE_REPORTS.find(({ key }) => key === "concurrency");
    expect(concurrency.sources.map(({ path: sourcePath }) => sourcePath)).toEqual([
      "remote-suites/concurrency-conflicts/concurrency-report.json",
      "concurrency-report.json"
    ]);
  });

  it("builds the complete canonical file set only when every explicit proof passed for the exact SHA", async () => {
    const artifactRoot = await createArtifactRoot();
    const evidencePaths = await passingEvidencePaths(artifactRoot);
    const result = await buildPreAlphaEvidenceBundle({
      artifactRoot,
      buildSha: SHA,
      evidencePaths,
      generatedAt: GENERATED_AT
    });

    expect(result.status).toBe("passed");
    expect(result.summary.counts).toEqual({ required: 9, passed: 9, failed: 0, notPassed: 0, notRun: 0 });
    const expectedFiles = [
      "summary.json",
      "summary.md",
      "test-results.json",
      "lifecycle-report.json",
      "concurrency-report.json",
      "invariant-report.json",
      "security-report.json",
      "balance-report.json",
      "performance-report.json",
      "release-health.json",
      "cleanup-report.json",
      "manifest.json"
    ];
    for (const file of expectedFiles) {
      await expect(readFile(path.join(result.outputDirectory, file), "utf8")).resolves.not.toHaveLength(0);
    }
    expect(JSON.parse(await readFile(path.join(result.outputDirectory, "summary.json"), "utf8"))).toMatchObject({
      buildSha: SHA,
      status: "passed",
      verdict: "passed"
    });
  });

  it("records missing proofs as not-run/missing and never upgrades an incomplete bundle to PASS", async () => {
    const artifactRoot = await createArtifactRoot();
    await writeJson(path.join(artifactRoot, "only-tests.json"), { status: "passed", buildSha: SHA });
    const result = await buildPreAlphaEvidenceBundle({
      artifactRoot,
      buildSha: SHA,
      evidencePaths: {
        testResults: "only-tests.json",
        lifecycle: null,
        concurrency: null,
        invariant: null,
        security: null,
        balance: null,
        performance: null,
        releaseHealth: null,
        cleanup: null
      },
      generatedAt: GENERATED_AT
    });

    expect(result.status).toBe("not-passed");
    expect(result.summary.counts).toEqual({ required: 9, passed: 1, failed: 0, notPassed: 0, notRun: 8 });
    const lifecycle = JSON.parse(await readFile(path.join(result.outputDirectory, "lifecycle-report.json"), "utf8"));
    expect(lifecycle).toMatchObject({ status: "not-run", availability: "missing", evidence: null });
    expect(await readFile(path.join(result.outputDirectory, "summary.md"), "utf8"))
      .toContain("Bundle neni release PASS");
  });

  it("fails a claimed PASS when its source evidence belongs to another release SHA", async () => {
    const artifactRoot = await createArtifactRoot();
    await writeJson(path.join(artifactRoot, "wrong-release.json"), {
      status: "passed",
      buildSha: "b".repeat(40)
    });
    const result = await buildPreAlphaEvidenceBundle({
      artifactRoot,
      buildSha: SHA,
      evidencePaths: {
        ...Object.fromEntries(PRE_ALPHA_EVIDENCE_REPORTS.map(({ key }) => [key, null])),
        testResults: "wrong-release.json"
      },
      generatedAt: GENERATED_AT
    });
    const report = JSON.parse(await readFile(path.join(result.outputDirectory, "test-results.json"), "utf8"));

    expect(result.status).toBe("not-passed");
    expect(report).toMatchObject({
      status: "failed",
      buildShaEvidence: "mismatch",
      issues: ["build-sha-mismatch"]
    });
  });

  it("prefers the SHA-bound lifecycle summary over a standalone cleanup report without release identity", async () => {
    const artifactRoot = await createArtifactRoot();
    const lifecycleDirectory = path.join(artifactRoot, "remote-suites", "full-lifecycle-20p");
    await mkdir(lifecycleDirectory, { recursive: true });
    await writeJson(path.join(lifecycleDirectory, "summary.json"), {
      status: "passed",
      buildSha: SHA,
      cleanup: "archived",
      serverInstanceHash: "0123456789abcdef"
    });
    await writeJson(path.join(lifecycleDirectory, "cleanup-report.json"), {
      status: "passed",
      cleanup: "archived"
    });
    const result = await buildPreAlphaEvidenceBundle({
      artifactRoot,
      buildSha: SHA,
      evidencePaths: Object.fromEntries(PRE_ALPHA_EVIDENCE_REPORTS
        .filter(({ key }) => key !== "cleanup")
        .map(({ key }) => [key, null])),
      generatedAt: GENERATED_AT
    });
    const cleanup = JSON.parse(await readFile(path.join(result.outputDirectory, "cleanup-report.json"), "utf8"));

    expect(cleanup).toMatchObject({
      status: "passed",
      buildShaEvidence: "verified",
      source: { reference: "cleanup:1" },
      evidence: { status: "passed", cleanup: "archived", serverInstanceHash: "0123456789abcdef" }
    });
  });

  it("removes credential, PII and raw identifier fields while retaining already hashed identifiers", async () => {
    const raw = {
      status: "passed",
      buildSha: SHA,
      password: "super-secret",
      sessionToken: "token-value",
      cookie: "session=secret",
      authorization: "Bearer hidden",
      databaseUrl: "postgres://user:pass@example.invalid/db",
      email: "person@example.invalid",
      dateOfBirth: "2000-01-01",
      serverInstanceId: "9d2fa335-c004-44ef-a1b2-5081c0bbf531",
      playerIds: ["player-1", "player-2"],
      username: "real-person",
      serverInstanceHash: "0123456789abcdef",
      message: "contact other.person@example.invalid for 9d2fa335-c004-44ef-a1b2-5081c0bbf531"
    };
    const sanitized = sanitizeEvidence(raw);
    expect(sanitized.value).toMatchObject({
      status: "passed",
      buildSha: SHA,
      serverInstanceHash: "0123456789abcdef",
      message: "contact [redacted-email] for [redacted-id]"
    });
    for (const key of [
      "password",
      "sessionToken",
      "cookie",
      "authorization",
      "databaseUrl",
      "email",
      "dateOfBirth",
      "serverInstanceId",
      "playerIds",
      "username"
    ]) expect(sanitized.value).not.toHaveProperty(key);

    const artifactRoot = await createArtifactRoot();
    await writeJson(path.join(artifactRoot, "security-input.json"), raw);
    const result = await buildPreAlphaEvidenceBundle({
      artifactRoot,
      buildSha: SHA,
      evidencePaths: {
        ...Object.fromEntries(PRE_ALPHA_EVIDENCE_REPORTS.map(({ key }) => [key, null])),
        security: "security-input.json"
      },
      generatedAt: GENERATED_AT
    });
    const output = await readFile(path.join(result.outputDirectory, "security-report.json"), "utf8");
    for (const secret of [
      "super-secret",
      "token-value",
      "session=secret",
      "Bearer hidden",
      "postgres://",
      "person@example.invalid",
      "2000-01-01",
      "9d2fa335-c004-44ef-a1b2-5081c0bbf531",
      "player-1",
      "real-person"
    ]) expect(output).not.toContain(secret);
    expect(output).toContain("0123456789abcdef");
  });

  it("writes deterministic SHA-256 checksums for every canonical artifact except the manifest itself", async () => {
    const artifactRoot = await createArtifactRoot();
    const evidencePaths = await passingEvidencePaths(artifactRoot);
    const result = await buildPreAlphaEvidenceBundle({
      artifactRoot,
      buildSha: SHA,
      evidencePaths,
      generatedAt: GENERATED_AT
    });
    const manifest = JSON.parse(await readFile(path.join(result.outputDirectory, "manifest.json"), "utf8"));

    expect(manifest.algorithm).toBe("sha256");
    expect(manifest.manifestIncludedInChecksums).toBe(false);
    expect(manifest.files).toHaveLength(11);
    expect(manifest.files.map(({ file }) => file)).toEqual([...manifest.files.map(({ file }) => file)].sort());
    for (const entry of manifest.files) {
      const contents = await readFile(path.join(result.outputDirectory, entry.file));
      expect(entry.sha256).toBe(createHash("sha256").update(contents).digest("hex"));
      expect(entry.bytes).toBe(contents.byteLength);
    }
    expect(manifest.files.some(({ file }) => file === "manifest.json")).toBe(false);
  });

  it("rejects abbreviated, uppercase and malformed release SHAs", () => {
    expect(normalizeExactBuildSha(SHA)).toBe(SHA);
    for (const invalid of ["a".repeat(7), "A".repeat(40), "g".repeat(40), `${SHA}0`, ""]) {
      expect(() => normalizeExactBuildSha(invalid)).toThrow(/PRE_ALPHA_EVIDENCE_BUILD_SHA_INVALID/u);
    }
  });
});

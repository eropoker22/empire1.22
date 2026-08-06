import { createHash } from "node:crypto";
import { lstat, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const EXACT_SHA_PATTERN = /^[0-9a-f]{40}$/u;
const MAX_EVIDENCE_BYTES = 16 * 1024 * 1024;
const PASS_STATUSES = new Set(["pass", "passed", "staging-passed", "code-passed", "automated-pass", "ready"]);
const FAIL_STATUSES = new Set([
  "fail",
  "failed",
  "not-passed",
  "not-ready",
  "error",
  "timed-out",
  "interrupted",
  "cancelled",
  "canceled"
]);
const BUILD_SHA_KEYS = new Set([
  "sha",
  "buildsha",
  "gitsha",
  "checkoutsha",
  "releasesha",
  "expectedsha",
  "frontendsha",
  "apisha",
  "workersha"
]);

const report = (key, outputFile, label, sources) => Object.freeze({
  key,
  outputFile,
  label,
  sources: Object.freeze(sources.map((source) => Object.freeze({ ...source })))
});

export const PRE_ALPHA_EVIDENCE_REPORTS = Object.freeze([
  report("testResults", "test-results.json", "Testy", [
    { path: "test-results.json" },
    { path: "summary.json" },
    { path: "code-level/summary.json" }
  ]),
  report("lifecycle", "lifecycle-report.json", "Lifecycle", [
    { path: "remote-suites/full-lifecycle-20p/summary.json", select: "fullLifecycle" },
    { path: "remote-suites/full-lifecycle-20p/lifecycle-report.json" },
    { path: "lifecycle-report.json" }
  ]),
  report("concurrency", "concurrency-report.json", "Concurrency", [
    { path: "remote-suites/concurrency-conflicts/concurrency-report.json" },
    { path: "concurrency-report.json" }
  ]),
  report("invariant", "invariant-report.json", "Databazove a domenove invarianty", [
    { path: "remote-suites/full-lifecycle-20p/summary.json", select: "fullLifecycle.invariants" },
    { path: "remote-suites/full-lifecycle-20p/invariant-report.json" },
    { path: "invariant-report.json" }
  ]),
  report("security", "security-report.json", "Security", [
    { path: "security/summary.json" },
    { path: "security-report.json" }
  ]),
  report("balance", "balance-report.json", "Balance", [
    { path: "simulation/balance-report.json" },
    { path: "balance-report.json" }
  ]),
  report("performance", "performance-report.json", "Performance a load", [
    { path: "load-soak/summary.json" },
    { path: "performance-report.json" }
  ]),
  report("releaseHealth", "release-health.json", "Release health", [
    { path: "remote-release-health.json" },
    { path: "release-health.json" }
  ]),
  report("cleanup", "cleanup-report.json", "Cleanup", [
    { path: "remote-suites/full-lifecycle-20p/summary.json", project: "cleanup" },
    { path: "remote-suites/full-lifecycle-20p/cleanup-report.json" },
    { path: "cleanup-report.json" }
  ])
]);

const REQUIRED_OUTPUTS = Object.freeze([
  "summary.json",
  "summary.md",
  ...PRE_ALPHA_EVIDENCE_REPORTS.map(({ outputFile }) => outputFile)
]);

export const normalizeExactBuildSha = (value) => {
  const normalized = String(value ?? "").trim();
  if (!EXACT_SHA_PATTERN.test(normalized)) throw new Error("PRE_ALPHA_EVIDENCE_BUILD_SHA_INVALID");
  return normalized;
};

export const sha256 = (value) => createHash("sha256").update(value).digest("hex");

export const sanitizeEvidence = (input) => {
  const stats = { removedFields: 0, redactedValues: 0 };
  const value = sanitizeValue(input, stats, new WeakSet());
  return Object.freeze({
    value,
    redactions: Object.freeze({
      removedFields: stats.removedFields,
      redactedValues: stats.redactedValues,
      applied: stats.removedFields > 0 || stats.redactedValues > 0
    })
  });
};

export const evaluateEvidenceStatus = ({ reportKey, sourceDocument, evidence, buildSha }) => {
  const exactBuildSha = normalizeExactBuildSha(buildSha);
  const buildShaState = inspectBuildShas(sourceDocument, exactBuildSha);
  const explicitStatus = extractExplicitStatus(evidence);
  const releaseHealthPassed = reportKey === "releaseHealth"
    && isReleaseHealthEvidence(evidence, exactBuildSha);
  const sourcePassed = reportKey === "releaseHealth" ? releaseHealthPassed : explicitStatus === "passed";
  const sourceFailed = explicitStatus === "failed";
  const issues = [];

  if (buildShaState === "missing") issues.push("build-sha-evidence-missing");
  if (buildShaState === "mismatch") issues.push("build-sha-mismatch");
  if (!sourcePassed) issues.push(sourceFailed ? "evidence-explicitly-failed" : "evidence-status-not-passed");

  return Object.freeze({
    status: sourcePassed && buildShaState === "verified" ? "passed" : sourceFailed || buildShaState === "mismatch"
      ? "failed" : "not-passed",
    buildShaEvidence: buildShaState,
    issues: Object.freeze(issues)
  });
};

export const createEvidenceBundleDocuments = ({ buildSha, reports, generatedAt }) => {
  const exactBuildSha = normalizeExactBuildSha(buildSha);
  const timestamp = normalizeTimestamp(generatedAt);
  const reportList = PRE_ALPHA_EVIDENCE_REPORTS.map((definition) => {
    const candidate = reports?.[definition.key];
    if (!candidate || candidate.outputFile !== definition.outputFile) {
      throw new Error(`PRE_ALPHA_EVIDENCE_REPORT_INVALID:${definition.key}`);
    }
    return candidate;
  });
  const passedCount = reportList.filter(({ status }) => status === "passed").length;
  const failedCount = reportList.filter(({ status }) => status === "failed").length;
  const notRunCount = reportList.filter(({ status }) => status === "not-run").length;
  const notPassedCount = reportList.length - passedCount - failedCount - notRunCount;
  const bundleStatus = passedCount === reportList.length ? "passed" : "not-passed";
  const summary = {
    schemaVersion: 1,
    buildSha: exactBuildSha,
    generatedAt: timestamp,
    status: bundleStatus,
    verdict: bundleStatus,
    counts: {
      required: reportList.length,
      passed: passedCount,
      failed: failedCount,
      notPassed: notPassedCount,
      notRun: notRunCount
    },
    reports: reportList.map(({ reportType, outputFile, status, availability, issues }) => ({
      reportType,
      outputFile,
      status,
      availability,
      issues
    }))
  };
  const files = {};
  for (const reportEntry of reportList) files[reportEntry.outputFile] = serializeJson(reportEntry.document);
  files["summary.json"] = serializeJson(summary);
  files["summary.md"] = renderSummaryMarkdown(summary, reportList);
  return Object.freeze({
    status: bundleStatus,
    summary: Object.freeze(summary),
    files: Object.freeze(files)
  });
};

export const createEvidenceManifest = ({ buildSha, status, generatedAt, files }) => {
  const exactBuildSha = normalizeExactBuildSha(buildSha);
  const timestamp = normalizeTimestamp(generatedAt);
  const entries = Object.keys(files).sort().map((file) => {
    const contents = String(files[file]);
    return Object.freeze({
      file,
      sha256: sha256(contents),
      bytes: Buffer.byteLength(contents, "utf8")
    });
  });
  if (entries.some(({ file }) => file === "manifest.json")) {
    throw new Error("PRE_ALPHA_EVIDENCE_MANIFEST_SELF_REFERENCE");
  }
  return Object.freeze({
    schemaVersion: 1,
    buildSha: exactBuildSha,
    generatedAt: timestamp,
    status: status === "passed" ? "passed" : "not-passed",
    algorithm: "sha256",
    manifestIncludedInChecksums: false,
    files: Object.freeze(entries)
  });
};

export const buildPreAlphaEvidenceBundle = async ({
  artifactRoot,
  buildSha,
  outputDirectory,
  evidencePaths = {},
  generatedAt = new Date().toISOString()
}) => {
  const exactBuildSha = normalizeExactBuildSha(buildSha);
  const timestamp = normalizeTimestamp(generatedAt);
  const resolvedArtifactRoot = path.resolve(requiredPath(artifactRoot, "PRE_ALPHA_EVIDENCE_ARTIFACT_ROOT_REQUIRED"));
  const resolvedOutputDirectory = outputDirectory
    ? resolveWithinRoot(resolvedArtifactRoot, outputDirectory, "PRE_ALPHA_EVIDENCE_OUTPUT_PATH_INVALID")
    : path.join(resolvedArtifactRoot, `pre-alpha-hardening-${exactBuildSha.slice(0, 7)}`);
  if (resolvedOutputDirectory === resolvedArtifactRoot) throw new Error("PRE_ALPHA_EVIDENCE_OUTPUT_PATH_INVALID");

  const reports = {};
  const resolvedSources = {};
  for (const definition of PRE_ALPHA_EVIDENCE_REPORTS) {
    const hasOverride = Object.hasOwn(evidencePaths, definition.key)
      || Object.hasOwn(evidencePaths, definition.outputFile);
    const override = Object.hasOwn(evidencePaths, definition.key)
      ? evidencePaths[definition.key]
      : evidencePaths[definition.outputFile];
    const sources = hasOverride ? normalizeSourceOverrides(override) : definition.sources;
    const loaded = await loadReport({
      definition,
      sources,
      artifactRoot: resolvedArtifactRoot,
      buildSha: exactBuildSha,
      generatedAt: timestamp
    });
    reports[definition.key] = loaded.report;
    resolvedSources[definition.key] = loaded.sourcePath;
  }

  const documents = createEvidenceBundleDocuments({
    buildSha: exactBuildSha,
    reports,
    generatedAt: timestamp
  });
  const manifest = createEvidenceManifest({
    buildSha: exactBuildSha,
    status: documents.status,
    generatedAt: timestamp,
    files: documents.files
  });
  await mkdir(resolvedOutputDirectory, { recursive: true });
  for (const file of REQUIRED_OUTPUTS) {
    await writeFile(path.join(resolvedOutputDirectory, file), documents.files[file], "utf8");
  }
  await writeFile(path.join(resolvedOutputDirectory, "manifest.json"), serializeJson(manifest), "utf8");

  return Object.freeze({
    status: documents.status,
    buildSha: exactBuildSha,
    outputDirectory: resolvedOutputDirectory,
    summary: documents.summary,
    manifest,
    sources: Object.freeze(resolvedSources)
  });
};

const loadReport = async ({ definition, sources, artifactRoot, buildSha, generatedAt }) => {
  for (let index = 0; index < sources.length; index += 1) {
    const source = normalizeSourceDescriptor(sources[index]);
    const sourcePath = resolveWithinRoot(artifactRoot, source.path, "PRE_ALPHA_EVIDENCE_SOURCE_PATH_INVALID");
    let sourceStat;
    try {
      sourceStat = await lstat(sourcePath);
    } catch (error) {
      if (error?.code === "ENOENT") continue;
      return invalidReport(definition, buildSha, generatedAt, "source-unreadable", sourcePath);
    }
    if (sourceStat.isSymbolicLink() || !sourceStat.isFile()) {
      return invalidReport(definition, buildSha, generatedAt, "source-not-regular-file", sourcePath);
    }
    if (sourceStat.size > MAX_EVIDENCE_BYTES) {
      return invalidReport(definition, buildSha, generatedAt, "source-too-large", sourcePath);
    }
    let document;
    try {
      document = JSON.parse(await readFile(sourcePath, "utf8"));
    } catch {
      return invalidReport(definition, buildSha, generatedAt, "source-json-invalid", sourcePath);
    }
    let selected;
    try {
      selected = projectEvidence(document, source);
    } catch {
      return invalidReport(definition, buildSha, generatedAt, "source-selection-invalid", sourcePath);
    }
    const evaluation = evaluateEvidenceStatus({
      reportKey: definition.key,
      sourceDocument: document,
      evidence: selected,
      buildSha
    });
    const sanitized = sanitizeEvidence(selected);
    const sanitizedJson = serializeJson(sanitized.value);
    const envelope = {
      schemaVersion: 1,
      reportType: definition.key,
      buildSha,
      generatedAt,
      status: evaluation.status,
      availability: "present",
      buildShaEvidence: evaluation.buildShaEvidence,
      issues: evaluation.issues,
      source: {
        reference: `${definition.key}:${index + 1}`,
        sanitizedEvidenceSha256: sha256(sanitizedJson),
        redactions: sanitized.redactions
      },
      evidence: sanitized.value
    };
    return {
      sourcePath,
      report: Object.freeze({
        reportType: definition.key,
        outputFile: definition.outputFile,
        status: evaluation.status,
        availability: "present",
        issues: evaluation.issues,
        document: Object.freeze(envelope)
      })
    };
  }

  const missing = {
    schemaVersion: 1,
    reportType: definition.key,
    buildSha,
    generatedAt,
    status: "not-run",
    availability: "missing",
    issues: ["evidence-missing"],
    expectedSourceCount: sources.length,
    evidence: null
  };
  return {
    sourcePath: null,
    report: Object.freeze({
      reportType: definition.key,
      outputFile: definition.outputFile,
      status: "not-run",
      availability: "missing",
      issues: Object.freeze(["evidence-missing"]),
      document: Object.freeze(missing)
    })
  };
};

const invalidReport = (definition, buildSha, generatedAt, issue, sourcePath) => ({
  sourcePath,
  report: Object.freeze({
    reportType: definition.key,
    outputFile: definition.outputFile,
    status: "failed",
    availability: "invalid",
    issues: Object.freeze([issue]),
    document: Object.freeze({
      schemaVersion: 1,
      reportType: definition.key,
      buildSha,
      generatedAt,
      status: "failed",
      availability: "invalid",
      issues: [issue],
      evidence: null
    })
  })
});

const normalizeSourceOverrides = (override) => {
  if (override === null || override === undefined) return Object.freeze([]);
  const values = Array.isArray(override) ? override : [override];
  return Object.freeze(values.map(normalizeSourceDescriptor));
};

const normalizeSourceDescriptor = (source) => {
  if (typeof source === "string") return Object.freeze({ path: source });
  if (!source || typeof source !== "object" || typeof source.path !== "string") {
    throw new Error("PRE_ALPHA_EVIDENCE_SOURCE_DESCRIPTOR_INVALID");
  }
  if (source.select !== undefined && typeof source.select !== "string") {
    throw new Error("PRE_ALPHA_EVIDENCE_SOURCE_DESCRIPTOR_INVALID");
  }
  if (source.project !== undefined && source.project !== "cleanup") {
    throw new Error("PRE_ALPHA_EVIDENCE_SOURCE_DESCRIPTOR_INVALID");
  }
  return Object.freeze({
    path: source.path,
    ...(source.select ? { select: source.select } : {}),
    ...(source.project ? { project: source.project } : {})
  });
};

const projectEvidence = (document, source) => {
  if (source.project === "cleanup") {
    const cleanup = String(document?.cleanup ?? "not-run");
    return {
      status: ["archived", "archived-by-visible-admin-flow"].includes(cleanup) ? "passed"
        : cleanup === "failed" ? "failed" : "not-run",
      cleanup,
      errorCode: document?.cleanupErrorCode ?? null,
      serverInstanceHash: document?.serverInstanceHash ?? null
    };
  }
  if (!source.select) return document;
  let selected = document;
  for (const segment of source.select.split(".")) {
    if (!segment || !selected || typeof selected !== "object" || !Object.hasOwn(selected, segment)) {
      throw new Error("PRE_ALPHA_EVIDENCE_SOURCE_SELECTION_INVALID");
    }
    selected = selected[segment];
  }
  if (!selected || typeof selected !== "object") throw new Error("PRE_ALPHA_EVIDENCE_SOURCE_SELECTION_INVALID");
  return selected;
};

const extractExplicitStatus = (evidence) => {
  if (!evidence || typeof evidence !== "object") return "unknown";
  if (evidence.passed === true) return "passed";
  if (evidence.passed === false) return "failed";
  for (const candidate of [evidence.status, evidence.verdict]) {
    const normalized = String(candidate ?? "").trim().toLowerCase();
    if (PASS_STATUSES.has(normalized)) return "passed";
    if (FAIL_STATUSES.has(normalized)) return "failed";
  }
  return "unknown";
};

const inspectBuildShas = (document, expectedSha) => {
  const discovered = [];
  collectBuildShas(document, discovered, new WeakSet());
  if (discovered.length === 0) return "missing";
  return discovered.every((value) => value === expectedSha) ? "verified" : "mismatch";
};

const collectBuildShas = (value, output, seen) => {
  if (!value || typeof value !== "object") return;
  if (seen.has(value)) return;
  seen.add(value);
  if (Array.isArray(value)) {
    for (const item of value) collectBuildShas(item, output, seen);
    return;
  }
  for (const [key, child] of Object.entries(value)) {
    if (BUILD_SHA_KEYS.has(key.replace(/[^a-z]/giu, "").toLowerCase())
      && typeof child === "string" && EXACT_SHA_PATTERN.test(child)) {
      output.push(child);
    }
    collectBuildShas(child, output, seen);
  }
};

const isReleaseHealthEvidence = (evidence, buildSha) => Boolean(
  evidence
  && evidence.environment === "staging"
  && evidence.frontendSha === buildSha
  && evidence.apiSha === buildSha
  && evidence.workerSha === buildSha
  && /^\d{3}_[a-z0-9_]+\.sql$/u.test(String(evidence.schemaVersion ?? ""))
  && Array.isArray(evidence.assets)
  && evidence.assets.length > 0
);

const sanitizeValue = (value, stats, seen) => {
  if (typeof value === "string") return sanitizeString(value, stats);
  if (value === null || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (Number.isFinite(value)) return value;
    stats.redactedValues += 1;
    return null;
  }
  if (typeof value !== "object") {
    stats.redactedValues += 1;
    return null;
  }
  if (seen.has(value)) {
    stats.redactedValues += 1;
    return "[redacted-cycle]";
  }
  seen.add(value);
  if (Array.isArray(value)) {
    const sanitized = value.map((entry) => sanitizeValue(entry, stats, seen));
    seen.delete(value);
    return sanitized;
  }
  const sanitized = {};
  for (const [key, child] of Object.entries(value)) {
    if (isSensitiveKey(key) || isRawIdentifierKey(key) || isImplicitRawIdentifierValue(key, child)) {
      stats.removedFields += 1;
      continue;
    }
    sanitized[key] = sanitizeValue(child, stats, seen);
  }
  seen.delete(value);
  return sanitized;
};

const isSensitiveKey = (key) => {
  const normalized = String(key).replace(/[^a-z0-9]/giu, "").toLowerCase();
  return /(?:password|passwd|passphrase|secret|token|cookie|authorization|authheader|credential|apikey|privatekey|accesskey)/u
    .test(normalized)
    || /(?:databaseurl|dburl|connectionstring|databaseconnection)/u.test(normalized)
    || /(?:email|dateofbirth|birthdate|dob|dsn)/u.test(normalized)
    || /^(?:username|nickname|nick|gangname|alliancename|displayname|networkidentifier|ipaddress|identities|identity)$/u
      .test(normalized)
    || normalized.startsWith("idempotency");
};

const isRawIdentifierKey = (key) => {
  const original = String(key);
  const normalized = original.replace(/[^a-z0-9]/giu, "").toLowerCase();
  if (/(?:hash|hashed|checksum|sha)$/u.test(normalized) || normalized.includes("hash")) return false;
  return normalized === "id" || normalized === "ids" || /(?:Id|ID|Ids|IDs)$/u.test(original)
    || /(?:^|[_-])ids?$/iu.test(original) || /identifiers?$/u.test(normalized);
};

const isImplicitRawIdentifierValue = (key, value) => {
  const normalized = String(key).replace(/[^a-z0-9]/giu, "").toLowerCase();
  if (!/^(?:account|accounts|player|players|server|servers|district|districts|owner|owners|winner|loser|session|sessions|membership|memberships)$/u
    .test(normalized)) return false;
  if (typeof value === "string" || typeof value === "number") return true;
  return Array.isArray(value) && value.every((entry) => typeof entry === "string" || typeof entry === "number");
};

const sanitizeString = (value, stats) => {
  if (/^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/u.test(value)) {
    stats.redactedValues += 1;
    return "[redacted]";
  }
  let sanitized = value.replace(/(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis):\/\/[^\s,;]+/giu, () => {
    stats.redactedValues += 1;
    return "[redacted]";
  });
  sanitized = sanitized.replace(/(?:bearer|flyv1)\s+[A-Za-z0-9._~+/=-]+/giu, () => {
    stats.redactedValues += 1;
    return "[redacted]";
  });
  sanitized = sanitized.replace(/\b(?:password|passwd|token|cookie|authorization|database_?url|email|dob)\s*[:=]\s*[^\s,;]+/giu, () => {
    stats.redactedValues += 1;
    return "[redacted]";
  });
  sanitized = sanitized.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/giu, () => {
    stats.redactedValues += 1;
    return "[redacted-email]";
  });
  sanitized = sanitized.replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/giu, () => {
    stats.redactedValues += 1;
    return "[redacted-id]";
  });
  return sanitized;
};

const renderSummaryMarkdown = (summary, reportList) => {
  const lines = [
    "# Pre-alpha release evidence",
    "",
    `- Build SHA: \`${summary.buildSha}\``,
    `- Vygenerovano: ${summary.generatedAt}`,
    `- Verdikt: **${summary.status}**`,
    "",
    "| Oblast | Soubor | Stav | Dostupnost |",
    "| --- | --- | --- | --- |"
  ];
  for (const reportEntry of reportList) {
    const definition = PRE_ALPHA_EVIDENCE_REPORTS.find(({ key }) => key === reportEntry.reportType);
    lines.push(`| ${definition.label} | \`${reportEntry.outputFile}\` | ${reportEntry.status} | ${reportEntry.availability} |`);
  }
  if (summary.status !== "passed") {
    lines.push("", "Bundle neni release PASS: alespon jeden povinny dukaz chybi, nebyl spusten nebo neprosel.");
  }
  return `${lines.join("\n")}\n`;
};

const resolveWithinRoot = (root, candidate, errorCode) => {
  const value = requiredPath(candidate, errorCode);
  const resolved = path.isAbsolute(value) ? path.resolve(value) : path.resolve(root, value);
  const relative = path.relative(root, resolved);
  if (relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative))) return resolved;
  throw new Error(errorCode);
};

const requiredPath = (value, errorCode) => {
  const normalized = String(value ?? "").trim();
  if (!normalized || normalized.includes("\0")) throw new Error(errorCode);
  return normalized;
};

const normalizeTimestamp = (value) => {
  const normalized = String(value ?? "").trim();
  const parsed = Date.parse(normalized);
  if (!normalized || !Number.isFinite(parsed)) throw new Error("PRE_ALPHA_EVIDENCE_TIMESTAMP_INVALID");
  return new Date(parsed).toISOString();
};

const serializeJson = (value) => `${JSON.stringify(value, null, 2)}\n`;

const parseCliArguments = (argv) => {
  const values = {};
  for (const argument of argv) {
    const match = /^--([a-z0-9-]+)=(.+)$/u.exec(argument);
    if (!match) throw new Error("PRE_ALPHA_EVIDENCE_ARGUMENT_INVALID");
    if (Object.hasOwn(values, match[1])) throw new Error("PRE_ALPHA_EVIDENCE_ARGUMENT_DUPLICATE");
    values[match[1]] = match[2];
  }
  const evidencePaths = {};
  for (const definition of PRE_ALPHA_EVIDENCE_REPORTS) {
    const flag = `${definition.outputFile.replace(/\.json$/u, "")}-path`;
    if (values[flag]) evidencePaths[definition.key] = values[flag];
  }
  return {
    artifactRoot: values["artifact-root"],
    buildSha: values["build-sha"],
    outputDirectory: values["output-dir"],
    evidencePaths
  };
};

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) {
  try {
    const result = await buildPreAlphaEvidenceBundle(parseCliArguments(process.argv.slice(2)));
    console.log(`[pre-alpha-evidence] status=${result.status} sha=${result.buildSha}`);
    if (result.status !== "passed") process.exitCode = 1;
  } catch (error) {
    console.error(`[pre-alpha-evidence] failed=${String(error?.message ?? error).split(":", 1)[0]}`);
    process.exitCode = 1;
  }
}

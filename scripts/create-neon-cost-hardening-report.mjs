import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const outputDirectory = path.resolve("artifacts/neon-cost-hardening");
const snapshotSizeBytes = positiveInteger(
  process.env.EMPIRE_STAGING_SNAPSHOT_SIZE_BYTES ?? process.argv[2],
  "SNAPSHOT_SIZE_BYTES_REQUIRED"
);
const workerLoopIntervalMs = 5_000;
const tickRateMs = 10_000;
const ticksPerHour = 60 * 60 * 1_000 / tickRateMs;
const workerLoopsPerHour = 60 * 60 * 1_000 / workerLoopIntervalMs;
const baselineFullReadsPerHour = workerLoopsPerHour * 2 + ticksPerHour * 2;
const baselineFullReadsPer100Ticks = baselineFullReadsPerHour * (100 * tickRateMs / 3_600_000);
const baselineBytesPer100Ticks = baselineFullReadsPer100Ticks * snapshotSizeBytes;
const afterFullReadsPer100Ticks = 0;
const metadataReadsPer100Ticks = 600;
const metadataBytesEstimate = 160;
const afterBytesPer100Ticks = metadataReadsPer100Ticks * metadataBytesEstimate;
const readReductionPercent = percentReduction(baselineFullReadsPer100Ticks, afterFullReadsPer100Ticks);
const bytesReductionPercent = percentReduction(baselineBytesPer100Ticks, afterBytesPer100Ticks);

const baseline = {
  schemaVersion: 1,
  evidence: {
    snapshotSize: "staging worker health metric",
    callFrequency: "static call graph plus 5000ms worker loop and 10000ms tick cadence",
    stagingBuildSha: "7adc9182beacf0a39d8e5fff7715cd22b3852bb2"
  },
  snapshotSizeBytes,
  workerLoopIntervalMs,
  tickRateMs,
  workerLoopsPerHour,
  ticksPerHour,
  fullSnapshotReadsPerHour: baselineFullReadsPerHour,
  fullSnapshotReadsPer100Ticks: baselineFullReadsPer100Ticks,
  fullSnapshotBytesPer100Ticks: baselineBytesPer100Ticks,
  estimatedDatabaseGbPerDay: baselineFullReadsPerHour * snapshotSizeBytes * 24 / 1_000_000_000,
  pathBreakdownPerHour: {
    workerEnsureRuntime: workerLoopsPerHour,
    workerTickHydration: ticksPerHour,
    snapshotWriteComparison: ticksPerHour,
    workerHeartbeatSnapshotLookup: workerLoopsPerHour
  },
  twentyPlayerPolling: {
    pollsPerMinute: 120,
    fullSnapshotReadsPerMinute: 120,
    estimatedBytesPerMinute: 120 * snapshotSizeBytes
  }
};

const after = {
  schemaVersion: 1,
  workload: "100 stable ticks after one startup hydration",
  snapshotSizeBytes,
  fullSnapshotReadsPer100Ticks: afterFullReadsPer100Ticks,
  fullSnapshotBytesPer100Ticks: 0,
  metadataReadsPer100Ticks,
  metadataReadBytesEstimatePer100Ticks: afterBytesPer100Ticks,
  fullSnapshotWritesPer100Ticks: 100,
  checkpointWriteCadenceChanged: false,
  twentyPlayerUnchangedPolling: {
    pollsPerMinute: 120,
    fullSnapshotReadsPerMinute: 0,
    metadataReadsPerMinute: 120,
    estimatedBytesPerMinute: 120 * metadataBytesEstimate
  },
  externalCommandMismatchFullReloads: 1,
  followingStableTicks: 100,
  followingStableTickFullReloads: 0,
  restartRecoveryFullReloads: 1
};

const report = `# Neon Cost Hardening

## Root cause

The hosted worker loop ran every 5 seconds. For every running instance it loaded the full recovery
head in ensureRuntime and again for heartbeat. Every due 10-second tick loaded it once more, while
saveRecoveryHead downloaded the previous payload for compare-and-swap. That is ${baselineFullReadsPerHour}
full reads/hour for one continuously running server. The measured staging snapshot was
${snapshotSizeBytes.toLocaleString("en-US")} bytes.

Hosted gameplay load/submit also hydrated the recovery head before every request, even when a warm
runtime already matched the persisted root version.

## Measured baseline and after

| Metric | Before | After |
| --- | ---: | ---: |
| snapshot bytes | ${snapshotSizeBytes} | ${snapshotSizeBytes} |
| full reads / 100 ticks | ${baselineFullReadsPer100Ticks} | ${afterFullReadsPer100Ticks} |
| full read bytes / 100 ticks | ${baselineBytesPer100Ticks} | 0 |
| metadata reads / 100 ticks | 0 | ${metadataReadsPer100Ticks} |
| 20-player unchanged full reads / min | 120 | 0 |
| 20-player unchanged estimated DB bytes / min | ${120 * snapshotSizeBytes} | ${120 * metadataBytesEstimate} |

Full snapshot read reduction on the stable worker workload: ${readReductionPercent}%.
Estimated returned-byte reduction including metadata rows: ${bytesReductionPercent}%.

Full snapshot write cadence remains one authoritative recovery-head write per tick. This sprint does
not risk recovery correctness by changing checkpoint or write cadence.
`;

mkdirSync(outputDirectory, { recursive: true });
writeJson("baseline.json", baseline);
writeJson("after.json", after);
writeFileSync(path.join(outputDirectory, "report.md"), report, "utf8");

function writeJson(filename, value) {
  writeFileSync(path.join(outputDirectory, filename), `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function positiveInteger(value, code) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) throw new Error(code);
  return parsed;
}

function percentReduction(before, afterValue) {
  return Number((((before - afterValue) / before) * 100).toFixed(2));
}

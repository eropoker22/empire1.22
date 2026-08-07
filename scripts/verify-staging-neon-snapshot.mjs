import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { verifyStagingNeonSnapshotBinding } from "./staging-neon-target-contract.mjs";

const readJson = (filePath, code) => {
  if (!filePath) throw new Error(code);
  try {
    return JSON.parse(readFileSync(filePath, "utf8"));
  } catch {
    throw new Error(code);
  }
};

try {
  const snapshotResponse = readJson(
    process.env.EMPIRE_STAGING_NEON_SNAPSHOT_RESPONSE_PATH,
    "STAGING_NEON_SNAPSHOT_RESPONSE_INVALID"
  );
  const targetBinding = readJson(
    process.env.EMPIRE_STAGING_NEON_BINDING_EVIDENCE_PATH,
    "STAGING_NEON_TARGET_BINDING_EVIDENCE_INVALID"
  );
  const evidencePath = String(process.env.EMPIRE_STAGING_NEON_BACKUP_EVIDENCE_PATH ?? "").trim();
  if (!evidencePath) throw new Error("STAGING_NEON_BACKUP_EVIDENCE_PATH_MISSING");
  const evidence = verifyStagingNeonSnapshotBinding({
    environment: process.env,
    snapshotResponse,
    targetBinding
  });
  mkdirSync(path.dirname(evidencePath), { recursive: true });
  writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
} catch (error) {
  const code = error instanceof Error && /^[A-Z0-9_]+$/u.test(error.message)
    ? error.message
    : "STAGING_NEON_SNAPSHOT_VERIFICATION_FAILED";
  process.stderr.write(`${code}\n`);
  process.exitCode = 1;
}

import type { ServerInstanceId } from "@empire/shared-types";
import type { InstanceSnapshotDto } from "../dto";

export type SnapshotIntegrityFailureCode =
  | "SNAPSHOT_PAYLOAD_INVALID"
  | "SNAPSHOT_INSTANCE_MISMATCH"
  | "SNAPSHOT_VERSION_METADATA_INVALID"
  | "SNAPSHOT_ROOT_VERSION_INVALID"
  | "SNAPSHOT_TICK_INVALID"
  | "SNAPSHOT_ENTITY_COUNTS_MISMATCH";

export interface SnapshotIntegrityValidation {
  valid: boolean;
  failureCode: SnapshotIntegrityFailureCode | null;
}

export class SnapshotRecoveryIntegrityError extends Error {
  readonly safeCode: SnapshotIntegrityFailureCode;

  constructor(code: SnapshotIntegrityFailureCode) {
    super(`Snapshot recovery integrity validation failed: ${code}.`);
    this.name = "SnapshotRecoveryIntegrityError";
    this.safeCode = code;
  }
}

export const validateSnapshotIntegrity = (
  snapshot: InstanceSnapshotDto,
  instanceId: ServerInstanceId
): SnapshotIntegrityValidation => {
  if (!snapshot || typeof snapshot !== "object" || !snapshot.state || !snapshot.integrity || !snapshot.version) {
    return invalid("SNAPSHOT_PAYLOAD_INVALID");
  }
  if (
    snapshot.instanceId !== instanceId ||
    snapshot.state.root.serverInstanceId !== instanceId ||
    snapshot.state.serverInstance.id !== instanceId
  ) {
    return invalid("SNAPSHOT_INSTANCE_MISMATCH");
  }
  if (
    !Number.isInteger(snapshot.version.schemaVersion) ||
    snapshot.version.schemaVersion < 1 ||
    !String(snapshot.version.coreVersion ?? "").trim() ||
    !String(snapshot.version.configVersion ?? "").trim()
  ) {
    return invalid("SNAPSHOT_VERSION_METADATA_INVALID");
  }
  if (
    !Number.isSafeInteger(snapshot.integrity.rootVersion) ||
    snapshot.integrity.rootVersion < 0 ||
    snapshot.integrity.rootVersion !== snapshot.state.root.version
  ) {
    return invalid("SNAPSHOT_ROOT_VERSION_INVALID");
  }
  if (
    !Number.isSafeInteger(snapshot.tick) ||
    snapshot.tick < 0 ||
    snapshot.tick !== snapshot.state.root.tick
  ) {
    return invalid("SNAPSHOT_TICK_INVALID");
  }
  const expectedCounts = {
    players: Object.keys(snapshot.state.playersById).length,
    alliances: Object.keys(snapshot.state.alliancesById).length,
    districts: Object.keys(snapshot.state.districtsById).length,
    buildings: Object.keys(snapshot.state.buildingsById).length
  };
  if (Object.entries(expectedCounts).some(([key, value]) => snapshot.integrity.entityCounts[key] !== value)) {
    return invalid("SNAPSHOT_ENTITY_COUNTS_MISMATCH");
  }
  return { valid: true, failureCode: null };
};

export const assertSnapshotIntegrity = (
  snapshot: InstanceSnapshotDto,
  instanceId: ServerInstanceId
): void => {
  const validation = validateSnapshotIntegrity(snapshot, instanceId);
  if (!validation.valid) throw new SnapshotRecoveryIntegrityError(validation.failureCode!);
};

const invalid = (failureCode: SnapshotIntegrityFailureCode): SnapshotIntegrityValidation => ({
  valid: false,
  failureCode
});

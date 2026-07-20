import type { InstanceSnapshotDto } from "../dto";

export type SnapshotWriteDecision = "replace" | "idempotent";

export const classifySnapshotWrite = (
  latest: InstanceSnapshotDto | null,
  incoming: InstanceSnapshotDto
): SnapshotWriteDecision => {
  if (!latest || latest.integrity.rootVersion < incoming.integrity.rootVersion) {
    return "replace";
  }

  if (latest.integrity.rootVersion > incoming.integrity.rootVersion) {
    throw new Error(
      `Refusing to overwrite snapshot ${latest.snapshotId} rootVersion ${latest.integrity.rootVersion} with stale rootVersion ${incoming.integrity.rootVersion}.`
    );
  }

  if (canonicalSnapshotPayload(latest) === canonicalSnapshotPayload(incoming)) {
    return "idempotent";
  }

  throw new Error(
    `Refusing divergent snapshot ${incoming.snapshotId} rootVersion ${incoming.integrity.rootVersion}; latest snapshot ${latest.snapshotId} has the same rootVersion with a different payload.`
  );
};

const canonicalSnapshotPayload = (snapshot: InstanceSnapshotDto): string => {
  const { createdAt: _createdAt, ...stableSnapshot } = snapshot;
  return JSON.stringify(sortJsonValue(stableSnapshot));
};

const sortJsonValue = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(sortJsonValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, entry]) => [key, sortJsonValue(entry)]));
};

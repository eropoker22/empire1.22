import type { ServerInstanceId } from "@empire/shared-types";
import type { InstanceSnapshotDto } from "../dto";
import type { SnapshotPersistenceMetrics } from "./snapshot-repository";

export interface SnapshotInstanceIoMetrics {
  fullSnapshotReads: number;
  fullSnapshotReadBytes: number;
  fullSnapshotWrites: number;
  fullSnapshotWriteBytes: number;
  metadataOnlyReads: number;
  metadataOnlyReadBytesEstimate: number;
  recoveryHeadLoads: number;
  recoveryHeadSaves: number;
  checkpointWrites: number;
}

const instanceIoMetrics = new WeakMap<SnapshotPersistenceMetrics, Map<string, SnapshotInstanceIoMetrics>>();

export const createSnapshotInstanceIoMetrics = (): SnapshotInstanceIoMetrics => ({
  fullSnapshotReads: 0,
  fullSnapshotReadBytes: 0,
  fullSnapshotWrites: 0,
  fullSnapshotWriteBytes: 0,
  metadataOnlyReads: 0,
  metadataOnlyReadBytesEstimate: 0,
  recoveryHeadLoads: 0,
  recoveryHeadSaves: 0,
  checkpointWrites: 0
});

const mutableInstanceIoMetrics = (
  metrics: SnapshotPersistenceMetrics,
  instanceId: ServerInstanceId
): SnapshotInstanceIoMetrics => {
  let byInstance = instanceIoMetrics.get(metrics);
  if (!byInstance) {
    byInstance = new Map();
    instanceIoMetrics.set(metrics, byInstance);
  }
  let value = byInstance.get(instanceId);
  if (!value) {
    value = createSnapshotInstanceIoMetrics();
    byInstance.set(instanceId, value);
  }
  return value;
};

export const readSnapshotInstanceIoMetrics = (
  metrics: SnapshotPersistenceMetrics,
  instanceId: ServerInstanceId
): Readonly<SnapshotInstanceIoMetrics> => ({ ...mutableInstanceIoMetrics(metrics, instanceId) });

export const recordFullSnapshotRead = (
  metrics: SnapshotPersistenceMetrics,
  instanceId: ServerInstanceId,
  bytes: number
): void => {
  const instance = mutableInstanceIoMetrics(metrics, instanceId);
  metrics.fullSnapshotReads += 1;
  metrics.fullSnapshotReadBytes += bytes;
  metrics.recoveryHeadLoads += 1;
  instance.fullSnapshotReads += 1;
  instance.fullSnapshotReadBytes += bytes;
  instance.recoveryHeadLoads += 1;
};

export const recordMetadataOnlyRead = (
  metrics: SnapshotPersistenceMetrics,
  instanceId: ServerInstanceId,
  bytesEstimate: number
): void => {
  const instance = mutableInstanceIoMetrics(metrics, instanceId);
  metrics.metadataOnlyReads += 1;
  metrics.metadataOnlyReadBytesEstimate += bytesEstimate;
  instance.metadataOnlyReads += 1;
  instance.metadataOnlyReadBytesEstimate += bytesEstimate;
};

export const recordFullSnapshotWrite = (
  metrics: SnapshotPersistenceMetrics,
  instanceId: ServerInstanceId,
  bytes: number
): void => {
  const instance = mutableInstanceIoMetrics(metrics, instanceId);
  metrics.fullSnapshotWrites += 1;
  metrics.fullSnapshotWriteBytes += bytes;
  metrics.recoveryHeadSaves += 1;
  instance.fullSnapshotWrites += 1;
  instance.fullSnapshotWriteBytes += bytes;
  instance.recoveryHeadSaves += 1;
};

export const recordCheckpointWrite = (
  metrics: SnapshotPersistenceMetrics,
  instanceId: ServerInstanceId
): void => {
  const instance = mutableInstanceIoMetrics(metrics, instanceId);
  metrics.checkpointWrites += 1;
  instance.checkpointWrites += 1;
};

export const serializedJsonBytes = (value: unknown): number =>
  new TextEncoder().encode(JSON.stringify(value)).byteLength;

export const snapshotFieldBytes = (snapshot: InstanceSnapshotDto): Record<string, number> =>
  Object.fromEntries(Object.entries(snapshot.state)
    .map(([field, value]) => [field, serializedJsonBytes(value)])
    .sort((left, right) => Number(right[1]) - Number(left[1])));

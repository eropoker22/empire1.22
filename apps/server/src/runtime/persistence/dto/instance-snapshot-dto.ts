import type { CoreGameState } from "@empire/game-core";
import type { ServerInstanceId } from "@empire/shared-types";
import type { InstanceMetadataRecord } from "./instance-metadata-record";
import type { VersionMetadata } from "./version-metadata";

/**
 * Responsibility: Persistent snapshot payload for one authoritative server instance.
 * Belongs here: metadata, normalized game state, and integrity-safe snapshot fields.
 * Does not belong here: runtime-only timers, queues, sockets, or ephemeral caches.
 */
export interface InstanceSnapshotDto {
  snapshotId: string;
  instanceId: ServerInstanceId;
  createdAt: string;
  tick: number;
  mode: string;
  metadata: InstanceMetadataRecord;
  version: VersionMetadata;
  integrity: SnapshotIntegrityDto;
  state: CoreGameState;
}

export interface SnapshotIntegrityDto {
  entityCounts: Record<string, number>;
  rootVersion: number;
}


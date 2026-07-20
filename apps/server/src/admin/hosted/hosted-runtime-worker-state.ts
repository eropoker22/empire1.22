import * as crypto from "node:crypto";
import type { AdminAuditEntryView } from "@empire/shared-types";
import type { ServerApp } from "../../app/server-app";
import type { ServerInstanceRuntime } from "../../runtime/instance";
import type { InstanceSnapshotDto } from "../../runtime/persistence/dto";
import type { HostedControlPlaneRepository, HostedServerRecord } from "./hosted-control-plane-repository";

type InstanceHeartbeatWriter = (input: Omit<
  Parameters<HostedControlPlaneRepository["writeInstanceHeartbeat"]>[0],
  "workerId" | "workerIncarnationId"
>) => Promise<void>;

export const createHostedWorkerAudit = (workerId: string) => (
  action: "provisioning-success" | "provisioning-failure" | "lifecycle-success" | "lifecycle-failure",
  target: string,
  at: string,
  result: AdminAuditEntryView["result"] = "success"
): AdminAuditEntryView => ({
  id: `admin-audit:${crypto.randomUUID()}`, adminSessionId: null, actorId: workerId, role: null,
  action, targetInstanceId: target, result, createdAt: at, correlationId: `hosted-worker:${crypto.randomUUID()}`
});

export const isSnapshotForHostedRecord = (
  snapshot: InstanceSnapshotDto,
  record: HostedServerRecord
): boolean => snapshot.instanceId === record.serverInstanceId && snapshot.mode === record.mode &&
  snapshot.state.root.serverInstanceId === record.serverInstanceId &&
  snapshot.state.serverInstance.id === record.serverInstanceId &&
  snapshot.state.serverInstance.worldSeed === record.worldSeed;

export const syncHostedRuntimeStatus = (
  runtime: ServerInstanceRuntime,
  record: HostedServerRecord
): void => {
  runtime.lobby.joinPolicy = record.joinPolicy === "open" ? "open" : "closed";
  if (record.status === "running") {
    runtime.record.status = "running";
    runtime.scheduler.isRunning = runtime.state.root.phase !== "resolved";
  } else if (record.status === "paused") {
    runtime.record.status = "paused";
    runtime.scheduler.isRunning = false;
  } else {
    runtime.record.status = record.status === "stopped" || record.status === "lobby" ? record.status : "lobby";
    runtime.scheduler.isRunning = false;
  }
};

export const createHostedInstanceFailureReporter = (options: {
  writeInstanceHeartbeat: InstanceHeartbeatWriter;
  instanceManager: ServerApp["instanceManager"];
  now: () => Date;
}) => async (
  record: HostedServerRecord,
  leaseExpiresAt: string,
  lastErrorCode: string
): Promise<void> => {
  const at = options.now().toISOString();
  const runtime = options.instanceManager.getInstanceById(record.serverInstanceId);
  const snapshot = await options.instanceManager.getPersistenceRepositories().snapshotRepository
    .loadLatest(record.serverInstanceId).catch(() => null);
  await options.writeInstanceHeartbeat({
    serverInstanceId: record.serverInstanceId,
    leaseExpiresAt,
    lastTick: runtime?.state.root.tick ?? snapshot?.tick ?? 0,
    lastSnapshotAt: snapshot?.createdAt ?? null,
    lastErrorCode,
    at
  });
};

export const applyHostedEarlyLeaveCleanup = (
  runtime: ServerInstanceRuntime,
  playerId: string
): boolean => {
  const player = runtime.state.playersById[playerId];
  if (!player || player.status === "left") return false;
  runtime.state.playersById[playerId] = { ...player, status: "left", allianceId: null, version: player.version + 1 };
  for (const districtId of runtime.state.root.districtIds) {
    const district = runtime.state.districtsById[districtId];
    if (!district || district.ownerPlayerId !== playerId) continue;
    runtime.state.districtsById[districtId] = { ...district, ownerPlayerId: null, status: "neutral", version: district.version + 1 };
    for (const buildingId of district.buildingIds) {
      const building = runtime.state.buildingsById[buildingId];
      if (building?.ownerPlayerId === playerId) runtime.state.buildingsById[buildingId] = {
        ...building,
        ownerPlayerId: "player:neutral",
        status: building.status === "destroyed" ? "destroyed" : "disabled",
        metadata: { ...(building.metadata ?? {}), releasedByEarlyLeavePlayerId: playerId },
        version: building.version + 1
      };
    }
  }
  for (const allianceId of runtime.state.root.allianceIds) {
    const alliance = runtime.state.alliancesById[allianceId];
    if (!alliance || !alliance.memberIds.includes(playerId)) continue;
    const membershipByPlayerId = { ...(alliance.membershipByPlayerId ?? {}) };
    delete membershipByPlayerId[playerId];
    runtime.state.alliancesById[allianceId] = {
      ...alliance,
      memberIds: alliance.memberIds.filter((id) => id !== playerId),
      membershipByPlayerId,
      version: alliance.version + 1
    };
  }
  runtime.state.root.version += 1;
  return true;
};
